if(!document.getElementById('gmSaveBtn')){
  const legacy=document.createElement('button');
  legacy.id='gmSaveBtn';
  legacy.type='button';
  legacy.className='hidden';
  document.body.appendChild(legacy);
}
await import('./app-core.js?v=1');
await import('./gm-structured.js?v=1');
await import('./enhancements.js?v=2');
await import('./status-fix.js?v=1');
await import('./core-library.js?v=3');
await import('./rules-aware.js?v=2');
await import('./aestra-visuals.js?v=2');
await import('./aestra-theme.js?v=1');
await import('./resource-glow.js?v=1');
