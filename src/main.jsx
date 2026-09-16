import React from "react";
import { createRoot } from "react-dom/client";
import App from "./PathfinderSheet.jsx";

/* Inside a Claude artifact the host supplies window.storage (synced to the
   Claude account) and attaches auth to the API call. Everywhere else that is
   our job.

   PF2E_STANDALONE and PF2E_API_PROXY are set by the inline script in
   src/shell.html, which has to run BEFORE this bundle: the sheet reads both
   flags while its module body executes, and imports run ahead of anything
   written here. Don't move them into this file. */

/* localStorage stand-in for the artifact storage API. Same shape, same
   quirk: a missing key throws rather than returning null. Data lives in this
   browser only — use the Copy backup button on the Notes tab to move it. */
if (!window.storage) {
  const P = "pf2e-store:";
  window.storage = {
    async get(key) {
      const v = localStorage.getItem(P + key);
      if (v === null) throw new Error("no such key: " + key);
      return { key, value: v, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(P + key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(P + key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix = "") {
      const keys = Object.keys(localStorage)
        .filter((k) => k.startsWith(P + prefix))
        .map((k) => k.slice(P.length));
      return { keys, prefix, shared: false };
    },
  };
}

/* No StrictMode: its double-invoked effects would fire the debounced storage
   writes twice and bump revision counters for no reason. */
createRoot(document.getElementById("root")).render(<App />);
