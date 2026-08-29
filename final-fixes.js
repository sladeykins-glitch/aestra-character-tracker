// Small compatibility layer for the final experience pass.
function syncRulesConflictClass(){
  const alert=document.getElementById('rulesAwareAlert'),count=document.getElementById('rulesAlertCount');if(!alert||!count)return;
  const n=Number((count.textContent||'').match(/\d+/)?.[0]||0);alert.classList.toggle('has-conflicts',n>0);
}
function keepAdventureNotesAvailable(){
  const notesPanel=document.getElementById('notes')?.closest('article.panel');if(notesPanel)notesPanel.classList.remove('adventure-hide');
}
function syncDisplayCopies(){
  const map={displayCharName:'charName',displayLevel:'level',displayIdentity:'identity',displayTheme:'theme',displayOrigin:'origin',displayPlayerName:'playerName',displayXp:'xp',displayZenit:'zenit'};
  for(const [out,id] of Object.entries(map)){const a=document.getElementById(out),b=document.getElementById(id);if(a&&b){const v=String(b.value??'').trim();a.textContent=v||((id==='xp'||id==='zenit')?'0':'—')}}
  const aura=document.getElementById('characterClassAura');if(aura){const names=[...document.querySelectorAll('#classesEditor .entry-row')].map(r=>r.querySelector('input')?.value?.trim()).filter(Boolean).slice(0,3);aura.innerHTML=names.map(n=>`<span>${n}</span>`).join('');aura.classList.toggle('has-classes',names.length>0)}
  const adventureName=document.getElementById('adventureName'),adventureLevel=document.getElementById('adventureLevel'),adventureClasses=document.getElementById('adventureClasses');
  if(adventureName)adventureName.textContent=document.getElementById('charName')?.value||'Character';if(adventureLevel)adventureLevel.textContent=`LV ${document.getElementById('level')?.value||1}`;if(adventureClasses){adventureClasses.textContent=[...document.querySelectorAll('#classesEditor .entry-row')].map(r=>r.querySelector('input')?.value?.trim()).filter(Boolean).slice(0,3).join(' · ')}
}
function verifyFinalExperience(){
  const required=['saveBtn','statuses','mig','dex','ins','wlp','hpNow','hpMaxText','mpNow','mpMaxText','notes','grandMobileNav'];
  const missing=required.filter(id=>!document.getElementById(id));
  if(missing.length)console.warn('Aestra final experience: missing expected controls',missing);
  try{window.dispatchEvent(new Event('pageshow'))}catch{}
  syncDisplayCopies();
}
const rulesCount=document.getElementById('rulesAlertCount');if(rulesCount)new MutationObserver(syncRulesConflictClass).observe(rulesCount,{childList:true,subtree:true,characterData:true});
document.getElementById('adventureModeBtn')?.addEventListener('click',()=>setTimeout(()=>{keepAdventureNotesAvailable();syncDisplayCopies()},0));
const classesEditor=document.getElementById('classesEditor');if(classesEditor)new MutationObserver(syncDisplayCopies).observe(classesEditor,{childList:true,subtree:true});
const connection=document.getElementById('connectionBadge');if(connection)new MutationObserver(syncDisplayCopies).observe(connection,{childList:true,subtree:true,characterData:true});
['charName','level','identity','theme','origin','playerName','xp','zenit'].forEach(id=>{const el=document.getElementById(id);el?.addEventListener('input',syncDisplayCopies);el?.addEventListener('change',syncDisplayCopies)});
syncRulesConflictClass();keepAdventureNotesAvailable();syncDisplayCopies();
setTimeout(()=>{syncRulesConflictClass();keepAdventureNotesAvailable();verifyFinalExperience()},500);
setTimeout(()=>{syncRulesConflictClass();keepAdventureNotesAvailable();verifyFinalExperience()},1700);
setTimeout(()=>{syncRulesConflictClass();keepAdventureNotesAvailable();verifyFinalExperience()},3500);
