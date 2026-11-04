/* Service worker de MOTO-YA app.
   - La app (pantallas, estilos, fuentes, íconos) queda guardada en el celular.
   - data.json: primero intenta internet (para tener precios y stock del día); si no hay señal, usa la última copia.
   - Fotos: se sirven desde el celular; solo se descargan la primera vez.
   Para publicar una versión nueva de la app, cambia VERSION. Para actualizar solo los datos, basta con subir data.json. */
const VERSION = "1.0.0";
const SHELL = "motoya-app-" + VERSION;
const DATA = "motoya-data";
const IMG = "motoya-img-v1";
const ARCHIVOS = [
  "./", "index.html", "base.css", "app.css", "app.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/logo.webp", "icons/apple-touch-icon.png",
  "fonts/barlow-latin-400-normal.woff2", "fonts/barlow-latin-500-normal.woff2", "fonts/barlow-latin-600-normal.woff2",
  "fonts/barlow-latin-700-normal.woff2", "fonts/barlow-condensed-latin-600-normal.woff2",
  "fonts/barlow-condensed-latin-700-normal.woff2", "fonts/ibm-plex-mono-latin-600-normal.woff2"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(ARCHIVOS.map(u => new Request(u, { cache: "reload" })));
    try { const r = await fetch("data.json", { cache: "no-cache" }); if (r.ok) await (await caches.open(DATA)).put("data.json", r); } catch (_) {}
  })());
});

self.addEventListener("message", e => { if (e.data === "activar") self.skipWaiting(); });

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("motoya-app-") && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const path = url.pathname.slice(self.registration.scope.length - location.origin.length);

  if (path === "data.json") {
    e.respondWith((async () => {
      const c = await caches.open(DATA);
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
        const r = await fetch(req, { signal: ctl.signal, cache: "no-cache" }); clearTimeout(t);
        if (r.ok) { await c.put("data.json", r.clone()); return r; }
        throw new Error("HTTP " + r.status);
      } catch (_) {
        const m = await c.match("data.json");
        return m || new Response('{"error":"sin datos"}', { status: 503, headers: { "Content-Type": "application/json" } });
      }
    })());
    return;
  }

  if (path.startsWith("img/")) {
    e.respondWith((async () => {
      const c = await caches.open(IMG);
      const m = await c.match(req, { ignoreSearch: true });
      if (m) return m;
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return new Response("", { status: 404 }); }
    })());
    return;
  }

  // Resto: primero el celular, luego internet
  e.respondWith((async () => {
    const m = await caches.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await caches.match("index.html") : null);
    if (m) return m;
    try { return await fetch(req); }
    catch (_) { return req.mode === "navigate" ? (await caches.match("index.html")) : new Response("", { status: 504 }); }
  })());
});
