// registerSW.js — turns on offline support.
//
// Imported from PathfinderSheet.jsx so it ends up in the bundle. Nothing in
// index.html needs editing, which matters because the build regenerates it.
//
// Safe to call always: if the browser has no service worker support, or the
// page is opened over file://, it quietly does nothing.

let registration = null;

export function registerSW(onUpdateReady) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;

  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register("./sw.js");

      // A new version is waiting once its worker reaches "installed" while
      // an old one is still controlling the page.
      registration.addEventListener("updatefound", () => {
        const sw = registration.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller && onUpdateReady) {
            onUpdateReady();
          }
        });
      });
    } catch {
      /* offline support just won't be available; the sheet still works */
    }
  });
}

const DATA_URLS = ["./data/feats.json", "./data/equipment.json", "./data/spells.json", "./data/actions.json"];

/**
 * Pull every reference file down now, for a session away from wifi.
 * Resolves once the worker reports it's finished.
 */
export function prefetchForOffline() {
  return new Promise((resolve) => {
    const worker = navigator.serviceWorker && navigator.serviceWorker.controller;
    if (!worker) {
      // No worker yet (first visit before it takes control) — plain fetches
      // still populate the HTTP cache and will be picked up next load.
      Promise.all(DATA_URLS.map((u) => fetch(u).catch(() => null))).then(() => resolve(false));
      return;
    }

    const onMessage = (e) => {
      if (e.data && e.data.type === "PREFETCH_DONE") {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(true);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    worker.postMessage({ type: "PREFETCH_DATA", urls: DATA_URLS });
  });
}
