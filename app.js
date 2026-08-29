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
await import('./app-core.js?v=1');
await import('./gm-structured.js?v=1');
await import('./enhancements.js?v=2');
await import('./status-fix.js?v=2');
await import('./core-library.js?v=5');
await import('./rules-aware.js?v=3');
await import('./aestra-visuals.js?v=2');
await import('./aestra-theme.js?v=1');
await import('./resource-glow.js?v=1');
await import('./compact-attributes.js?v=2');
await import('./compact-ip.js?v=1');
// magic-effects intentionally disabled: pointer trails and continuous animations were expensive on mobile.
await import('./build-menu.js?v=3');
await import('./ui-icons.js?v=2');
await import('./remove-controls.js?v=1');
await import('./skill-levels.js?v=2');
await import('./class-mastery.js?v=1');
await import('./picker-icons.js?v=2');
await import('./build-entry-icons.js?v=2');
// unique-icons intentionally disabled: semantic icons remain, without the extra DOM observer/decorating pass.
await import('./point-orbs.js?v=3');
await import('./sheet-polish.js?v=1');
await import('./conditions-collapse.js?v=3');
await import('./combat-ui-polish.js?v=1');
await import('./save-orb.js?v=1');
await import('./rules-orb.js?v=2');
await import('./grand-ui.js?v=1');
await import('./mobile-pages.js?v=1');
await import('./status-label-polish.js?v=1');
await import('./portrait-upload.js?v=1');
await import('./mobile-character-polish.js?v=1');
await import('./final-experience.js?v=1');
await import('./final-fixes.js?v=2');
await import('./traits-inline.js?v=2');
await import('./final-refinement.js?v=2');
await import('./performance-lite.js?v=1');
await import('./equipment-workbench.js?v=2');