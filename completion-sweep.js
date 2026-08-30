// Final companion-suite loader. Kept separate from the legacy app boot so a single failed enhancement cannot block the sheet.
const load=async p=>{try{return await import(p)}catch(e){console.error('Aestra completion layer failed:',p,e);return null}};
await load('./campaign-settings.js?v=2');
await load('./rules-compendium-v2.js?v=1');
await load('./character-creation-v2.js?v=1');
await load('./aestra-session-suite.js?v=1');
await load('./pwa-register.js?v=2');
