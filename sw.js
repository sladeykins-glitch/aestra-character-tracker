const CACHE='aestra-v145-stabilisation';
const SHELL=['./','./index.html','./styles.css?v=5','./aestra-icon.svg','./manifest.webmanifest','./version.json','./app.js?v=79','./techno-bootstrap.js?v=4','./hero-console-v2.js?v=1','./compact-header.js?v=2','./performance-lite.js?v=2','./skill-levels.js?v=3','./character-creation-v2-identity-fix.js?v=2','./completion-sweep.js?v=21','./opening-cinematic.js?v=4','./opening-cinematic-interaction-fix.js?v=1','./ambient-music.js?v=3','./build-remove-controls-final.js?v=2','./unified-build-library-v3.js?v=1','./build-library-startup-guard.js?v=1','./class-skill-level-sync.js?v=1','./level-up-v2.js?v=1','./inventory-navigation-v2.js?v=1','./picker-navigation-fix.js?v=1','./pwa-register.js?v=19'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL.map(x=>new Request(x,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('aestra-')&&k!==CACHE).map(k=>caches.delete(k)));await self.clients.claim()})())});
function sameOrigin(req){try{return new URL(req.url).origin===self.location.origin}catch{return false}}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET'||!sameOrigin(req))return;
  const url=new URL(req.url);
  if(url.pathname.endsWith('/version.json')){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));return}
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'reload'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));return;
  }
  const forceFresh=/\.(?:js|css)$/.test(url.pathname);
  event.respondWith(fetch(req,forceFresh?{cache:'reload'}:undefined).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res}).catch(()=>caches.match(req)));
});