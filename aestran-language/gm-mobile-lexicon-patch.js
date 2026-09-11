/* Aestran GM Player Lexicon compact mobile mode v4 */
(function(){
  const MOBILE_MAX=650;
  const MOBILE_LAYOUT_VERSION='aestra-gm-mobile-lexicon-layout-v4';
  const isMobileLexicon=()=>Math.max(320,window.innerWidth||1200)<=MOBILE_MAX;

  const style=document.createElement('style');
  style.textContent=`
  .lexicon-mobile-toggle{display:none}
  @media(max-width:650px){
    #playerLexicon .card:first-child{padding:12px 8px 10px}
    #playerLexicon .player-section-head{margin-bottom:10px;gap:8px}
    #playerLexicon .player-section-head h2{font-size:18px}
    #playerLexicon .player-section-head .muted{font-size:11px;line-height:1.35}
    #playerLexicon .lexicon-helper{display:none}
    #playerLexicon .player-stat-strip{margin:0 0 10px;gap:5px}
    #playerLexicon .player-stat{padding:5px 7px;font-size:9px;gap:5px}
    #playerLexicon .player-stat b{font-size:11px}
    #playerLexicon .lexicon-layout-tools{margin:7px 0 8px;padding:7px 8px;display:block}
    #playerLexicon .lexicon-layout-tools>.row{display:none;margin-top:7px}
    #playerLexicon .lexicon-layout-tools.mobile-open>.row{display:flex}
    #playerLexicon .lexicon-layout-tools .btn{font-size:10px;padding:6px 8px}
    #playerLexicon .lexicon-layout-status{font-size:10px;margin-top:5px}
    #playerLexicon .lexicon-mobile-toggle{display:flex;width:100%;align-items:center;justify-content:space-between}
    #playerLexicon .player-bubble-stage{margin-top:8px!important;border-radius:17px;overflow:hidden}
    #playerLexicon .glyph-cloud{padding:6px;position:relative;overflow:visible}
    #playerLexicon .glyph-bubble{box-shadow:0 7px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(5px)}
    #playerLexicon .glyph-bubble .bubble-label{font-size:6.5px;letter-spacing:.045em;line-height:1}
    #playerLexicon .glyph-bubble svg{width:60%;height:60%}
    #playerLexicon .glyph-bubble.active{z-index:30!important}
    #playerLexicon .glyph-bubble.active .bubble-label{font-size:7.5px}
    /* gm-mobile-v4-hard-size */
    #playerLexicon .glyph-bubble{min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;padding:0!important}
    #playerLexicon .glyph-bubble[data-aestra-compact="micro"]{width:36px!important;height:36px!important}
    #playerLexicon .glyph-bubble[data-aestra-compact="small"]{width:40px!important;height:40px!important}
    #playerLexicon .glyph-bubble[data-aestra-compact="word"]{width:42px!important;height:42px!important}
    #playerLexicon .glyph-bubble:not(.active){transform-origin:center center!important}
    #playerLexicon .glyph-bubble.active{transform-origin:center center!important}
    #playerLexicon .glyph-bubble.pinned:after{display:none!important}
    #playerLexicon .glyph-bubble.pinned:after{width:3px;height:3px}
    #playerLexicon .bubble-detail{margin-top:10px}
  }`;
  document.head.appendChild(style);

  function ensureMobileLayoutToggle(){
    const tools=document.querySelector('#playerLexicon .lexicon-layout-tools');
    if(!tools||tools.querySelector('.lexicon-mobile-toggle'))return;
    const toggle=document.createElement('button');
    toggle.className='btn ghost lexicon-mobile-toggle';
    toggle.type='button';
    toggle.innerHTML='<span>Layout</span><span aria-hidden="true">⌄</span>';
    toggle.onclick=()=>{
      tools.classList.toggle('mobile-open');
      const open=tools.classList.contains('mobile-open');
      toggle.lastElementChild.textContent=open?'⌃':'⌄';
    };
    tools.insertBefore(toggle,tools.firstChild);
  }

  layoutLexiconBubble=function(simItem){
    const mobile=isMobileLexicon();
    const active=simItem.id===appState.selectedPlayerGlyph;
    const dense=mobile&&(lexiconSim.items?.length||0)>48;
    const scale=active?(mobile?(dense?1.7:1.9):1.05):1;
    simItem.el.classList.toggle('pinned',!!simItem.pinned);
    simItem.el.style.zIndex=active?'30':'2';
    simItem.el.style.transform=`translate3d(${simItem.x-simItem.r}px,${simItem.y-simItem.r}px,0) scale(${scale})`;
  };

  lexiconArrangeTargets=function(items,width,height){
    if(!isMobileLexicon()){
      const count=items.length,cols=Math.max(3,Math.min(6,Math.ceil(Math.sqrt(count*1.22)))),rows=Math.ceil(count/cols);
      return items.map((it,i)=>{
        const col=i%cols,row=Math.floor(i/cols),stagger=(row%2?0.035:-0.018);
        const x=(0.08+(col+.5)*(0.84/cols)+stagger)*width;
        const y=(0.10+(row+.6)*(0.78/Math.max(1,rows)))*height;
        return {x:Math.max(it.r,Math.min(width-it.r,x)),y:Math.max(it.r,Math.min(height-it.r,y))};
      });
    }
    const maxD=Math.max(44,...items.map(it=>it.size||44));
    const cols=Math.max(4,Math.min(7,Math.floor((width-14)/(maxD+5))));
    const rows=Math.max(1,Math.ceil(items.length/cols));
    const padX=8,padY=10;
    const cellW=(width-padX*2)/cols;
    const cellH=(height-padY*2)/rows;
    return items.map((it,i)=>{
      const col=i%cols,row=Math.floor(i/cols);
      const stagger=(row%2?cellW*.20:0);
      let x=padX+(col+.5)*cellW+stagger;
      if(x>width-it.r-4)x-=cellW*.34;
      const y=padY+(row+.5)*cellH;
      return {x:Math.max(it.r+3,Math.min(width-it.r-3,x)),y:Math.max(it.r+3,Math.min(height-it.r-3,y))};
    });
  };

  autoArrangeLexicon=function(){
    const cloud=lexiconSim.cloud,items=lexiconSim.items||[];if(!cloud||!items.length)return;
    const width=Math.max(isMobileLexicon()?260:320,cloud.clientWidth);
    let height=cloud.clientHeight;
    if(isMobileLexicon()){
      const maxD=Math.max(44,...items.map(it=>it.size||44));
      const cols=Math.max(4,Math.min(7,Math.floor((width-14)/(maxD+5))));
      const rows=Math.ceil(items.length/cols);
      height=Math.max(350,rows*(maxD+8)+20);
      cloud.style.height=height+'px';cloud.style.minHeight=height+'px';
      const stage=document.querySelector('#playerLexicon .player-bubble-stage');
      if(stage){stage.style.height=height+'px';stage.style.minHeight=height+'px';}
    }else height=Math.max(560,height);
    const targets=lexiconArrangeTargets(items,width,height);
    cloud.classList.add('arranging');
    items.forEach((it,i)=>{
      it.x=targets[i].x;it.y=targets[i].y;it.anchorX=it.x;it.anchorY=it.y;it.vx=0;it.vy=0;it.pinned=true;
      appState.lexiconBubblePositions[it.id]={x:it.x/width,y:it.y/height};
      layoutLexiconBubble(it);
    });
    saveLexiconBubblePositions();updateLexiconLayoutStatus();setTimeout(()=>cloud.classList.remove('arranging'),650);
  };

  function compactMobileSize(item,count){
    if(!isMobileLexicon())return item.type==='Compound glyph'?110:96;
    if(count>48)return item.type==='Compound glyph'?42:36;
    if(count>36)return item.type==='Compound glyph'?44:38;
    if(count>24)return item.type==='Compound glyph'?46:40;
    return item.type==='Compound glyph'?50:44;
  }

  function migrateOldMobileLexiconLayout(){
    if(!isMobileLexicon())return;
    try{
      if(localStorage.getItem(MOBILE_LAYOUT_VERSION)==='1')return;
      appState.lexiconBubblePositions={};
      saveLexiconBubblePositions();
      localStorage.setItem(MOBILE_LAYOUT_VERSION,'1');
    }catch(_){
      appState.lexiconBubblePositions={};
      try{saveLexiconBubblePositions()}catch(__){}
    }
  }

  startLexiconPhysics=function(items){
    stopLexiconSim();
    const cloud=document.getElementById('playerGlyphCloud');
    const stage=document.querySelector('#playerLexicon .player-bubble-stage');
    if(!cloud||!stage)return;

    const mobile=isMobileLexicon();
    if(mobile)migrateOldMobileLexiconLayout();
    const rect=cloud.getBoundingClientRect();
    const width=Math.max(mobile?260:320,cloud.clientWidth||rect.width||600);

    let cols,rows,height;
    if(mobile){
      const maxD=Math.max(36,...items.map(it=>compactMobileSize(it,items.length)));
      cols=Math.max(5,Math.min(7,Math.floor((width-12)/(maxD+5))));
      rows=Math.max(1,Math.ceil(items.length/cols));
      height=Math.max(350,rows*(maxD+8)+20);
      cloud.style.height=height+'px';cloud.style.minHeight=height+'px';
      stage.style.height=height+'px';stage.style.minHeight=height+'px';
    }else{
      height=Math.max(560,cloud.clientHeight||rect.height||560);
      cols=Math.max(3,Math.min(5,Math.ceil(Math.sqrt(items.length))));
      rows=Math.ceil(items.length/cols);
    }

    lexiconSim.cloud=cloud;lexiconSim.stage=stage;
    const simItems=[...cloud.querySelectorAll('[data-pglyph]')].map((el,i)=>{
      const item=items[i],col=i%cols,row=Math.floor(i/cols);
      const size=mobile?compactMobileSize(item,items.length):(item.type==='Compound glyph'?110+(i%3)*8:92+(i%4)*10);
      el.style.width=size+'px';el.style.height=size+'px';
      if(mobile)el.dataset.aestraCompact=item.type==='Compound glyph'?'word':(items.length>48?'micro':'small');
      const fallback=lexiconArrangeTargets(Array.from({length:items.length},(_,j)=>{const s=mobile?compactMobileSize(items[j],items.length):100;return {r:s/2,size:s}}),width,height)[i];
      const saved=appState.lexiconBubblePositions?.[item.id];
      const x=saved?Math.max(size/2,Math.min(width-size/2,saved.x*width)):fallback.x;
      const y=saved?Math.max(size/2,Math.min(height-size/2,saved.y*height)):fallback.y;
      return {id:item.id,el,x,y,vx:saved?0:(Math.random()-.5)*(mobile?.10:.25),vy:saved?0:(Math.random()-.5)*(mobile?.08:.25),r:size/2,size,anchorX:x,anchorY:y,pinned:!!saved,phase:Math.random()*Math.PI*2,pointerMoved:false,pointerStart:null,lastPointer:null};
    });

    lexiconSim.items=simItems;
    updateBubbleActiveState();
    simItems.forEach(layoutLexiconBubble);
    updateLexiconLayoutStatus();

    function getPoint(ev){const r=cloud.getBoundingClientRect();return{x:ev.clientX-r.left,y:ev.clientY-r.top}}
    function pointerMove(ev){
      const d=lexiconSim.drag;if(!d)return;const p=getPoint(ev);
      d.pointerMoved=d.pointerMoved||Math.hypot(p.x-d.pointerStart.x,p.y-d.pointerStart.y)>6;
      d.vx=(p.x-d.lastPointer.x)*.22;d.vy=(p.y-d.lastPointer.y)*.22;
      d.x=Math.max(d.r,Math.min(width-d.r,p.x));d.y=Math.max(d.r,Math.min(height-d.r,p.y));d.lastPointer=p;
    }
    function pointerUp(){
      const d=lexiconSim.drag;if(!d)return;d.el.classList.remove('dragging');
      if(!d.pointerMoved){
        if(mobile&&appState.selectedPlayerGlyph===d.id){
          appState.selectedPlayerGlyph=null;
          updateBubbleActiveState();
          simItems.forEach(layoutLexiconBubble);
        }else{
          appState.selectedPlayerGlyph=d.id;renderPlayerGlyphDetail(d.id);updateBubbleActiveState();simItems.forEach(layoutLexiconBubble);
        }
      }else{
        d.anchorX=d.x;d.anchorY=d.y;d.vx=0;d.vy=0;d.pinned=true;
        appState.lexiconBubblePositions[d.id]={x:d.x/width,y:d.y/height};saveLexiconBubblePositions();updateLexiconLayoutStatus();
      }
      lexiconSim.drag=null;
    }
    function pointerCancel(){const d=lexiconSim.drag;if(!d)return;d.el.classList.remove('dragging');lexiconSim.drag=null;layoutLexiconBubble(d)}
    const resizeHandler=()=>{if(lexiconSim.resizeTimer)clearTimeout(lexiconSim.resizeTimer);lexiconSim.resizeTimer=setTimeout(()=>{if(appState.role==='player'&&appState.screen==='playerLexicon')startLexiconPhysics(items)},140)};

    lexiconSim.boundPointerMove=pointerMove;lexiconSim.boundPointerUp=pointerUp;lexiconSim.boundPointerCancel=pointerCancel;lexiconSim.boundResize=resizeHandler;
    window.addEventListener('pointermove',pointerMove);window.addEventListener('pointerup',pointerUp);window.addEventListener('pointercancel',pointerCancel);window.addEventListener('resize',resizeHandler);

    const emptyTap=ev=>{
      if(!mobile)return;
      if(ev.target===cloud||ev.target===stage){
        appState.selectedPlayerGlyph=null;updateBubbleActiveState();simItems.forEach(layoutLexiconBubble);const detail=document.getElementById('playerGlyphDetail');if(detail)detail.innerHTML='<div class="muted" style="padding:10px 0">Tap a glyph in the Lexicon to inspect what the party currently understands.</div>';
      }
    };
    cloud.addEventListener('pointerdown',emptyTap);

    simItems.forEach(it=>it.el.addEventListener('pointerdown',ev=>{
      ev.preventDefault();const p=getPoint(ev);lexiconSim.drag=it;it.pointerMoved=false;it.pointerStart=p;it.lastPointer=p;it.el.classList.add('dragging');it.el.setPointerCapture?.(ev.pointerId);
    }));

    function step(ts){
      const dt=Math.min(1.2,(ts-(lexiconSim.last||ts))/16.666);lexiconSim.last=ts;
      for(const it of simItems){
        if(lexiconSim.drag===it||it.pinned)continue;
        const tx=it.anchorX+Math.sin(ts*.00055+it.phase)*(mobile?3:8);
        const ty=it.anchorY+Math.cos(ts*.00042+it.phase*1.2)*(mobile?2.5:6);
        it.vx+=(tx-it.x)*.0016*dt;it.vy+=(ty-it.y)*.0016*dt;it.vx*=.992;it.vy*=.992;
      }
      for(let i=0;i<simItems.length;i++)for(let j=i+1;j<simItems.length;j++){
        const a=simItems[i],b=simItems[j];let dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy)||.001;
        const min=a.r+b.r+(mobile?4:2);
        if(dist<min){const overlap=min-dist;dx/=dist;dy/=dist;const push=overlap*.52;
          if(lexiconSim.drag!==a&&!a.pinned){a.x-=dx*push;a.y-=dy*push;a.vx-=dx*.12*dt;a.vy-=dy*.12*dt}
          if(lexiconSim.drag!==b&&!b.pinned){b.x+=dx*push;b.y+=dy*push;b.vx+=dx*.12*dt;b.vy+=dy*.12*dt}
        }
      }
      for(const it of simItems){
        if(lexiconSim.drag!==it&&!it.pinned){it.x+=it.vx*dt;it.y+=it.vy*dt}
        if(it.x<it.r){it.x=it.r;it.vx=it.pinned?0:Math.abs(it.vx)*.7}
        if(it.x>width-it.r){it.x=width-it.r;it.vx=it.pinned?0:-Math.abs(it.vx)*.7}
        if(it.y<it.r){it.y=it.r;it.vy=it.pinned?0:Math.abs(it.vy)*.7}
        if(it.y>height-it.r){it.y=height-it.r;it.vy=it.pinned?0:-Math.abs(it.vy)*.7}
        layoutLexiconBubble(it);
      }
      lexiconSim.raf=requestAnimationFrame(step);
    }
    lexiconSim.raf=requestAnimationFrame(step);
  };

  const previousRenderPlayerGlyphCloud=renderPlayerGlyphCloud;
  renderPlayerGlyphCloud=function(items){
    if(!isMobileLexicon())return previousRenderPlayerGlyphCloud(items);
    const cloud=document.getElementById('playerGlyphCloud');
    const detail=document.getElementById('playerGlyphDetail');
    if(!items.length){
      stopLexiconSim();cloud.innerHTML='<div class="muted">No discovered glyphs yet.</div>';detail.innerHTML='<div class="muted">Discover some glyphs first.</div>';updateLexiconLayoutStatus();return;
    }
    const selected=items.find(x=>x.id===appState.selectedPlayerGlyph)||null;
    if(appState.selectedPlayerGlyph&&!selected)appState.selectedPlayerGlyph=null;
    const width=Math.max(260,cloud.clientWidth||window.innerWidth-44);
    migrateOldMobileLexiconLayout();
    const maxD=Math.max(36,...items.map(it=>compactMobileSize(it,items.length)));
    const cols=Math.max(5,Math.min(7,Math.floor((width-12)/(maxD+5))));
    const rows=Math.ceil(items.length/cols);
    const h=Math.max(320,rows*(maxD+7)+18);
    cloud.style.height=h+'px';cloud.style.minHeight=h+'px';
    const stage=document.querySelector('#playerLexicon .player-bubble-stage');if(stage){stage.style.height=h+'px';stage.style.minHeight=h+'px';}
    cloud.innerHTML=items.map(item=>{
      const size=compactMobileSize(item,items.length);
      const density=item.type==='Compound glyph'?'word':(items.length>48?'micro':'small');
      return `<button class="glyph-bubble ${appState.selectedPlayerGlyph===item.id?'active':''}" data-pglyph="${item.id}" data-aestra-compact="${density}" style="width:${size}px!important;height:${size}px!important">${glyphSVG(item.id,Math.round(size*.58))}<div class="bubble-label">${item.id}</div></button>`;
    }).join('');
    if(appState.selectedPlayerGlyph)renderPlayerGlyphDetail(appState.selectedPlayerGlyph);
    else if(detail)detail.innerHTML='<div class="muted" style="padding:10px 0">Tap a glyph in the Lexicon to inspect what the party currently understands.</div>';
    ensureMobileLayoutToggle();
    if(appState.role==='player'&&appState.screen==='playerLexicon')startLexiconPhysics(items);else stopLexiconSim();
  };

  const compactRenderPlayerGlyphCloud=renderPlayerGlyphCloud;

  function currentCompactLexiconItems(){
    let ids=(lexiconSim.items||[]).map(it=>it.id).filter(Boolean);
    if(!ids.length)ids=[...document.querySelectorAll('#playerGlyphCloud [data-pglyph]')].map(el=>el.dataset.pglyph).filter(Boolean);
    return ids.map(id=>({id,type:(typeof compoundMap!=='undefined'&&compoundMap[id])?'Compound glyph':'Root glyph'}));
  }

  function resetMobileLexiconLayout(){
    appState.lexiconBubblePositions={};
    saveLexiconBubblePositions();
    if(!isMobileLexicon()){
      if(typeof resetLexiconLayout==='function')resetLexiconLayout();
      return;
    }
    appState.selectedPlayerGlyph=null;
    const items=currentCompactLexiconItems();
    stopLexiconSim();
    const detail=document.getElementById('playerGlyphDetail');
    if(detail)detail.innerHTML='<div class="muted" style="padding:10px 0">Tap a glyph in the Lexicon to inspect what the party currently understands.</div>';
    if(items.length)compactRenderPlayerGlyphCloud(items);
    else if(typeof renderPlayer==='function')renderPlayer();
    updateLexiconLayoutStatus();
  }

  const oldAuto=document.getElementById('lexiconAutoArrange');if(oldAuto)oldAuto.onclick=autoArrangeLexicon;
  const oldReset=document.getElementById('lexiconResetLayout');if(oldReset)oldReset.onclick=resetMobileLexiconLayout;
  ensureMobileLayoutToggle();
})();