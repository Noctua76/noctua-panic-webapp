(function(root){
 'use strict';
 root.createSecureQuestionnaireUI=function({baseUrl,getHeaders,onComplete}){
  let container=document.getElementById('secure-incident-assistant');
  if(!container){container=document.createElement('section');container.id='secure-incident-assistant';container.className='card hidden';container.setAttribute('aria-label','Incident Questionnaires');document.getElementById('incident-assistant')?.after(container);}
  const engine=new root.AegisQuestionnaireEngine.Controller({baseUrl,getHeaders,onComplete,onChange:render});
  function render(view){
   if(view.state==='CLEARED'){container.replaceChildren();container.classList.add('hidden');return;}
   const flows=(view.flows||[]).filter(f=>f.visible);container.classList.toggle('hidden',!flows.length&&!view.message);
   for(const node of [...container.children])if(node.dataset.flow&&!flows.some(f=>f.key===node.dataset.flow))node.remove();
   if(view.message){let notice=container.querySelector('[data-notice]');if(!notice){notice=document.createElement('p');notice.dataset.notice='yes';container.append(notice);}notice.textContent=view.message;}
   for(const flow of flows){
    let card=[...container.children].find(n=>n.dataset.flow===flow.key);
    if(!card){card=document.createElement('div');card.dataset.flow=flow.key;const title=document.createElement('h3');title.textContent=`Incident ${flow.incidentId}`;card.append(title);const status=document.createElement('p');status.dataset.status='yes';status.setAttribute('aria-live','polite');card.append(status);const offline=document.createElement('p');offline.textContent='Τα drafts κρυπτογραφούνται. Μετά από επανεκκίνηση απαιτείται online επαλήθευση της αρχικής συνεδρίας για ανάκτηση.';card.append(offline);const fields=document.createElement('fieldset');fields.dataset.fields='yes';card.append(fields);const submit=document.createElement('button');submit.type='button';submit.dataset.submit='yes';submit.textContent='Υποβολή απαντήσεων';submit.addEventListener('click',()=>void engine.submit(flow).catch(()=>{}));card.append(submit);const retry=document.createElement('button');retry.type='button';retry.dataset.retry='yes';retry.textContent='Επανάληψη φόρτωσης';retry.addEventListener('click',()=>void engine.initialize(flow).catch(()=>{}));card.append(retry);container.append(card);}
    const messages={INITIALIZING:'Φόρτωση του ερωτηματολογίου του συγκεκριμένου incident…',EDITING:'Έτοιμο για καταγραφή',RAM_ONLY:'Αλλαγές μόνο στη μνήμη — μην κλείσεις τη σελίδα.',LOCALLY_SEALED:'Κρυπτογραφημένο checkpoint στη συσκευή',SERVER_CHECKPOINTED:'Επιβεβαιωμένη ασφαλής φύλαξη draft στον server',SUBMITTING:'Αναμονή επιβεβαίωσης υποβολής…',RETRY_REQUIRED:'Η υποβολή δεν επιβεβαιώθηκε. Οι απαντήσεις διατηρούνται για retry.',RECOVERY_REQUIRED:'Απαιτείται σύνδεση και επανάληψη ανάκτησης.',DRAFT_CONFLICT:'Διαφορετική έκδοση draft — διατηρείται για ελεγχόμενη ανάκτηση.',RETENTION_ONLY:'Το incident έχει κλείσει. Το draft διατηρείται ως μη υποβληθέν στοιχείο.'};
    card.querySelector('[data-status]').textContent=messages[flow.state]||flow.state;
    const fields=card.querySelector('[data-fields]');fields.disabled=Boolean(flow.transitioning)||Boolean(flow.submitting)||Boolean(flow.finalPayload)||!flow.snapshot||flow.state==='DRAFT_CONFLICT';
    if(flow.snapshot&&!fields.children.length){for(const q of flow.snapshot.questions){const label=document.createElement('label');const text=document.createElement('span');text.textContent=`${q.position}. ${q.prompt} · ${q.required?'Υποχρεωτικό':'Προαιρετικό'}`;label.append(text);const area=document.createElement(q.type==='SHORT_TEXT'?'input':'textarea');area.dataset.question=q.id;area.value=flow.answers[q.id]||'';area.maxLength=q.maxLength*2;const count=document.createElement('small');count.dataset.count=q.id;count.textContent=`${[...area.value].length}/${q.maxLength}`;area.addEventListener('input',()=>{if([...area.value].length>q.maxLength){area.value=[...area.value].slice(0,q.maxLength).join('');}count.textContent=`${[...area.value].length}/${q.maxLength}`;void engine.update(flow,q.id,area.value).catch(()=>{});});label.append(area,count);if(q.help){const help=document.createElement('small');help.textContent=q.help;label.append(help);}fields.append(label);}}
    for(const area of fields.querySelectorAll('[data-question]'))if(document.activeElement!==area)area.value=flow.answers[area.dataset.question]||'';
    card.querySelector('[data-submit]').disabled=Boolean(flow.submitting)||!flow.snapshot||['DRAFT_CONFLICT','RETENTION_ONLY'].includes(flow.state);
    card.querySelector('[data-retry]').hidden=Boolean(flow.snapshot); // No external content or HTML interpolation.
   }
  }
  return engine;
 };
})(globalThis);
