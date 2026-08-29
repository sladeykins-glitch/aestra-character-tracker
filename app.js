if(!document.getElementById('gmSaveBtn')){
  const legacy=document.createElement('button');
  legacy.id='gmSaveBtn';
  legacy.type='button';
  legacy.className='hidden';
  document.body.appendChild(legacy);
}
await import('./app-core.js?v=1');
await import('./gm-structured.js?v=1');
await import('./enhancements.js?v=1');
