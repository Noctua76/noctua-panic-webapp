/* Incident-scoped secure questionnaire client. No private key or plaintext answer persistence. */
(function(root){
 'use strict';
 const ALGORITHM='RSA-OAEP-256+A256GCM';
 const canonical=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(canonical).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 const bytes=value=>new TextEncoder().encode(canonical(value));
 const b64=buffer=>{let text='';for(const b of new Uint8Array(buffer))text+=String.fromCharCode(b);return btoa(text);};
 async function fingerprint(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes(value)))].map(v=>v.toString(16).padStart(2,'0')).join('');}
 async function seal(keyInfo,identity,value,purpose='draft-checkpoint'){
  if(keyInfo.version!==1||keyInfo.algorithm!==ALGORITHM||!keyInfo.keyId||!keyInfo.scope)throw new Error('STORAGE_KEY_INVALID');
  const plaintext=bytes(value);if(plaintext.byteLength>65536)throw new Error('PAYLOAD_TOO_LARGE');
  const publicKey=await crypto.subtle.importKey('jwk',keyInfo.publicKey,{name:'RSA-OAEP',hash:'SHA-256'},false,['encrypt']);
  if(publicKey.algorithm.modulusLength<3072)throw new Error('STORAGE_KEY_INVALID');
  const dek=await crypto.subtle.generateKey({name:'AES-GCM',length:256},true,['encrypt']);const raw=await crypto.subtle.exportKey('raw',dek);const iv=crypto.getRandomValues(new Uint8Array(12));
  const aad={scope:keyInfo.scope,purpose,...identity,envelopeVersion:1,keyId:keyInfo.keyId};
  const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:bytes(aad),tagLength:128},dek,plaintext));
  const wrapped=await crypto.subtle.encrypt({name:'RSA-OAEP'},publicKey,raw);new Uint8Array(raw).fill(0);plaintext.fill(0);
  return {version:1,algorithm:ALGORITHM,keyId:keyInfo.keyId,aad,iv:b64(iv),wrappedKey:b64(wrapped),ciphertext:b64(encrypted.slice(0,-16)),tag:b64(encrypted.slice(-16))};
 }
 function finalPayload(snapshot,values){
  const answers=[],omittedOptionalQuestionIds=[];
  for(const q of snapshot.questions){const value=values[q.id]??'';if(typeof value!=='string'||[...value].length>q.maxLength)throw new Error('INVALID_ANSWER');if(!value.trim()){if(q.required)throw new Error('REQUIRED_ANSWER_MISSING');omittedOptionalQuestionIds.push(q.id);}else answers.push({questionId:q.id,value});}
  return {protocolVersion:2,snapshotId:snapshot.id,snapshotDigest:snapshot.digest,answers,omittedOptionalQuestionIds};
 }
 async function verifyFinalReceipt(flow,payload,receipt){
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(receipt.protocolVersion!==2||receipt.responsesSaved!==true||!uuid.test(receipt.submissionId)||receipt.incidentId!==flow.incidentId||receipt.snapshotId!==payload.snapshotId||receipt.snapshotDigest!==payload.snapshotDigest||receipt.questionCount!==flow.snapshot.questions.length||receipt.answeredCount!==payload.answers.length||canonical(receipt.omittedOptionalQuestionIds)!==canonical(payload.omittedOptionalQuestionIds)||receipt.payloadDigest!==await fingerprint(payload))throw new Error('SUBMISSION_RECEIPT_INVALID');
 }
 class SealedOutbox {
  constructor({indexedDB=root.indexedDB,name='aegis-questionnaire-sealed-v1'}={}){this.indexedDB=indexedDB;this.name=name;this.dbPromise=null;}
  open(){if(!this.dbPromise)this.dbPromise=new Promise((resolve,reject)=>{const req=this.indexedDB.open(this.name,1);req.onupgradeneeded=()=>{req.result.createObjectStore('packets',{keyPath:'key'});req.result.createObjectStore('publicKeys',{keyPath:'key'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>{this.dbPromise=null;reject(new Error('SECURE_STORAGE_UNAVAILABLE'));};req.onblocked=()=>reject(new Error('SECURE_STORAGE_BLOCKED'));});return this.dbPromise;}
  async transaction(store,mode,action){const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result;try{const req=action(tx.objectStore(store));if(req)req.onsuccess=()=>{result=req.result;};}catch(e){tx.abort();reject(e);return;}tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(new Error('SECURE_STORAGE_WRITE_FAILED'));tx.onabort=()=>reject(new Error('SECURE_STORAGE_WRITE_FAILED'));});}
  async put(packet){if(!packet.envelope||Object.hasOwn(packet,'answers')||Object.hasOwn(packet,'draft')||Object.hasOwn(packet,'snapshot'))throw new Error('PLAINTEXT_STORAGE_FORBIDDEN');return this.transaction('packets','readwrite',store=>store.put(packet));}
  list(){return this.transaction('packets','readonly',store=>store.getAll());}
  remove(key){return this.transaction('packets','readwrite',store=>store.delete(key));}
  savePublicKey(key,info){return this.transaction('publicKeys','readwrite',store=>store.put({key,info}));}
  readPublicKey(key){return this.transaction('publicKeys','readonly',store=>store.get(key));}
 }
 const identityOf=session=>{
  if(!session||session.guard?.access_mode==='read_only')return null;
  const identity={guardId:Number(session.guard?.id),siteId:Number(session.guard?.site_id||session.session?.site_id),sessionId:Number(session.session?.id)};
  return Object.values(identity).every(v=>Number.isSafeInteger(v)&&v>0)?identity:null;
 };
 const same=(a,b)=>Boolean(a&&b&&a.guardId===b.guardId&&a.siteId===b.siteId&&a.sessionId===b.sessionId);
 class Controller {
  constructor({baseUrl,getHeaders,store=new SealedOutbox(),fetcher=(...args)=>fetch(...args),onChange=()=>{},onComplete=()=>{},now=()=>Date.now(),later=(fn,ms)=>setTimeout(fn,ms)}={}){
   Object.assign(this,{baseUrl,getHeaders,store,fetcher,onChange,onComplete,now,later});this.generation=0;this.transitioning=false;this.identity=null;this.flows=new Map();this.legacyWrites=new Map();this.keyInfo=null;
  }
  setSession(session){const next=identityOf(session);if(same(next,this.identity))return;this.generation++;this.transitioning=false;this.identity=next;this.headers=next?{...this.getHeaders()}:null;this.keyInfo=null;
   // Ciphertext remains in IndexedDB. No old question or answer is retained in the visible model.
   for(const flow of this.flows.values()){flow.answers={};flow.snapshot=null;flow.visible=false;}this.flows.clear();this.onChange({state:'CLEARED',flows:[]});
   const generation=this.generation;if(next)void this.restore().catch(()=>{if(generation===this.generation&&same(next,this.identity))this.emit({state:'RECOVERY_REQUIRED',message:'Η ανάκτηση απαιτεί ενεργή σύνδεση. Τα κρυπτογραφημένα drafts διατηρούνται.'});});
  }
  current(flow,generation=this.generation){return generation===this.generation&&same(flow,this.identity);}
  emit(extra={}){this.onChange({...extra,flows:[...this.flows.values()].filter(f=>this.current(f)),identity:this.identity});}
  async request(path,method='GET',body,identity=this.identity){
   if(!same(identity,this.identity))throw new Error('SESSION_CHANGED');
   if(!this.headers||this.getHeaders().Authorization!==this.headers.Authorization){this.setSession(null);throw new Error('SESSION_CHANGED');}
   const generation=this.generation;const headers={...this.headers};
   const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),8000);
   try {
   const response=await this.fetcher(this.baseUrl+path,{method,signal:abort.signal,cache:'no-store',headers:{...headers,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
   const result=await response.json();if(generation!==this.generation)throw new Error('SESSION_CHANGED');if(this.getHeaders().Authorization!==headers.Authorization){this.setSession(null);throw new Error('SESSION_CHANGED');}if(!response.ok||result.status!=='ok'){const error=new Error(result.code||'QUESTIONNAIRE_UNAVAILABLE');error.code=result.code;error.status=response.status;throw error;}return result;
   } finally { clearTimeout(timeout); }
  }
  async storageKey(flow){
   if(this.keyInfo)return this.keyInfo;const generation=this.generation;const storageKey=[flow.guardId,flow.siteId,flow.sessionId].join(':');
   try{const info=await this.request('/guard/questionnaire-storage-key');if(!this.current(flow,generation))throw new Error('SESSION_CHANGED');if(!same(info.identity,flow))throw new Error('STORAGE_IDENTITY_MISMATCH');this.keyInfo=info;await this.store.savePublicKey(storageKey,info);return info;}
   catch(error){if(!this.current(flow,generation))throw error;const cached=await this.store.readPublicKey(storageKey);if(!cached||!same(cached.info.identity,flow))throw error;return cached.info;}
  }
  queue(incident,{dueAt=this.now()+15000}={}){
   if(!this.identity||!Number.isSafeInteger(Number(incident?.id)))return;
   const key=[this.identity.guardId,this.identity.sessionId,incident.id].join(':');if(this.flows.has(key))return this.flows.get(key);
   const flow={...this.identity,key,incidentId:Number(incident.id),draftId:crypto.randomUUID(),revision:0,serverRevision:0,dueAt,answers:{},snapshot:null,state:'INITIALIZING',visible:false,write:Promise.resolve(),clientSubmissionId:crypto.randomUUID(),editorId:crypto.randomUUID(),ownedPackets:new Set(),fingerprints:new Map(),editVersion:0,localSavedVersion:0};this.flows.set(key,flow);
   const generation=this.generation;this.later(()=>{if(this.current(flow,generation)){flow.visible=true;this.emit();}},Math.max(0,dueAt-this.now()));
   flow.initialization=this.initialize(flow);void flow.initialization.catch(error=>{if(this.current(flow,generation)){flow.state='RECOVERY_REQUIRED';flow.error=error.message;this.emit();}});return flow;
  }
  async initialize(flow){if(!this.current(flow))throw new Error('SESSION_CHANGED');const generation=this.generation;
   const data=await this.request(`/guard/incidents/${flow.incidentId}/questionnaire`);if(!this.current(flow,generation))return;
   if(data.state!=='READY'||data.protocolVersion!==2||!Array.isArray(data.snapshot?.questions)||!data.snapshot.questions.length||data.snapshot.questions.length>12)throw new Error('QUESTIONNAIRE_NOT_READY');
   flow.snapshot=data.snapshot;await this.storageKey(flow);if(!this.current(flow,generation))return;flow.state='EDITING';this.emit();
  }
  update(flow,questionId,value){if(this.transitioning||!this.current(flow)||flow.submitting||flow.finalPayload||!flow.snapshot)throw new Error('SESSION_CHANGED');const q=flow.snapshot.questions.find(q=>q.id===questionId);if(!q||typeof value!=='string'||[...value].length>q.maxLength)throw new Error('INVALID_ANSWER');flow.answers[questionId]=value;flow.state='RAM_ONLY';this.emit();return this.checkpoint(flow);}
  packetsFor(flow,packets){return packets.filter(p=>(p.flowKey||p.key)===flow.key&&flow.ownedPackets.has(p.key));}
  packetInput(packet,expectedRevision){return {draftId:packet.identity.draftId,expectedRevision,revision:packet.revision,envelope:packet.envelope};}
  async verifyCustody(flow,packet,receipt){
   if(receipt.protocolVersion!==(flow.legacy?1:2)||receipt.incidentId!==flow.incidentId||receipt.originalSessionId!==flow.sessionId||receipt.draftId!==flow.draftId||receipt.revision!==packet.revision||(!flow.legacy&&receipt.snapshotId!==flow.snapshot?.id)||receipt.verifiedEnvelopeDigest!==await fingerprint(packet.envelope))throw new Error('DRAFT_RECEIPT_INVALID');
   const known=flow.fingerprints.get(packet.revision);if(known&&receipt.payloadDigest!==known)throw new Error('DRAFT_RECEIPT_INVALID');
  }
  async removeOwned(flow,beforeRevision=Infinity){
   for(const packet of this.packetsFor(flow,await this.store.list()))if(packet.revision<beforeRevision){await this.store.remove(packet.key);flow.ownedPackets.delete(packet.key);}
  }
  checkpoint(flow){
   const generation=this.generation,capturedKeyInfo=this.keyInfo,captured={...flow,answers:{...flow.answers},snapshot:flow.snapshot},mark=++flow.editVersion;
   const work=async()=>{
    const info=capturedKeyInfo||await this.storageKey(captured);if(!captured.snapshot)throw new Error('QUESTIONNAIRE_NOT_READY');const revision=flow.revision+1;
    const identity={companyId:info.identity.companyId,siteId:captured.siteId,guardId:captured.guardId,sessionId:captured.sessionId,incidentId:captured.incidentId,snapshotId:captured.snapshot.id,snapshotDigest:captured.snapshot.digest,draftId:captured.draftId,revision};
    const payload={protocolVersion:2,snapshotId:captured.snapshot.id,snapshotDigest:captured.snapshot.digest,answers:captured.snapshot.questions.filter(q=>Object.hasOwn(captured.answers,q.id)).map(q=>({questionId:q.id,value:captured.answers[q.id]}))};
    const envelope=await seal(info,identity,payload);const packet={kind:'dynamic',key:flow.key+':'+crypto.randomUUID(),flowKey:flow.key,editorId:flow.editorId,identity,dueAt:captured.dueAt,clientSubmissionId:captured.clientSubmissionId,expectedRevision:flow.serverRevision,revision,envelope};
    await this.store.put(packet);flow.ownedPackets.add(packet.key);flow.fingerprints.set(revision,await fingerprint(payload));flow.revision=revision;flow.localSavedVersion=mark;
    if(!this.current(flow,generation))return;if(mark===flow.editVersion&&!flow.submitting&&!flow.finalPayload){flow.state='LOCALLY_SEALED';this.emit();}
    void this.sync(flow).catch(()=>{});
   };
   flow.write=flow.write.catch(()=>{}).then(work).catch(error=>{if(this.current(flow,generation)){flow.state='RAM_ONLY';flow.error=error.message;this.emit();}throw error;});return flow.write;
  }
  sync(flow){
   if(flow.syncing){flow.resync=true;return flow.syncing;}
   const generation=this.generation;let failed=false;
   const suffix=flow.legacy?'legacy-questionnaire-draft':'questionnaire-draft';
   flow.syncing=(async()=>{
    while(this.current(flow,generation)&&!flow.closed){
     flow.resync=false;const packets=this.packetsFor(flow,await this.store.list()).sort((a,b)=>b.revision-a.revision);const packet=packets.find(p=>p.revision>flow.serverRevision);if(!packet)break;
     let receipt;
     try{receipt=await this.request(`/guard/incidents/${flow.incidentId}/${suffix}`,'PUT',this.packetInput(packet,flow.serverRevision));}
     catch(error){
      if(flow.closed)return;
      if(error.code==='DRAFT_ALREADY_SUBMITTED'&&!flow.legacy){
       const recovered=await this.request(`/guard/incidents/${flow.incidentId}/questionnaire-receipt-recovery`,'POST',this.packetInput(packet,packet.expectedRevision));
       if(recovered.verifiedEnvelopeDigest!==await fingerprint(packet.envelope))throw new Error('DRAFT_RECOVERY_INVALID');
       const payload=finalPayload(flow.snapshot,Object.fromEntries(recovered.draft.answers.map(a=>[a.questionId,a.value])));await verifyFinalReceipt(flow,payload,recovered.receipt);await this.finish(flow);return recovered.receipt;
      }
      if(error.code!=='DRAFT_REVISION_CONFLICT')throw error;
      const remote=await this.request(`/guard/incidents/${flow.incidentId}/${suffix}`),r=remote.receipt?.revision;
      const predecessor=packets.find(p=>p.revision===r&&p.identity.draftId===flow.draftId);
      if(!predecessor||r<=flow.serverRevision)throw new Error('DRAFT_CONFLICT');
      // Rebase only onto a checkpoint whose exact encrypted packet this flow owns.
      // A different tab/device's unseen edit is never adopted or overwritten.
      const proven=await this.request(`/guard/incidents/${flow.incidentId}/${suffix}`,'PUT',this.packetInput(predecessor,predecessor.expectedRevision));await this.verifyCustody(flow,predecessor,proven);flow.serverRevision=r;continue;
     }
     await this.verifyCustody(flow,packet,receipt);flow.serverRevision=receipt.revision;
     await this.removeOwned(flow,receipt.revision);
     if(this.current(flow,generation)&&!flow.legacy&&!flow.submitting&&!flow.finalPayload&&flow.localSavedVersion===flow.editVersion&&flow.serverRevision===flow.revision){flow.state=receipt.state==='CHECKPOINTED'?'SERVER_CHECKPOINTED':receipt.state;this.emit();}
    }
   })().catch(error=>{failed=true;if(this.current(flow,generation)){flow.error=error.message;if(!flow.legacy&&/CONFLICT/.test(error.code||error.message))flow.state='DRAFT_CONFLICT';this.emit();}throw error;}).finally(()=>{flow.syncing=null;if(flow.resync&&!failed&&this.current(flow,generation)&&!flow.closed)void this.sync(flow).catch(()=>{});});
   return flow.syncing;
  }
  async finish(flow){
   flow.closed=true;await this.removeOwned(flow);const removed=this.flows.delete(flow.key);flow.answers={};flow.snapshot=null;
   if(removed&&this.current(flow)){this.emit({state:'SUBMITTED'});if(![...this.flows.values()].some(f=>this.current(f)))this.onComplete();}
  }
  async restore(){
   const identity=this.identity,generation=this.generation;if(!identity)return;const packets=await this.store.list();
   const pending=await this.request('/guard/questionnaire-pending');if(generation!==this.generation)return;for(const item of pending.incidents||[])this.queue(item,{dueAt:item.dueAt});
   const groups=new Map();for(const packet of packets){if(packet.kind==='legacy'||!same(packet.identity,identity))continue;const key=packet.flowKey||packet.key;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(packet);}
   for(const rows of groups.values()){
    if(generation!==this.generation)return;rows.sort((a,b)=>a.revision-b.revision);const latest=rows.at(-1),flow=this.queue({id:latest.identity.incidentId},{dueAt:latest.dueAt});flow.restoring=true;
    flow.draftId=latest.identity.draftId;flow.clientSubmissionId=latest.clientSubmissionId;flow.editorId=latest.editorId||flow.editorId;flow.revision=latest.revision;flow.serverRevision=0;flow.ownedPackets=new Set(rows.map(p=>p.key));
    await flow.initialization;if(!this.current(flow,generation))return;
    if(new Set(rows.map(p=>p.revision)).size!==rows.length||new Set(rows.map(p=>p.identity.draftId)).size!==1){flow.state='DRAFT_CONFLICT';this.emit();continue;}
    try{await this.sync(flow);}catch(error){if(this.current(flow,generation)){flow.state=/CONFLICT/.test(error.code||error.message)?'DRAFT_CONFLICT':'RECOVERY_REQUIRED';flow.error=error.message;this.emit();}continue;}
    if(!this.flows.has(flow.key)||!this.current(flow,generation))continue;
    const recovered=await this.request(`/guard/incidents/${flow.incidentId}/questionnaire-draft`);
    if(!this.current(flow,generation))return;if(!recovered.draft||recovered.receipt?.draftId!==flow.draftId||recovered.receipt.originalSessionId!==flow.sessionId||recovered.receipt.revision!==flow.revision||recovered.receipt.payloadDigest!==await fingerprint(recovered.draft))throw new Error('DRAFT_RECOVERY_INVALID');
    flow.answers=Object.fromEntries(recovered.draft.answers.map(a=>[a.questionId,a.value]));flow.finalPayload=latest.submissionPending?finalPayload(flow.snapshot,flow.answers):null;flow.state=latest.submissionPending?'RETRY_REQUIRED':'SERVER_CHECKPOINTED';flow.restoring=false;this.emit();
   }
  }
  async captureLegacy(flow){
   const base=this.identity;if(!base||Number(flow.guardId)!==base.guardId||Number(flow.sessionId)!==base.sessionId)throw new Error('SESSION_CHANGED');
   const key='legacy:'+base.guardId+':'+base.sessionId+':'+flow.incidentId;
   let record=this.legacyWrites.get(key);if(!record){record={...base,key,legacy:true,incidentId:Number(flow.incidentId),draftId:flow.secureDraftId||crypto.randomUUID(),editorId:crypto.randomUUID(),revision:flow.secureRevision||0,serverRevision:flow.secureServerRevision||0,write:Promise.resolve(),ownedPackets:new Set(),fingerprints:new Map()};this.legacyWrites.set(key,record);flow.secureDraftId=record.draftId;}
   const capturedKey=this.keyInfo,generation=this.generation,payload={protocolVersion:1,answers:{...flow.answers},questionIndex:flow.questionIndex,draft:flow.draft,dueAt:flow.dueAt};
   record.write=record.write.catch(()=>{}).then(async()=>{
    const info=capturedKey||await this.storageKey(record),revision=record.revision+1;
    const identity={companyId:info.identity.companyId,siteId:record.siteId,guardId:record.guardId,sessionId:record.sessionId,incidentId:record.incidentId,draftId:record.draftId,revision};
    const envelope=await seal(info,identity,payload,'legacy-draft-checkpoint'),packet={kind:'legacy',key:key+':'+crypto.randomUUID(),flowKey:key,editorId:record.editorId,identity,dueAt:flow.dueAt,expectedRevision:record.serverRevision,revision,envelope};
    await this.store.put(packet);record.ownedPackets.add(packet.key);record.fingerprints.set(revision,await fingerprint(payload));record.revision=revision;flow.secureRevision=revision;
    if(this.current(record,generation))void this.sync(record).then(()=>{flow.secureServerRevision=record.serverRevision;}).catch(()=>{});
   });return record.write;
  }
  async restoreLegacy(storage=root.localStorage){
   const identity=this.identity,generation=this.generation;if(!identity)return [];
   for(let index=0;index<storage.length;index++){
    const key=storage.key(index);if(!key?.startsWith('aegis-incident-questionnaire-v2:'))continue;let flow;try{flow=JSON.parse(storage.getItem(key));}catch{continue;}
    if(Number(flow?.guardId)!==identity.guardId||Number(flow?.sessionId)!==identity.sessionId||key!==`aegis-incident-questionnaire-v2:${flow.sessionId}:${flow.incidentId}`)continue;
    const flowKey='legacy:'+identity.guardId+':'+identity.sessionId+':'+flow.incidentId,existing=(await this.store.list()).filter(p=>p.kind==='legacy'&&(p.flowKey||p.key)===flowKey);
    if(existing.length){
     const latest=existing.sort((a,b)=>a.revision-b.revision).at(-1);flow.secureDraftId=latest.identity.draftId;flow.secureRevision=latest.revision;
     const record={...identity,key:flowKey,legacy:true,incidentId:Number(flow.incidentId),draftId:latest.identity.draftId,revision:latest.revision,serverRevision:0,ownedPackets:new Set(existing.map(p=>p.key)),fingerprints:new Map(),write:Promise.resolve()};await this.sync(record);
    }else{await this.captureLegacy(flow);await this.sync(this.legacyWrites.get(flowKey));}
    if(generation!==this.generation)return [];
    const recovered=await this.request(`/guard/incidents/${flow.incidentId}/legacy-questionnaire-draft`),value={protocolVersion:1,answers:{...flow.answers},questionIndex:flow.questionIndex,draft:flow.draft,dueAt:flow.dueAt};
    if(recovered.receipt?.originalSessionId!==identity.sessionId||recovered.receipt?.draftId!==flow.secureDraftId||recovered.receipt?.revision!==flow.secureRevision||recovered.receipt?.payloadDigest!==await fingerprint(value)||canonical(recovered.draft)!==canonical(value))throw new Error('LEGACY_MIGRATION_NOT_VERIFIED');
    storage.removeItem(key);index--;
   }
   const groups=new Map();for(const packet of await this.store.list()){if(packet.kind!=='legacy'||!same(packet.identity,identity))continue;const key=packet.flowKey||packet.key;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(packet);}
   const flows=[];
   for(const [key,rows] of groups){if(generation!==this.generation)return [];rows.sort((a,b)=>a.revision-b.revision);const latest=rows.at(-1);
    if(new Set(rows.map(p=>p.revision)).size!==rows.length||new Set(rows.map(p=>p.identity.draftId)).size!==1)throw new Error('LEGACY_DRAFT_CONFLICT');
    const record={...identity,key,legacy:true,incidentId:latest.identity.incidentId,draftId:latest.identity.draftId,editorId:latest.editorId||crypto.randomUUID(),revision:latest.revision,serverRevision:0,ownedPackets:new Set(rows.map(p=>p.key)),fingerprints:new Map(),write:Promise.resolve()};this.legacyWrites.set(key,record);await this.sync(record);
    const data=await this.request(`/guard/incidents/${record.incidentId}/legacy-questionnaire-draft`);if(generation!==this.generation)return [];
    if(!data.draft||data.receipt?.originalSessionId!==identity.sessionId||data.receipt.draftId!==record.draftId||data.receipt.revision!==record.revision||data.receipt.payloadDigest!==await fingerprint(data.draft))throw new Error('LEGACY_RECOVERY_NOT_VERIFIED');
    flows.push({...identity,incidentId:record.incidentId,answers:data.draft.answers,questionIndex:data.draft.questionIndex,draft:data.draft.draft,dueAt:data.draft.dueAt,secureDraftId:record.draftId,secureRevision:record.revision,secureServerRevision:record.serverRevision,submitting:false});
   }
   return flows;
  }
  async completeLegacy(flow){const key='legacy:'+flow.guardId+':'+flow.sessionId+':'+flow.incidentId,record=this.legacyWrites.get(key);if(record){await record.write;record.closed=true;await this.removeOwned(record);this.legacyWrites.delete(key);}}
  async flushLocal(){
   this.transitioning=true;for(const flow of this.flows.values())flow.transitioning=true;this.emit();
   try{await Promise.all([...this.flows.values(),...this.legacyWrites.values()].map(flow=>flow.write));}
   catch(error){this.transitioning=false;for(const flow of this.flows.values())flow.transitioning=false;this.emit({state:'UPDATE_WAITING',message:'Η ενημέρωση περιμένει ασφαλή αποθήκευση. Μην κλείσεις τη σελίδα.'});throw error;}
  }
  async submit(flow){
   if(!this.current(flow)||!flow.snapshot||flow.submitting)throw new Error('SESSION_CHANGED');const generation=this.generation;flow.submitting=true;flow.state='SUBMITTING';this.emit();
   try{
    await flow.write;const s=flow.snapshot;if(!this.current(flow,generation)||!s)throw new Error('SESSION_CHANGED');
    const payload=flow.finalPayload||finalPayload(s,flow.answers);
    if(!flow.revision)await this.checkpoint(flow);
    if(!this.current(flow,generation))throw new Error('SESSION_CHANGED');
    const packet=this.packetsFor(flow,await this.store.list()).sort((a,b)=>b.revision-a.revision)[0];if(!packet)throw new Error('SECURE_STORAGE_WRITE_FAILED');
    await this.store.put({...packet,submissionPending:true});flow.finalPayload=payload;
    const receipt=await this.request(`/guard/incidents/${flow.incidentId}/questionnaire-submission`,'POST',{...payload,clientSubmissionId:flow.clientSubmissionId});
    await verifyFinalReceipt({...flow,snapshot:s},payload,receipt);
    await this.finish(flow);return receipt;
   }catch(error){if(this.current(flow,generation)){flow.state='RETRY_REQUIRED';flow.error=error.message;this.emit();}throw error;}
   finally{flow.submitting=false;if(this.current(flow,generation))this.emit();}
  }
 }
 const api={ALGORITHM,canonical,fingerprint,seal,finalPayload,verifyFinalReceipt,SealedOutbox,Controller,identityOf,same};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AegisQuestionnaireEngine=api;
})(globalThis);
