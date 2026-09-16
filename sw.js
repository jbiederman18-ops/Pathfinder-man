/* sw.js — offline support for the Pathfinder sheet.
 *
 * Lives at the repo root, next to index.html, so its scope covers the whole
 * site. Two caches:
 *
 *   shell — index.html, so the app opens with no connection at all
 *   data  — the reference JSON, cached the first time each one is fetched
 *
 * Bump VERSION to force everyone onto fresh copies. Old caches are deleted
 * on activate.
 *
 * Deliberately narrow: only same-origin GET requests are touched. The
 * Anthropic API calls and the Firebase SDK imports from gstatic.com go
 * straight through untouched.
 */

const VERSION = "v1";
const SHELL_CACHE = `pf2e-shell-${VERSION}`;
const DATA_CACHE = `pf2e-data-${VERSION}`;

const SHELL_URLS = ["./", "./index.html"];

self.addEventListener("install", (event) => {
  // Only the shell is precached. The data files are tens of megabytes and
  // precaching them here would make installs slow and failure-prone on a
  // bad connection; they're cached on first use instead.
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => /^pf2e-(shell|data)-/.test(n) && n !== SHELL_CACHE && n !== DATA_CACHE)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

const isDataRequest = (url) => url.pathname.includes("/data/") && url.pathname.endsWith(".json");

/** Cache-first: these files only change when VERSION does. */
async function dataStrategy(request) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const res = await fetch(request);
  if (res && res.ok) {
    cache.put(request, res.clone()).catch(() => {});
  }
  return res;
}

/**
 * Network-first for the page itself, so a deploy is picked up as soon as
 * there's a connection, while a dead network still opens the last good copy.
 */
async function shellStrategy(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put("./index.html", res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = (await cache.match("./index.html")) || (await cache.match("./"));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Leave anything cross-origin alone: the Anthropic API, the Firebase SDK
  // from gstatic, Firestore's own traffic.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(shellStrategy(request));
    return;
  }

  if (isDataRequest(url)) {
    event.respondWith(dataStrategy(request));
  }
});

/** Lets the page ask for everything to be pulled down ahead of a session. */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "PREFETCH_DATA" || !Array.isArray(data.urls)) return;

  event.waitUntil(
    caches.open(DATA_CACHE).then(async (cache) => {
      for (const url of data.urls) {
        try {
          if (await cache.match(url)) continue;
          const res = await fetch(url);
          if (res && res.ok) await cache.put(url, res.clone());
        } catch {
          /* keep going; the page reports what actually landed */
        }
      }
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.postMessage({ type: "PREFETCH_DONE" }));
    })
  );
});
