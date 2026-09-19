const CACHE="optimus-v1";
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/manifest.webmanifest","/__grok/icon-192.png","/__grok/icon-512.png"]).catch(()=>{})));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET"||r.url.includes("/api/")||r.url.includes("/__"))return;e.respondWith(fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(ca=>ca.put(r,c)).catch(()=>{});return res}).catch(()=>caches.match(r)))});
