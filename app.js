if(!document.getElementById('gmSaveBtn')){
  const legacy=document.createElement('button');
  legacy.id='gmSaveBtn';
  legacy.type='button';
  legacy.className='hidden';
  document.body.appendChild(legacy);
}
// Start the stable core first, then install UI enhancements without waiting for
// Supabase/network initialization to finish. The core module starts initSupabase()
// asynchronously, so awaiting its module is enough to safely attach controls.
await import('./app-core.js?v=1');
await import('./gm-structured.js?v=1');
await import('./enhancements.js?v=2');
