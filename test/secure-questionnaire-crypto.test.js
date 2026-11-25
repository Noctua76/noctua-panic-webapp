const test=require('node:test');const assert=require('node:assert/strict');const {generateKeyPairSync,privateDecrypt,createDecipheriv,constants}=require('node:crypto');
const {seal,canonical,fingerprint,Controller}=require('../questionnaire/secure-engine');
const pair=generateKeyPairSync('rsa',{modulusLength:3072});const info={version:1,algorithm:'RSA-OAEP-256+A256GCM',keyId:'synthetic',scope:'tenant-synthetic',publicKey:pair.publicKey.export({format:'jwk'}),identity:{companyId:1,guardId:1,siteId:2,sessionId:3}};
function unseal(e){const key=privateDecrypt({key:pair.privateKey,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(e.wrappedKey,'base64'));const d=createDecipheriv('aes-256-gcm',key,Buffer.from(e.iv,'base64'));d.setAAD(Buffer.from(canonical(e.aad)));d.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(e.ciphertext,'base64')),d.final()]).toString());}
test('browser WebCrypto envelope interoperates with Node RSA-OAEP/SHA256 and AES-GCM',async()=>{
 const value={answers:[{questionId:'synthetic-id',value:'Synthetic Greek απάντηση 😀'}]};const identity={...info.identity,incidentId:4,revision:1};const a=await seal(info,identity,value),b=await seal(info,identity,value);assert.deepEqual(unseal(a),value);assert.notEqual(a.iv,b.iv);assert.notEqual(a.wrappedKey,b.wrappedKey);assert.ok(!JSON.stringify(a).includes('απάντηση'));assert.equal(a.aad.sessionId,3);assert.equal((await fingerprint(value)).length,64);
});
test('logout during asynchronous sealing preserves ciphertext under the original identity without old UI callbacks',async()=>{
 const records=new Map(),views=[];let complete=0;let release;const hold=new Promise(r=>release=r);
 const store={savePublicKey:async()=>{},readPublicKey:async()=>null,list:async()=>[],put:async p=>{await hold;records.set(p.key,p);},remove:async key=>records.delete(key)};
 const snapshot={id:'snapshot-id',digest:'opaque',questions:[{id:'question-id',required:true,maxLength:5000}]};
 const fetcher=async url=>({ok:true,json:async()=>url.endsWith('storage-key')?{status:'ok',...info}:{status:'ok',state:'READY',protocolVersion:2,snapshot}});
 const c=new Controller({baseUrl:'https://synthetic.test',getHeaders:()=>({Authorization:'synthetic'}),store,fetcher,onChange:v=>views.push(v),onComplete:()=>complete++,later:()=>{}});
 c.setSession({guard:{id:1,site_id:2},session:{id:3}});const flow=c.queue({id:4});await new Promise(r=>setTimeout(r,20));
 const writing=c.update(flow,'question-id','synthetic-session-A');c.setSession({guard:{id:8,site_id:9},session:{id:10}});const index=views.length;release();await writing;
 assert.equal(records.size,1);const packet=[...records.values()][0];assert.equal(packet.identity.sessionId,3);assert.equal(unseal(packet.envelope).answers[0].value,'synthetic-session-A');assert.ok(!JSON.stringify(packet).includes('synthetic-session-A'));
 assert.equal(complete,0);assert.ok(views.slice(index).every(v=>!v.flows?.some(f=>f.sessionId===3)));
});
test('late response from Guard A cannot clear or mutate Guard B, and cross-tab token change fences before dispatch',async()=>{
 let token='Bearer synthetic-A',resolveOld;const calls=[],views=[];const store={list:async()=>[],savePublicKey:async()=>{}};
 const c=new Controller({baseUrl:'https://synthetic.test',getHeaders:()=>({Authorization:token}),store,later:()=>{},onChange:v=>views.push(v),fetcher:async(url,options)=>{calls.push({url,token:options.headers.Authorization});if(url.endsWith('/old'))return new Promise(r=>resolveOld=r);return {ok:true,json:async()=>({status:'ok',incidents:[]})};}});
 c.setSession({guard:{id:1,site_id:2},session:{id:3}});const old=c.request('/old');
 token='Bearer synthetic-B';c.setSession({guard:{id:8,site_id:9},session:{id:10}});const stamp=views.length;resolveOld({ok:true,json:async()=>({status:'ok',secret:'synthetic-A'})});await assert.rejects(old,/SESSION_CHANGED/);await new Promise(r=>setTimeout(r,5));
 assert.equal(c.identity.guardId,8);assert.equal(c.identity.sessionId,10);assert.ok(views.slice(stamp).every(v=>v.state!=='RECOVERY_REQUIRED'&&v.state!=='CLEARED'));
 token='Bearer synthetic-C';await assert.rejects(c.request('/must-not-dispatch'),/SESSION_CHANGED/);assert.equal(c.identity,null);assert.ok(!calls.some(r=>r.url.endsWith('/must-not-dispatch')));
});

