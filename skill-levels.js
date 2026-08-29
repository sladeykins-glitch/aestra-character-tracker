const SKILL_CONFIG=window.AESTRA_CONFIG||{};
let skillLevelClient=null;
let skillRankCache=null;

async function getSkillLevelClient(){
  if(skillLevelClient)return skillLevelClient;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  skillLevelClient=mod.createClient(SKILL_CONFIG.supabaseUrl,SKILL_CONFIG.supabaseAnonKey);
  return skillLevelClient;
}

async function loadSkillRanks(){
  if(skillRankCache)return skillRankCache;
  const sb=await getSkillLevelClient();
  const {data,error}=await sb.from('rule_class_skills')
    .select('name,max_rank,rule_classes!inner(name,source_id)')
    .eq('rule_classes.source_id','core-1.02');
  if(error)throw error;
  skillRankCache=(data||[]).map(x=>({
    name:String(x.name||'').trim(),
    className:String(x.rule_classes?.name||'').trim(),
    maxRank:Number(x.max_rank)||1
  }));
  return skillRankCache;
}

function normSkill(v){return String(v||'').trim().toLowerCase()}
function skillRows(){return [...document.querySelectorAll('#skillsEditor .entry-row')]}
function skillCards(){return [...document.querySelectorAll('#buildMenuBody .build-entry-skills')]}
function rowValues(row){return [...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim())}
function classRows(){return [...document.querySelectorAll('#classesEditor .entry-row')]}
function findClassRow(source){
  const wanted=normSkill(source);
  if(!wanted)return null;
  return classRows().find(row=>normSkill(rowValues(row)[0])===wanted)||null;
}
function classLevelInfo(source){
  const row=findClassRow(source);
  if(!row)return null;
  const inputs=row.querySelectorAll('input,textarea,select');
  const input=inputs[1];
  if(!input)return null;
  return {row,input,level:Math.max(1,Number(input.value)||1)};
}
function changeClassLevel(source,delta){
  const info=classLevelInfo(source);
  if(!info)return {ok:false,reason:'missing'};
  const next=Math.max(1,Math.min(10,info.level+delta));
  if(next===info.level)return {ok:false,reason:delta>0?'max':'min',level:info.level};
  info.input.value=String(next);
  info.input.dispatchEvent(new Event('input',{bubbles:true}));
  info.input.dispatchEvent(new Event('change',{bubbles:true}));
  return {ok:true,level:next};
}

async function getMaxRank(name,source){
  try{
    const ranks=await loadSkillRanks();
    const n=normSkill(name),s=normSkill(source);
    const exact=ranks.find(x=>normSkill(x.name)===n&&normSkill(x.className)===s);
    const byName=ranks.find(x=>normSkill(x.name)===n);
    return Number((exact||byName)?.maxRank)||1;
  }catch(e){
    console.warn('Could not load skill rank data',e);
    return 1;
  }
}

function updateSkillLevelField(level){
  const fields=[...document.querySelectorAll('#buildDetailModal .build-detail-field')];
  const field=fields.find(f=>normSkill(f.querySelector('small')?.textContent)==='skill level');
  const value=field?.querySelector('div');
  if(value)value.textContent=String(level);
  const meta=document.querySelector('#buildDetailModal .build-detail-meta');
  if(meta)meta.textContent=meta.textContent.replace(/SL\s+\d+/i,`SL ${level}`);
}

function levelBurst(pip,down=false){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  pip.classList.remove('skill-pip-up','skill-pip-down');
  void pip.offsetWidth;
  pip.classList.add(down?'skill-pip-down':'skill-pip-up');
  setTimeout(()=>pip.classList.remove('skill-pip-up','skill-pip-down'),480);
}

function drawControl(row,maxRank,source){
  const modal=document.getElementById('buildDetailModal');
  const content=modal?.querySelector('.build-detail-content');
  if(!content)return;
  content.querySelector('.skill-level-control')?.remove();
  if(maxRank<=1)return;

  const inputs=row.querySelectorAll('input,textarea,select');
  const rankInput=inputs[1];
  if(!rankInput)return;
  let rank=Math.max(1,Math.min(maxRank,Number(rankInput.value)||1));
  rankInput.value=String(rank);

  const section=document.createElement('section');
  section.className='skill-level-control';
  section.innerHTML=`
    <div class="skill-level-top">
      <div><small>SKILL LEVEL</small><strong class="skill-level-readout">SL ${rank} / ${maxRank}</strong></div>
      <span class="skill-level-note">Changing SL also changes ${source||'its class'} level</span>
    </div>
    <div class="skill-level-stepper">
      <button type="button" class="skill-level-minus" aria-label="Decrease skill level">−</button>
      <div class="skill-level-pips" aria-label="${rank} of ${maxRank} skill levels"></div>
      <button type="button" class="skill-level-plus" aria-label="Increase skill level">+</button>
    </div>`;
  content.prepend(section);

  const pipWrap=section.querySelector('.skill-level-pips');
  const useCompact=maxRank>6;
  pipWrap.classList.toggle('compact',useCompact);
  for(let i=1;i<=maxRank;i++){
    const pip=document.createElement('span');
    pip.className=`skill-level-pip${i<=rank?' filled':''}`;
    pip.dataset.level=String(i);
    pip.innerHTML='<i></i>';
    pipWrap.appendChild(pip);
  }

  const minus=section.querySelector('.skill-level-minus');
  const plus=section.querySelector('.skill-level-plus');
  const readout=section.querySelector('.skill-level-readout');

  function sync(direction=0){
    rank=Math.max(1,Math.min(maxRank,Number(rankInput.value)||1));
    const cls=classLevelInfo(source);
    readout.textContent=`SL ${rank} / ${maxRank}`;
    minus.disabled=rank<=1||Boolean(cls&&cls.level<=1);
    plus.disabled=rank>=maxRank||Boolean(cls&&cls.level>=10);
    plus.title=cls&&cls.level>=10?'This class is already level 10':'';
    [...pipWrap.children].forEach((p,i)=>p.classList.toggle('filled',i<rank));
    pipWrap.setAttribute('aria-label',`${rank} of ${maxRank} skill levels`);
    updateSkillLevelField(rank);
    const active=[...pipWrap.children][rank-1];
    if(direction&&active)levelBurst(active,direction<0);
  }

  function setRank(next,direction){
    const old=rank;
    const wanted=Math.max(1,Math.min(maxRank,next));
    if(wanted===old)return;
    const delta=wanted-old;
    const cls=classLevelInfo(source);
    if(cls){
      const changed=changeClassLevel(source,delta);
      if(!changed.ok)return;
    }
    rank=wanted;
    rankInput.value=String(rank);
    rankInput.dispatchEvent(new Event('input',{bubbles:true}));
    rankInput.dispatchEvent(new Event('change',{bubbles:true}));
    sync(direction);
  }

  minus.onclick=e=>{e.stopPropagation();setRank(rank-1,-1)};
  plus.onclick=e=>{e.stopPropagation();setRank(rank+1,1)};
  sync();
}

