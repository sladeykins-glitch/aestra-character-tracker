// Equipment workbench: Build equipment becomes a loadout pool, and only equipped items grant stats.
// No schema change is required: stowed items keep their original equipment data in a compact marker.
(function(){
  const MARK='§AESTRAEQ:';
  const SLOT_NAMES={weapon:'Weapon',armor:'Armor',shield:'Shield',accessory:'Accessory'};
  let selectedIndex=null;
  let dragIndex=null;
  let detailIndex=null;
  let renderQueued=false;

  const editor=()=>document.getElementById('equipmentEditor');
  const rows=()=>[...(editor()?.querySelectorAll('.entry-row')||[])];
  const inputs=row=>[...row.querySelectorAll('input,textarea,select')];
  const norm=v=>String(v||'').trim().toLowerCase();
  const num=v=>Number(v)||0;
  const page=()=>document.querySelector('#mobilePageShell .mobile-page[data-mobile-page="inventory"]')||document.getElementById('sheetView');

  function encode(obj){
    try{const bytes=new TextEncoder().encode(JSON.stringify(obj));let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s)}catch{return ''}
  }
  function decode(s){
    try{const bin=atob(s),bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}
  }
  function markerMeta(notes){const m=String(notes||'').match(/§AESTRAEQ:([A-Za-z0-9+/=]+)/);return m?decode(m[1]):null}
  function isStowed(row){const v=inputs(row);return norm(v[0]?.value).startsWith('loadout')||!!markerMeta(v[5]?.value)}
  function current(row){
    const v=inputs(row);return {slot:v[0]?.value||'',name:v[1]?.value||'',def:num(v[2]?.value),mdef:num(v[3]?.value),init:num(v[4]?.value),notes:v[5]?.value||''};
  }
  function effective(row){
    const c=current(row),meta=markerMeta(c.notes);
    if(meta)return {slot:meta.slot||'',name:c.name,def:num(meta.def),mdef:num(meta.mdef),init:num(meta.init),notes:meta.notes||'',stowed:true};
    return {...c,stowed:false};
  }
  function classify(data){
    const text=norm(`${data.slot} ${data.notes} ${data.name}`);
    if(/shield/.test(text))return 'shield';
    if(/armor|armour|robe|garb|mail|plate/.test(text))return 'armor';
    if(/accessor|amulet|ring|charm|talisman/.test(text))return 'accessory';
    if(/main hand|two hand|weapon|sword|dagger|spear|axe|bow|crossbow|gun|pistol|staff|tome|hammer|whip|knuckle|shuriken|rapier|katana/.test(text))return 'weapon';
    return 'any';
  }
  function twoHanded(data){return /two[- ]?hand/i.test(`${data.slot} ${data.notes}`)}
  function actualSlot(kind,data){
    if(kind==='weapon')return twoHanded(data)?'Two hands':'Main hand';
    if(kind==='armor')return 'Armor';
    if(kind==='shield')return 'Shield';
    if(kind==='accessory')return 'Accessory';
    return data.slot||'Equipment';
  }
  function setField(el,value){if(!el)return;el.value=String(value??'');if(typeof el.oninput==='function')el.oninput({target:el,type:'input'});}
  function commitRow(row,vals){
    const v=inputs(row);if(v.length<6)return;
    setField(v[0],vals.slot);setField(v[2],vals.def);setField(v[3],vals.mdef);setField(v[4],vals.init);setField(v[5],vals.notes);
    v[0].dispatchEvent(new Event('input',{bubbles:true}));
    v[0].dispatchEvent(new Event('change',{bubbles:true}));
    document.dispatchEvent(new CustomEvent('aestra:equipment-changed'));
  }
  function stowRow(row){
    if(!row||isStowed(row))return;
    const c=current(row),meta={slot:c.slot,def:c.def,mdef:c.mdef,init:c.init,notes:c.notes};
    const packed=encode(meta);if(!packed)return;
    commitRow(row,{slot:'Loadout',def:0,mdef:0,init:0,notes:`Stored in loadout\n${MARK}${packed}`});
  }
  function equippedRowFor(kind,except=null){return rows().find(r=>r!==except&&!isStowed(r)&&classify(effective(r))===kind)||null}
  function equipRow(row,kind){
    if(!row)return;
    const data=effective(row),itemKind=classify(data);
    if(itemKind!=='any'&&itemKind!==kind){toast(`${data.name||'That item'} belongs in ${SLOT_NAMES[itemKind]||itemKind}.`);return}
    const occupied=equippedRowFor(kind,row);if(occupied)stowRow(occupied);
    if(kind==='weapon'&&twoHanded(data)){const shield=equippedRowFor('shield',row);if(shield)stowRow(shield)}
    if(kind==='shield'){const weapon=equippedRowFor('weapon',row);if(weapon&&twoHanded(effective(weapon)))stowRow(weapon)}
    commitRow(row,{slot:actualSlot(kind,data),def:data.def,mdef:data.mdef,init:data.init,notes:data.notes});
    selectedIndex=null;queueRender();toast(`${data.name||'Item'} equipped. Stats updated.`);
  }
  function unequipIndex(index){const row=rows()[index];if(row){const name=effective(row).name;stowRow(row);selectedIndex=null;queueRender();toast(`${name||'Item'} moved to loadout.`)}}

  function statLine(d){const bits=[];if(d.def)bits.push(`DEF ${d.def>0?'+':''}${d.def}`);if(d.mdef)bits.push(`MDEF ${d.mdef>0?'+':''}${d.mdef}`);if(d.init)bits.push(`INIT ${d.init>0?'+':''}${d.init}`);return bits.length?bits.join(' · '):'No sheet stat modifiers'}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function icon(kind){return ({weapon:'⚔',armor:'⬟',shield:'◈',accessory:'✦',any:'◇'})[kind]||'◇'}

  function makeSlot(kind){
    const row=equippedRowFor(kind),all=rows(),idx=row?all.indexOf(row):-1,data=row?effective(row):null;
    return `<div class="equip-drop-slot ${row?'occupied':''}" data-equip-slot="${kind}"><div class="equip-slot-icon">${icon(kind)}</div><small>${SLOT_NAMES[kind]}</small>${data?`<strong>${esc(data.name||'Unnamed item')}</strong><span>${esc(statLine(data))}</span><button type="button" class="equip-unequip" data-unequip-index="${idx}">Unequip</button>`:`<strong>Empty</strong><span>Drop an item here</span>`}</div>`;
  }

  function cleanBuildEquipmentCards(){
    const cards=[...document.querySelectorAll('#buildMenuBody .build-entry-equipment')],all=rows();
    cards.forEach((card,i)=>{const row=all[i];if(!row||!isStowed(row))return;const d=effective(row),kind=classify(d),copy=card.querySelector('.build-entry-copy'),small=copy?.querySelector('small'),detail=copy?.querySelector(':scope > span');if(small)small.textContent=`Loadout · ${SLOT_NAMES[kind]||'Any slot'}`;if(detail)detail.textContent=[statLine(d),d.notes].filter(Boolean).join(' · ')});
  }
  function cleanEquipmentDetail(){
    if(detailIndex==null)return;const row=rows()[detailIndex],modal=document.getElementById('buildDetailModal');if(!row||!modal||!isStowed(row)||modal.classList.contains('hidden'))return;
    const d=effective(row),kind=classify(d),content=modal.querySelector('.build-detail-content');
    modal.querySelector('.build-detail-meta').textContent=`Loadout · ${SLOT_NAMES[kind]||'Any slot'}`;
    if(content)content.innerHTML=[['Item',d.name],['Status','In Build Loadout'],['Preferred Slot',d.slot||SLOT_NAMES[kind]||'Any'],['Defence',d.def],['Magic Defence',d.mdef],['Initiative',d.init],['Details',d.notes]].filter(([,v])=>v!==''&&v!=null).map(([l,v],i,a)=>`<section class="build-detail-field${i===a.length-1?' build-detail-main':''}"><small>${esc(l)}</small><div>${esc(v)}</div></section>`).join('');
  }

  function render(){
    renderQueued=false;const host=document.getElementById('equipmentWorkbench');if(!host)return;const all=rows();
    host.querySelector('.equip-slots').innerHTML=['weapon','armor','shield','accessory'].map(makeSlot).join('');
    const list=host.querySelector('.equip-loadout-list');
    if(!all.length)list.innerHTML='<div class="equip-empty">Choose equipment from the Build page and it will appear here.</div>';
    else list.innerHTML=all.map((row,i)=>{const d=effective(row),kind=classify(d),equipped=!isStowed(row);return `<button type="button" class="equip-pool-card ${equipped?'is-equipped':''} ${selectedIndex===i?'selected':''}" data-equip-index="${i}" draggable="${matchMedia('(pointer:fine)').matches?'true':'false'}"><span class="equip-pool-icon">${icon(kind)}</span><span class="equip-pool-copy"><strong>${esc(d.name||'Unnamed item')}</strong><small>${equipped?`Equipped · ${esc(current(row).slot)}`:`Loadout · ${SLOT_NAMES[kind]||'Any slot'}`}</small><em>${esc(statLine(d))}</em></span><span class="equip-pool-grip">${equipped?'✓':'⋮⋮'}</span></button>`}).join('');
    requestAnimationFrame(cleanBuildEquipmentCards);
  }
  function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(render)}

  let toastTimer=null;
  function toast(text){let t=document.getElementById('equipmentToast');if(!t){t=document.createElement('div');t.id='equipmentToast';t.className='equipment-toast';document.body.appendChild(t)}t.textContent=text;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),1700)}

  function installUI(){
    if(document.getElementById('equipmentWorkbench'))return;const target=page();if(!target)return;
    document.getElementById('inventoryLoadout')?.remove();
    const host=document.createElement('section');host.id='equipmentWorkbench';host.className='equipment-workbench';host.innerHTML=`<div class="equipment-workbench-head"><div><p class="eyebrow">EQUIPMENT</p><h2>Equipped Loadout</h2></div><small>Drag items into a slot · on touch, tap an item then a slot</small></div><div class="equip-slots"></div><div class="equip-pool-head"><div><strong>Build Loadout</strong><span>Items chosen on the Build → Equipment tab</span></div></div><div class="equip-loadout-list"></div>`;
    target.prepend(host);
    host.addEventListener('dragstart',e=>{const card=e.target.closest('[data-equip-index]');if(!card)return;dragIndex=Number(card.dataset.equipIndex);card.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(dragIndex))});
    host.addEventListener('dragend',e=>{e.target.closest('[data-equip-index]')?.classList.remove('dragging');dragIndex=null;host.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'))});
    host.addEventListener('dragover',e=>{const slot=e.target.closest('[data-equip-slot]');if(!slot)return;e.preventDefault();slot.classList.add('drag-over');e.dataTransfer.dropEffect='move'});
    host.addEventListener('dragleave',e=>{const slot=e.target.closest('[data-equip-slot]');if(slot&&!slot.contains(e.relatedTarget))slot.classList.remove('drag-over')});
    host.addEventListener('drop',e=>{const slot=e.target.closest('[data-equip-slot]');if(!slot)return;e.preventDefault();slot.classList.remove('drag-over');const idx=Number(e.dataTransfer.getData('text/plain'));if(Number.isInteger(idx))equipRow(rows()[idx],slot.dataset.equipSlot)});
    host.addEventListener('click',e=>{const un=e.target.closest('[data-unequip-index]');if(un){e.stopPropagation();unequipIndex(Number(un.dataset.unequipIndex));return}const card=e.target.closest('[data-equip-index]');if(card){selectedIndex=Number(card.dataset.equipIndex);queueRender();return}const slot=e.target.closest('[data-equip-slot]');if(slot&&selectedIndex!=null)equipRow(rows()[selectedIndex],slot.dataset.equipSlot)});
    render();
  }

  function installAutoStowForCorePicks(){
    const add=document.getElementById('addEquipmentBtn');if(!add)return;
    add.addEventListener('click',()=>{const modal=document.getElementById('coreLibraryModal'),fromCore=modal&&!modal.classList.contains('hidden')&&modal.dataset.mode==='equipment';if(!fromCore)return;setTimeout(()=>{const r=rows().at(-1);if(r&&!isStowed(r)&&current(r).name)stowRow(r);queueRender()},220)},true);
  }

  function installStyles(){
    if(document.getElementById('equipmentWorkbenchStyles'))return;const s=document.createElement('style');s.id='equipmentWorkbenchStyles';s.textContent=`
      .equipment-workbench{padding:15px;margin:0 0 12px;border:1px solid rgba(211,171,91,.26);border-radius:20px;background:linear-gradient(145deg,rgba(15,14,19,.82),rgba(8,10,14,.78));box-shadow:0 12px 30px rgba(0,0,0,.15)}
      .equipment-workbench-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:12px}.equipment-workbench-head h2{margin:2px 0 0;font:700 1.35rem/1.1 Georgia,serif;color:#ead8ae}.equipment-workbench-head small{font-size:.64rem;color:#8c8476}
      .equip-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.equip-drop-slot{position:relative;min-width:0;min-height:124px;padding:11px 9px;border:1px dashed rgba(211,171,91,.18);border-radius:15px;background:rgba(3,5,9,.3);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:4px;transition:border-color .12s ease,background .12s ease}.equip-drop-slot.occupied{border-style:solid;border-color:rgba(211,171,91,.3);background:radial-gradient(circle at 50% 12%,rgba(211,171,91,.07),rgba(3,5,9,.3) 62%)}.equip-drop-slot.drag-over{border-color:#e0bd72;background:rgba(126,92,43,.2)}.equip-slot-icon{font-size:1.35rem;color:#d3af63}.equip-drop-slot small{font-size:.5rem;letter-spacing:.13em;color:#8f8778}.equip-drop-slot strong{max-width:100%;font:700 .86rem/1.15 Georgia,serif;color:#ddd0b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.equip-drop-slot>span{max-width:100%;font-size:.55rem;color:#878073;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.equip-unequip{min-height:25px!important;margin-top:3px;padding:3px 7px!important;border-radius:999px!important;font-size:.52rem!important;background:rgba(100,53,42,.16)!important;border-color:rgba(192,103,85,.2)!important;color:#cba39a!important}
      .equip-pool-head{display:flex;justify-content:space-between;align-items:end;margin:15px 2px 7px;padding-top:12px;border-top:1px solid rgba(211,171,91,.1)}.equip-pool-head>div{display:grid;gap:2px}.equip-pool-head strong{font:700 1rem Georgia,serif;color:#dec99a}.equip-pool-head span{font-size:.58rem;color:#817a6e}.equip-loadout-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.equip-pool-card{min-width:0;display:grid!important;grid-template-columns:34px minmax(0,1fr) 24px;align-items:center;gap:8px;padding:10px!important;text-align:left!important;border:1px solid rgba(211,171,91,.13)!important;border-radius:13px!important;background:rgba(5,8,12,.38)!important;color:inherit!important;cursor:grab}.equip-pool-card:active{cursor:grabbing}.equip-pool-card.is-equipped{border-color:rgba(89,169,126,.22)!important;background:rgba(32,87,58,.09)!important}.equip-pool-card.selected{border-color:rgba(111,184,230,.52)!important;box-shadow:0 0 0 2px rgba(91,163,210,.08)!important}.equip-pool-card.dragging{opacity:.45}.equip-pool-icon{font-size:1.2rem;color:#d1ad60;text-align:center}.equip-pool-copy{display:grid;gap:2px;min-width:0}.equip-pool-copy strong{font-size:.84rem;color:#ddd0b5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.equip-pool-copy small{font-size:.56rem;color:#a9956b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.equip-pool-copy em{font-style:normal;font-size:.57rem;color:#7f8d91;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.equip-pool-grip{text-align:center;color:#857b69;font-size:.8rem}.equip-empty{grid-column:1/-1;padding:22px 10px;text-align:center;border:1px dashed rgba(211,171,91,.14);border-radius:13px;color:#817b70;font-size:.72rem}
      .equipment-toast{position:fixed;left:50%;bottom:88px;z-index:16000;transform:translate(-50%,10px);opacity:0;pointer-events:none;padding:8px 12px;border:1px solid rgba(211,171,91,.28);border-radius:999px;background:#101116;color:#e3d2aa;font-size:.7rem;transition:opacity .14s ease,transform .14s ease}.equipment-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:700px){.equipment-workbench{padding:10px;border-radius:17px}.equipment-workbench-head small{display:none}.equip-slots{grid-template-columns:repeat(2,minmax(0,1fr))}.equip-drop-slot{min-height:96px;padding:8px}.equip-loadout-list{grid-template-columns:1fr}.equip-pool-card{min-height:60px;cursor:pointer}.equipment-toast{bottom:78px;max-width:calc(100vw - 28px);text-align:center}}
      @media(prefers-reduced-motion:reduce){.equip-drop-slot,.equipment-toast{transition:none!important}}
    `;document.head.appendChild(s)
  }

  function install(){
    installStyles();installUI();installAutoStowForCorePicks();
    const ed=editor();if(ed){new MutationObserver(queueRender).observe(ed,{childList:true,subtree:false});ed.addEventListener('input',queueRender);ed.addEventListener('change',queueRender)}
    document.addEventListener('aestra:equipment-changed',queueRender);
    document.getElementById('buildMenu')?.addEventListener('click',e=>{const card=e.target.closest('.build-entry-equipment');if(card){detailIndex=[...document.querySelectorAll('#buildMenuBody .build-entry-equipment')].indexOf(card);setTimeout(cleanEquipmentDetail,35)}else setTimeout(cleanBuildEquipmentCards,0)},true);
    document.querySelector('#grandMobileNav [data-jump="inventory"]')?.addEventListener('click',()=>setTimeout(queueRender,30));
    setTimeout(queueRender,500);setTimeout(queueRender,1200);
  }
  setTimeout(install,0);
})();