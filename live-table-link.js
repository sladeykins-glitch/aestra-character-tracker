(function installLiveTableLink(){
  const add=()=>{
    const gmHead=document.querySelector('#gmView .gm-head');
    if(!gmHead||gmHead.querySelector('[data-live-table-link]'))return;
    const existing=gmHead.querySelector('#refreshGmBtn');
    const button=document.createElement('button');
    button.type='button';
    button.className='primary';
    button.dataset.liveTableLink='1';
    button.textContent='Open Live Table';
    button.addEventListener('click',()=>window.open('live-table.html','aestra-live-table'));
    if(existing)existing.parentElement?.insertBefore(button,existing);
    else gmHead.appendChild(button);
  };
  add();
  const observer=new MutationObserver(add);
  observer.observe(document.documentElement,{childList:true,subtree:true});
})();