async function enhanceOpenedSkill(card){
  const cards=skillCards();
  const index=cards.indexOf(card);
  if(index<0)return;
  const row=skillRows()[index];
  if(!row)return;
  const v=rowValues(row);
  const name=v[0],source=v[2];
  const maxRank=await getMaxRank(name,source);
  const modal=document.getElementById('buildDetailModal');
  if(!modal||modal.classList.contains('hidden'))return;
  if(normSkill(modal.querySelector('.build-detail-title')?.textContent)!==normSkill(name))return;
  drawControl(row,maxRank,source);
}

document.addEventListener('click',e=>{
  const card=e.target.closest('.build-entry-skills');
  if(card)setTimeout(()=>enhanceOpenedSkill(card),0);
});

const style=document.createElement('style');
style.textContent=`
.skill-level-control{margin:0 0 18px;padding:16px;border:1px solid rgba(126,202,255,.28);border-radius:15px;background:linear-gradient(120deg,rgba(72,140,198,.09),rgba(217,177,96,.06));box-shadow:inset 0 0 24px rgba(90,174,235,.04)}
.skill-level-top{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:13px}.skill-level-top>div{display:grid;gap:3px}.skill-level-top small{letter-spacing:.15em;color:#d9be79;font-size:.7rem}.skill-level-readout{font-size:1.08rem;color:#f1e4b9}.skill-level-note{font-size:.72rem;opacity:.52;text-align:right}
.skill-level-stepper{display:grid;grid-template-columns:44px 1fr 44px;gap:11px;align-items:center}.skill-level-stepper button{height:42px!important;padding:0!important;font-size:1.4rem!important;border:1px solid rgba(216,177,96,.3)!important;background:rgba(7,12,19,.62)!important;color:#e7d292!important;border-radius:11px!important}.skill-level-stepper button:disabled{opacity:.25!important;cursor:default}.skill-level-pips{display:flex;justify-content:center;align-items:center;gap:9px;min-height:40px}.skill-level-pips.compact{gap:5px}.skill-level-pip{position:relative;width:22px;height:22px;transform:rotate(45deg);border:1px solid rgba(132,192,225,.32);background:rgba(12,24,33,.68);box-shadow:inset 0 0 10px rgba(0,0,0,.45);transition:background .18s ease,border-color .18s ease,box-shadow .18s ease,transform .18s ease}.skill-level-pips.compact .skill-level-pip{width:17px;height:17px}.skill-level-pip i{position:absolute;inset:4px;border:1px solid rgba(255,255,255,.06)}.skill-level-pip.filled{border-color:rgba(153,218,255,.85);background:linear-gradient(135deg,rgba(92,194,255,.75),rgba(128,92,210,.56));box-shadow:0 0 14px rgba(83,183,255,.42),inset 0 0 8px rgba(232,247,255,.32)}
.skill-level-pip.skill-pip-up{animation:skillCrystalFill .42s ease}.skill-level-pip.skill-pip-down{animation:skillCrystalCrack .42s ease}
@keyframes skillCrystalFill{0%{transform:rotate(45deg) scale(.6);filter:brightness(2.2)}45%{transform:rotate(45deg) scale(1.32);filter:brightness(2)}100%{transform:rotate(45deg) scale(1);filter:brightness(1)}}
@keyframes skillCrystalCrack{0%{transform:rotate(45deg) scale(1);filter:brightness(1.7)}35%{transform:rotate(50deg) scale(1.22);filter:brightness(2.1)}100%{transform:rotate(45deg) scale(1);filter:brightness(1)}}
@media(max-width:600px){.skill-level-top{align-items:start}.skill-level-note{display:none}.skill-level-stepper{grid-template-columns:42px 1fr 42px;gap:7px}.skill-level-pips{gap:6px}.skill-level-pip{width:18px;height:18px}.skill-level-pips.compact{gap:3px}.skill-level-pips.compact .skill-level-pip{width:14px;height:14px}}
@media(prefers-reduced-motion:reduce){.skill-level-pip{transition:none!important}.skill-level-pip.skill-pip-up,.skill-level-pip.skill-pip-down{animation:none!important}}
`;
document.head.appendChild(style);
