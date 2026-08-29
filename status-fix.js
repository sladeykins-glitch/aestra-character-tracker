const STATUS_FIX_DICE=[6,8,10,12];
const STATUS_FIX_REDUCTIONS={Slow:{dex:1},Dazed:{ins:1},Weak:{mig:1},Shaken:{wlp:1},Enraged:{dex:1,ins:1},Poisoned:{mig:1,wlp:1}};

function statusFixDie(v){return Number(String(v||'d6').replace('d',''))||6}
function statusFixReduced(base,steps){
  const idx=Math.max(0,STATUS_FIX_DICE.indexOf(statusFixDie(base)));
  return `d${STATUS_FIX_DICE[Math.max(0,idx-steps)]}`;
}
function statusFixActive(){
  return [...document.querySelectorAll('#statuses .status-chip.active')].map(b=>b.textContent.trim());
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
    current.value=next;
    current.dataset.statusAdjusted='true';
    targets.push([current,next]);
  }
  if(dispatch){
    for(const [current] of targets){
      current.dispatchEvent(new Event('input',{bubbles:true}));
      current.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }
  // Some core handlers rerender synchronously. Re-assert the final visible values.
  requestAnimationFrame(()=>{for(const [current,next] of targets) current.value=next;});
  const note=document.getElementById('statusRulesNote');
  if(note){
    const affected=Object.entries(reductions).filter(([,n])=>n>0).map(([a,n])=>`${a.toUpperCase()} −${n} step${n>1?'s':''}`);
    note.textContent=affected.length?`${affected.join(' · ')} · minimum d6`:'Statuses automatically reduce current Attribute dice; minimum d6.';
  }
}
function statusFixSchedule(){
  setTimeout(()=>statusFixApply(true),0);
  setTimeout(()=>statusFixApply(true),40);
  setTimeout(()=>statusFixApply(false),160);
}

document.addEventListener('click',e=>{
  if(e.target.closest('#statuses .status-chip')) statusFixSchedule();
},true);
for(const id of ['migBase','dexBase','insBase','wlpBase']){
  document.getElementById(id)?.addEventListener('change',statusFixSchedule);
}
// Make sure the final status-adjusted dice are what the core save routine reads.
document.addEventListener('click',e=>{
  if(e.target.closest('#saveBtn')) statusFixApply(false);
},true);
setTimeout(()=>statusFixApply(false),400);
setTimeout(()=>statusFixApply(false),1400);
