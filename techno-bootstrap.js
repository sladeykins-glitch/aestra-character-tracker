// Techno Fantasy integration bootstrap. Loaded after the main app so the final source/rules layers win cached earlier versions.
const load=async p=>{try{return await import(p)}catch(e){console.error('Techno Fantasy layer failed:',p,e);return null}};
await load('./rules-aware.js?v=5');
await load('./automatic-resources.js?v=5');
await load('./techno-custom-weapons.js?v=1');
await load('./esper-tools.js?v=1');
await load('./mutant-tools.js?v=1');
await load('./pilot-tools.js?v=1');
await load('./techno-fantasy-picker.js?v=2');
await load('./techno-heroic-picker.js?v=1');
await load('./completion-sweep.js?v=7');