test('stalled custody request cannot delay later encrypted local checkpoints or service worker flush',async()=>{
 const records=new Map();let releaseCustody,started;
 const custodyStarted=new Promise(r=>started=r);
 const store={list:async()=>[...records.values()],put:async p=>records.set(p.key,p),remove:async key=>records.delete(key),savePublicKey:async()=>{}};
 const snapshot={id:'snapshot-id',digest:'opaque',questions:[{id:'question-id',required:true,maxLength:5000}]};
 const c=new Controller({baseUrl:'https://synthetic.test',getHeaders:()=>({Authorization:'synthetic'}),store,later:()=>{},fetcher:async(url,options)=>{
  if(options.method==='PUT'){started();return new Promise(r=>releaseCustody=()=>r({ok:false,status:503,json:async()=>({status:'error',code:'SYNTHETIC_UNAVAILABLE'})}));}
  return {ok:true,json:async()=>url.endsWith('storage-key')?{status:'ok',...info}:url.endsWith('questionnaire-pending')?{status:'ok',incidents:[]}:{status:'ok',state:'READY',protocolVersion:2,snapshot}};
 }});
 c.setSession({guard:{id:1,site_id:2},session:{id:3}});const flow=c.queue({id:4});await flow.initialization;
 try{
  await c.update(flow,'question-id','first synthetic answer');await custodyStarted;
  await c.update(flow,'question-id','latest synthetic answer');await c.flushLocal();
  assert.equal(flow.revision,2);assert.equal(flow.localSavedVersion,flow.editVersion);assert.equal(records.size,2);
  assert.equal(unseal([...records.values()].sort((a,b)=>b.revision-a.revision)[0].envelope).answers[0].value,'latest synthetic answer');
  assert.ok(!JSON.stringify([...records.values()]).includes('latest synthetic answer'));
  assert.equal(flow.serverRevision,0,'no custody claim before acknowledgment');assert.equal(c.transitioning,true);
 }finally{releaseCustody?.();await flow.syncing?.catch(()=>{});}
});

test('quota failure keeps edits in RAM, prevents reload readiness and never falls back to plaintext storage',async()=>{
 const views=[];const store={list:async()=>[],put:async()=>{throw new Error('SECURE_STORAGE_WRITE_FAILED');},savePublicKey:async()=>{}};
 const snapshot={id:'snapshot-id',digest:'opaque',questions:[{id:'question-id',required:true,maxLength:5000}]};
 const c=new Controller({baseUrl:'https://synthetic.test',getHeaders:()=>({Authorization:'synthetic'}),store,later:()=>{},onChange:v=>views.push(v),fetcher:async url=>({ok:true,json:async()=>url.endsWith('storage-key')?{status:'ok',...info}:url.endsWith('questionnaire-pending')?{status:'ok',incidents:[]}:{status:'ok',state:'READY',protocolVersion:2,snapshot}})});
 c.setSession({guard:{id:1,site_id:2},session:{id:3}});const flow=c.queue({id:4});await flow.initialization;
 await assert.rejects(c.update(flow,'question-id','RAM-only synthetic evidence'),/WRITE_FAILED/);
 await assert.rejects(c.flushLocal(),/WRITE_FAILED/);assert.equal(c.transitioning,false);assert.equal(flow.answers['question-id'],'RAM-only synthetic evidence');assert.equal(flow.revision,0);assert.equal(flow.state,'RAM_ONLY');assert.ok(views.some(v=>v.state==='UPDATE_WAITING'));
});
