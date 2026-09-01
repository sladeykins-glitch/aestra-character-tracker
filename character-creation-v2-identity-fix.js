// Character Creation v2 validation hotfix — all wizard steps.
// Keeps Continue and the validation hint synchronized with the visible creator state.
(function(){
  if(window.__AESTRA_CC2_VALIDATION_FIX__)return;
  window.__AESTRA_CC2_VALIDATION_FIX__=true;

  let observedModal=null, observer=null, raf=0;
  const schedule=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(sync)};
  const text=el=>el?.textContent?.trim()||'';

  function activeStep(modal){return text(modal.querySelector('.cc2-step.active b'))}

  function identityState(modal){
    const value=key=>modal.querySelector(`#cc2Body [data-draft="${key}"]`)?.value?.trim()||'';
    const valid=!!(value('name')&&value('identity')&&value('theme')&&value('origin'));
    return{valid,message:valid?'':'Enter a name, Identity, Theme and Origin.'};
  }

  function attributesState(modal){
    const rule=modal.querySelector('#cc2Body .cc2-rule');
    const valid=!!rule?.classList.contains('ok');
    return{valid,message:valid?'':text(rule)||'Choose a valid starting Attribute profile.'};
  }

  function classesState(modal){
    const articles=[...modal.querySelectorAll('#cc2Body .cc2-selected > article')];
    const counter=text(modal.querySelector('#cc2Body .cc2-counter'));
    const total=Number(counter.match(/^(\d+)/)?.[1]||0);
    const missingChoice=articles.find(a=>a.querySelector('.cc2-choice')&&!a.querySelector('.cc2-choice button.active'));
    if(articles.length<2||articles.length>3)return{valid:false,message:'Starting characters must have two or three Classes.'};
    if(total!==5)return{valid:false,message:'Distribute exactly five starting Class Levels.'};
    if(missingChoice){const name=text(missingChoice.querySelector('strong'))||'This Class';return{valid:false,message:`Choose ${name}'s +5 HP or +5 MP free benefit.`}}
    return{valid:true,message:''};
  }

  function skillsState(modal){
    const groups=[...modal.querySelectorAll('#cc2Body .cc2-skill-groups > section')];
    if(!groups.length)return{valid:false,message:'Assign your Class Skill Levels.'};
    for(const group of groups){
      const status=text(group.querySelector('header > span'));
      if(status!=='Ready'){
        const name=text(group.querySelector('header strong'))||'Class';
        return{valid:false,message:`${name}: assign all required Class Skill Levels.`};
      }
    }
    return{valid:true,message:''};
  }

  function stateFor(modal){
    switch(activeStep(modal)){
      case 'Identity': return identityState(modal);
      case 'Attributes': return attributesState(modal);
      case 'Classes': return classesState(modal);
      case 'Skills': return skillsState(modal);
      case 'Review': return{valid:true,message:''};
      default: return null;
    }
  }

  function sync(){
    const modal=document.getElementById('characterCreatorV2');
    if(!modal||modal.classList.contains('hidden'))return;
    const next=document.getElementById('cc2Next');
    const hint=document.getElementById('cc2Hint');
    if(!next||!hint)return;
    const state=stateFor(modal);
    if(!state)return; // Equipment intentionally hides Continue.
    next.disabled=!state.valid;
    hint.textContent=state.message;
    hint.classList.toggle('bad',!state.valid);
  }

  function attach(){
    const modal=document.getElementById('characterCreatorV2');
    if(!modal||modal===observedModal)return schedule();
    observer?.disconnect();
    observedModal=modal;
    observer=new MutationObserver(schedule);
    observer.observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
    schedule();
  }

  const relevant=e=>e.target?.closest?.('#characterCreatorV2');
  document.addEventListener('input',e=>{if(relevant(e))schedule()},true);
  document.addEventListener('change',e=>{if(relevant(e))schedule()},true);
  document.addEventListener('click',e=>{
    if(e.target?.closest?.('#characterCreatorBtn'))setTimeout(attach,0);
    if(relevant(e))setTimeout(()=>{attach();schedule()},0);
  },true);

  attach();
})();
