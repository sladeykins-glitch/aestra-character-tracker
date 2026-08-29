if(!document.getElementById('gmSaveBtn')){
  const legacy=document.createElement('button');
  legacy.id='gmSaveBtn';
  legacy.type='button';
  legacy.className='hidden';
  document.body.appendChild(legacy);
}
// Compatibility repair for the GM MP Other control if older cached markup omitted it.
if(!document.getElementById('gmMpOther')){
  const host=document.getElementById('gmMpCurrent')?.closest('.gm-resource-edit > div');
  if(host){
    const label=document.createElement('label');
    label.textContent='Other';
    const input=document.createElement('input');
    input.id='gmMpOther';
    input.type='number';
    label.appendChild(input);
    host.appendChild(label);
  }
}

async function loadLayer(path){
  try{return await import(path)}
  catch(err){console.error(`Aestra layer failed: ${path}`,err);return null}
}

// Core mechanics first. Each presentation layer is isolated so one optional UI error
// can never stop the rest of the character sheet from loading.
await loadLayer('./app-core.js?v=1');
await loadLayer('./gm-structured.js?v=1');
await loadLayer('./enhancements.js?v=2');
await loadLayer('./status-fix.js?v=2');
await loadLayer('./core-library.js?v=6');
await loadLayer('./rules-aware.js?v=3');
await loadLayer('./aestra-visuals.js?v=2');
await loadLayer('./aestra-theme.js?v=1');
await loadLayer('./aestra-title-v2.js?v=2');
await loadLayer('./resource-glow.js?v=1');
await loadLayer('./compact-attributes.js?v=2');
await loadLayer('./compact-ip.js?v=1');
// magic-effects intentionally disabled: pointer trails and continuous animations were expensive on mobile.
await loadLayer('./build-menu.js?v=3');
await loadLayer('./ui-icons.js?v=2');
await loadLayer('./remove-controls.js?v=1');
await loadLayer('./skill-levels.js?v=2');
await loadLayer('./class-mastery.js?v=1');
await loadLayer('./picker-icons.js?v=2');
await loadLayer('./build-entry-icons.js?v=2');
// unique-icons intentionally disabled: semantic icons remain, without the extra DOM observer/decorating pass.
await loadLayer('./point-orbs.js?v=3');
await loadLayer('./sheet-polish.js?v=1');
await loadLayer('./conditions-collapse.js?v=3');
await loadLayer('./combat-ui-polish.js?v=1');
await loadLayer('./save-orb.js?v=1');
await loadLayer('./rules-orb.js?v=2');
await loadLayer('./grand-ui.js?v=1');
await loadLayer('./mobile-pages.js?v=1');
await loadLayer('./status-label-polish.js?v=1');
await loadLayer('./portrait-upload.js?v=1');
await loadLayer('./mobile-character-polish.js?v=1');
await loadLayer('./final-experience.js?v=1');
await loadLayer('./final-fixes.js?v=2');
await loadLayer('./final-refinement.js?v=2');
await loadLayer('./performance-lite.js?v=1');
await loadLayer('./equipment-workbench.js?v=2');
await loadLayer('./equipment-purchase.js?v=1');
await loadLayer('./trait-source-of-truth.js?v=1');