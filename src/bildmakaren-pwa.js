/**
 * PWA: service workern (bildmakaren-sw.js) gör att appen startar utan nät. Den fungerar bara över http(s).
 * Uppdateringar sker tyst: en ny version hämtas i bakgrunden och sidan laddas om först när appen läggs undan
 * (den syns inte då). Ingen ruta om ny version.
 */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('bildmakaren-sw.js').then((reg) => {
      // En hemskärmsapp startar sällan om på riktigt – leta efter ny version varje gång den visas igen.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    let had = !!navigator.serviceWorker.controller, fresh = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) fresh = true; had = true; });
    document.addEventListener('visibilitychange', () => { if (fresh && document.visibilityState === 'hidden') location.reload(); });
  });
}
