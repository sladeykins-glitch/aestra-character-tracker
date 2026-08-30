const CACHE='aestra-v122';
const SHELL=['./','./index.html','./styles.css?v=5','./aestra-icon.svg','./manifest.webmanifest','./version.json'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('aestra-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
function sameOrigin(req){try{return new URL(req.url).origin===self.location.origin}catch{return false}}
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET'||!sameOrigin(req))return;
  const url=new URL(req.url);
  if(url.pathname.endsWith('/version.json')){event.respondWith(fetch(req,{cache:'no-store'}).catch(()=>caches.match(req)));return}
  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',copy));return res}).catch(()=>caches.match('./index.html').then(r=>r||caches.match('./'))));return;
  }
  event.respondWith(fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return res}).catch(()=>caches.match(req)));
});
