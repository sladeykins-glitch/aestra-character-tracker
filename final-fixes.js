// Small compatibility layer for the final experience pass.
function syncRulesConflictClass(){
  const alert=document.getElementById('rulesAwareAlert'),count=document.getElementById('rulesAlertCount');if(!alert||!count)return;
  const n=Number((count.textContent||'').match(/\d+/)?.[0]||0);alert.classList.toggle('has-conflicts',n>0);
}
function keepAdventureNotesAvailable(){
  const notesPanel=document.getElementById('notes')?.closest('article.panel');if(notesPanel)notesPanel.classList.remove('adventure-hide');
}
function verifyFinalExperience(){
  const required=['saveBtn','statuses','mig','dex','ins','wlp','hpNow','hpMaxText','mpNow','mpMaxText','notes','grandMobileNav'];
  const missing=required.filter(id=>!document.getElementById(id));
  if(missing.length)console.warn('Aestra final experience: missing expected controls',missing);
  // Re-sync visual overlays after async character loading without mutating rules state.
  try{window.dispatchEvent(new Event('pageshow'))}catch{}
}
const rulesCount=document.getElementById('rulesAlertCount');if(rulesCount)new MutationObserver(syncRulesConflictClass).observe(rulesCount,{childList:true,subtree:true,characterData:true});
document.getElementById('adventureModeBtn')?.addEventListener('click',()=>setTimeout(keepAdventureNotesAvailable,0));
syncRulesConflictClass();keepAdventureNotesAvailable();
setTimeout(()=>{syncRulesConflictClass();keepAdventureNotesAvailable();verifyFinalExperience()},500);
setTimeout(()=>{syncRulesConflictClass();keepAdventureNotesAvailable();verifyFinalExperience()},1700);
