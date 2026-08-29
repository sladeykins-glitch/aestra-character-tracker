const STATUS_FIX_DICE=[6,8,10,12];
const STATUS_FIX_REDUCTIONS={Slow:{dex:1},Dazed:{ins:1},Weak:{mig:1},Shaken:{wlp:1},Enraged:{dex:1,ins:1},Poisoned:{mig:1,wlp:1}};
const STATUS_FIX_NAMES=Object.keys(STATUS_FIX_REDUCTIONS);

function statusFixDie(v){return Number(String(v||'d6').replace('d',''))||6}
function statusFixReduced(base,steps){
  const idx=Math.max(0,STATUS_FIX_DICE.indexOf(statusFixDie(base)));
  return `d${STATUS_FIX_DICE[Math.max(0,idx-steps)]}`;
}
function statusFixName(btn){
  const fromData=String(btn?.dataset?.status||'').trim().toLowerCase();
  if(fromData){const found=STATUS_FIX_NAMES.find(n=>n.toLowerCase()===fromData);if(found)return found}
  const strong=btn?.querySelector?.('strong')?.textContent?.trim();
  if(strong){const found=STATUS_FIX_NAMES.find(n=>n.toLowerCase()===strong.toLowerCase());if(found)return found}
  const text=String(btn?.textContent||'').trim().toLowerCase();
  return STATUS_FIX_NAMES.find(n=>text.startsWith(n.toLowerCase()))||'';
}
function statusFixActive(){
  return [...document.querySelectorAll('#statuses button.active,#statuses button[aria-pressed="true"]')]
    .map(statusFixName).filter(Boolean);
}
function statusFixApply(dispatch=true){
  const reductions={mig:0,dex:0,ins:0,wlp:0};
  for(const status of statusFixActive()){
    for(const [attr,steps] of Object.entries(STATUS_FIX_REDUCTIONS[status]||{})) reductions[attr]+=steps;
  }
  const targets=[];
  for(const attr of ['mig','dex','ins','wlp']){
    const base=document.getElementById(`${attr}Base`);
    const current=document.getElementById(attr);
    if(!base||!current) continue;
    const next=statusFixReduced(base.value,reductions[attr]);
    const changed=current.value!==next;
    current.value=next;
    current.dataset.statusAdjusted='true';
    current.dataset.statusSteps=String(reductions[attr]);
    targets.push([current,next,changed]);
  }
  if(dispatch){
    for(const [current,,changed] of targets){
      if(changed) current.dispatchEvent(new Event('input',{bubbles:true}));
      current.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  requestAnimationFrame(()=>{
    for(const [current,next] of targets){
      current.value=next;
      current.dispatchEvent(new CustomEvent('aestra:status-die',{bubbles:true,detail:{value:next}}));
    }
  });
  const note=document.getElementById('statusRulesNote');
  if(note){
    const affected=Object.entries(reductions).filter(([,n])=>n>0).map(([a,n])=>`${a.toUpperCase()} −${n} step${n>1?'s':''}`);
    note.textContent=affected.length?`${affected.join(' · ')} · minimum d6`:'Statuses automatically reduce current Attribute dice; minimum d6.';
  }
}
function statusFixSchedule(){
  queueMicrotask(()=>statusFixApply(true));
  setTimeout(()=>statusFixApply(true),30);
  setTimeout(()=>statusFixApply(false),140);
}

document.addEventListener('click',e=>{
  if(e.target.closest('#statuses button')) statusFixSchedule();
},true);
document.getElementById('statuses')?.addEventListener('change',statusFixSchedule);
for(const id of ['migBase','dexBase','insBase','wlpBase']){
  document.getElementById(id)?.addEventListener('change',statusFixSchedule);
}
document.addEventListener('click',e=>{
  if(e.target.closest('#saveBtn')) statusFixApply(false);
},true);
setTimeout(()=>statusFixApply(false),350);
setTimeout(()=>statusFixApply(false),1200);