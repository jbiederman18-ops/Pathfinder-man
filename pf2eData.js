// pf2eData.js — loads the generated PF2e reference data.
//
// Caching is handled by the service worker (sw.js), which serves these files
// cache-first, so this is a plain fetch plus a friendly message when the data
// isn't available yet and there's no connection.
//
// DATA_CACHE must match the name sw.js uses, since isCached() inspects the
// same store the worker writes to.

const BASE = "./data";
const DATA_CACHE = "pf2e-data-v1";

const inflight = new Map(); // category -> Promise<Array>

async function fetchCategory(name) {
  const url = `${BASE}/${name}.json`;

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(
      `${name}.json isn't available offline yet. Open the sheet once with a connection, ` +
        `or use "Download reference data" in Notes before you head out.`
    );
  }

  if (!res.ok) throw new Error(`${name}.json: ${res.status} ${res.statusText}`);
  return res.json();
}

export function loadCategory(name) {
  if (!inflight.has(name)) {
    inflight.set(
      name,
      fetchCategory(name).catch((err) => {
        inflight.delete(name); // let a later attempt retry
        throw err;
      })
    );
  }
  return inflight.get(name);
}

export const loadFeats = () => loadCategory("feats");
export const loadSpells = () => loadCategory("spells");
export const loadEquipment = () => loadCategory("equipment");
export const loadActions = () => loadCategory("actions");

/** Whether a category is sitting in the worker's cache, ready for offline. */
export async function isCached(name) {
  if (typeof caches === "undefined") return false;
  try {
    const cache = await caches.open(DATA_CACHE);
    return !!(await cache.match(`${BASE}/${name}.json`));
  } catch {
    return false;
  }
}

/** Offline readiness across all four, for a status line in Notes. */
export async function cacheStatus() {
  const names = ["feats", "equipment", "spells", "actions"];
  const flags = await Promise.all(names.map(isCached));
  return {
    ready: flags.filter(Boolean).length,
    total: names.length,
    missing: names.filter((_, i) => !flags[i]),
  };
}
