import { JSDOM } from "jsdom";
import fs from "fs";

const dom = new JSDOM(`<!doctype html><html><body><div id="root"><div class="pf"></div></div></body></html>`, {
  url: "https://example.test/",
  runScripts: "outside-only",
  pretendToBeVisual: true
});
const { window } = dom;

// Pre-seed a character saved by an earlier, browser-only session.
window.localStorage.setItem("pf2e-store:pf2e:index", JSON.stringify({ ids: ["cAAA"], activeId: "cAAA", theme: "slate", v: 4 }));
window.localStorage.setItem("pf2e-store:pf2e:char:cAAA", JSON.stringify({ char: { id: "cAAA", name: "Local Hero" }, rev: 3 }));

const code = fs.readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
window.eval(code);

let failures = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log("  pass  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra ? "  -> " + JSON.stringify(extra) : "")); }
};

const S = window.storage;
const API = window.PF2E_SYNC;

console.log("\nlocal store");
const idx = await S.get("pf2e:index");
ok("reads data saved before sync existed", JSON.parse(idx.value).ids[0] === "cAAA");

await S.set("pf2e:char:cBBB", JSON.stringify({ char: { id: "cBBB" }, rev: 1 }));
ok("set then get round-trips", (await S.get("pf2e:char:cBBB")).value.includes("cBBB"));
ok("set writes through to localStorage", !!window.localStorage.getItem("pf2e-store:pf2e:char:cBBB"));

const listed = await S.list("pf2e:char:");
ok("list filters by prefix", listed.keys.length === 2 && listed.keys.every(k => k.startsWith("pf2e:char:")), listed.keys);

await S.delete("pf2e:char:cBBB");
ok("delete clears localStorage too", window.localStorage.getItem("pf2e-store:pf2e:char:cBBB") === null);

let threw = false;
try { await S.get("pf2e:char:nope"); } catch (e) { threw = true; }
ok("missing key rejects, which the sheet catches as null", threw);

console.log("\nfirst-contact merge");
const pushed = [];
const remote = {
  "pf2e:index": JSON.stringify({ ids: ["cZZZ"], activeId: "cZZZ", theme: "underground", v: 4 }),
  "pf2e:char:cZZZ": JSON.stringify({ char: { id: "cZZZ", name: "Phone Hero" }, rev: 2 }),
  "pf2e:char:cAAA": JSON.stringify({ char: { id: "cAAA", name: "Stale copy" }, rev: 1 })
};
API.reconcile(remote, (k, v) => pushed.push(k));

const mergedIndex = JSON.parse(API.cache.get("pf2e:index"));
ok("no character is dropped when two devices meet", mergedIndex.ids.includes("cAAA") && mergedIndex.ids.includes("cZZZ"), mergedIndex.ids);
ok("this device keeps its own theme", mergedIndex.theme === "slate");
ok("remote-only character is adopted", API.cache.get("pf2e:char:cZZZ").includes("Phone Hero"));
ok("higher local revision beats a stale remote one", API.cache.get("pf2e:char:cAAA").includes("Local Hero"));
ok("the winning local copy is pushed back up", pushed.includes("pf2e:char:cAAA"), pushed);
ok("the merged index is pushed back up", pushed.includes("pf2e:index"), pushed);

console.log("\nsync codes");
ok("codes are grouped and unambiguous", /^[A-HJ-NP-Z2-9]{4}(-[A-HJ-NP-Z2-9]{4}){3}$/.test(API.newRoom()), API.newRoom());
ok("typed codes normalise", API.normalizeRoom("abcd efgh ijkl mnpq") === "ABCD-EFGH-IJKL-MNPQ", API.normalizeRoom("abcd efgh ijkl mnpq"));
ok("short codes are rejected", API.normalizeRoom("ABC") === "");
ok("the rule checks a 19-character code, so that is what we make", API.newRoom().length === 19);
ok("two codes differ", API.newRoom() !== API.newRoom());

console.log("\nreading a pasted Firebase config");
{
  // Exactly what the console puts on your clipboard.
  const snippet = `
    const firebaseConfig = {
      apiKey: "AIzaSyFAKEKEYFAKEKEYFAKEKEY",
      authDomain: "my-sheet.firebaseapp.com",
      projectId: "my-sheet",
      storageBucket: "my-sheet.appspot.com",
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };`;
  const cfg = API.parseConfig(snippet);
  ok("the console snippet parses", cfg && cfg.projectId === "my-sheet", cfg);
  ok("the key comes through", cfg.apiKey === "AIzaSyFAKEKEYFAKEKEYFAKEKEY");
  ok("plain JSON works too", API.parseConfig('{"apiKey":"k","projectId":"p"}').projectId === "p");
  ok("a missing authDomain is filled in", API.parseConfig('{"apiKey":"k","projectId":"p"}').authDomain === "p.firebaseapp.com");
  ok("half a config is rejected", API.parseConfig('{"projectId":"p"}') === null);
  ok("prose is rejected", API.parseConfig("I pasted the wrong thing") === null);
}

console.log("\nsetup codes");
{
  window.localStorage.setItem("pf2e:sync:config", JSON.stringify({ apiKey: "k", projectId: "p", authDomain: "p.firebaseapp.com" }));
  window.localStorage.setItem("pf2e:sync:room", "ABCD-EFGH-JKLM-NPQR");
  const code = API.setupCode();
  ok("a setup code is produced", code.startsWith("PF2E1:"), code.slice(0, 20));
  const back = API.readSetupCode(code);
  ok("it round-trips the project", back.c.projectId === "p", back);
  ok("and the room", back.r === "ABCD-EFGH-JKLM-NPQR");
  ok("a damaged code is refused", API.readSetupCode("PF2E1:not-base64!!") === null);
}

console.log("\ndiagnosing failures");
{
  const cases = [
    ["auth/operation-not-allowed", "Anonymous sign-in"],
    ["auth/configuration-not-found", "Anonymous"],
    ["permission-denied", "rules"],
    ["Missing or insufficient permissions.", "rules"],
    ["not-found", "Firestore database"],
    ["api-key-not-valid", "API key"],
    ["auth/unauthorized-domain", "Authorized domains"],
    ["unavailable", "unreachable"]
  ];
  for (const [code, expect] of cases) {
    const fix = API.diagnose({ code, message: code });
    ok(`"${code}" gets a specific fix`, fix && fix.includes(expect), fix);
  }
  ok("an unknown error gets no invented advice", API.diagnose({ code: "wat", message: "wat" }) === null);
}

console.log("\nui");
// The setup-code checks above left a config behind; the panel should be judged
// from a clean start, which is what someone opening the file for the first
// time actually sees.
window.localStorage.removeItem("pf2e:sync:config");
window.localStorage.removeItem("pf2e:sync:room");
const host = window.document.getElementById("pf2e-sync");
host.querySelector(".tab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
host.querySelector(".tab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
ok("the sync control mounts", !!host);
ok("it starts collapsed", host.querySelector(".panel").classList.contains("hide"));
host.querySelector(".tab").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
ok("tapping opens the panel", !host.querySelector(".panel").classList.contains("hide"));
ok("with no config it explains what's missing", host.querySelector(".blurb").textContent.includes("Firebase"), host.querySelector(".blurb").textContent);
ok("it asks for the config rather than a code", host.querySelector(".pastelbl").textContent === "Firebase config", host.querySelector(".pastelbl").textContent);
ok("the setup steps are there to unfold", !!host.querySelector(".help"));
ok("the rules block is shown verbatim", host.querySelector(".rules").textContent.includes("pf2e-rooms"), host.querySelector(".rules").textContent.slice(0, 40));
ok("no setup is needed to keep playing", typeof window.storage.set === "function");

console.log("\nwrites that fail");
/* Stand in for Firestore so the queue can be driven without a network. */
let attempts = [];
let failNext = 0;
const transport = (key, value) => {
  attempts.push(key);
  if (failNext > 0) { failNext--; return Promise.reject(new Error("unavailable: the backend is down")); }
  return Promise.resolve();
};
API.attach(transport, () => Promise.resolve());
const tick = (ms) => new Promise(r => setTimeout(r, ms));

attempts = []; failNext = 2;
await S.set("pf2e:char:cRETRY", JSON.stringify({ char: { id: "cRETRY" }, rev: 1 }));
await tick(500);
ok("a failed write doesn't just vanish", attempts.filter(k => k === "pf2e:char:cRETRY").length === 1, attempts);
await tick(1400);
ok("it is retried after backing off", attempts.filter(k => k === "pf2e:char:cRETRY").length >= 2, attempts);
await tick(3200);
const tries = attempts.filter(k => k === "pf2e:char:cRETRY").length;
ok("it keeps trying until it lands", tries >= 3, tries);
ok("and then stops", API.pending.has("pf2e:char:cRETRY") === false);

console.log("\nan unconfirmed key stops blocking what comes in");
attempts = []; failNext = 99;
await S.set("pf2e:char:cSTUCK", JSON.stringify({ char: { id: "cSTUCK" }, rev: 1 }));
await tick(6000);
ok("gave up blocking after a few failures", !API.pending.has("pf2e:char:cSTUCK"), [...API.pending.keys()]);
ok("but is still queued for another go", attempts.filter(k => k === "pf2e:char:cSTUCK").length >= 3, attempts.length);
failNext = 0;

console.log("\npasting a config doesn't invent a second sync code");
{
  window.localStorage.removeItem("pf2e:sync:config");
  window.localStorage.removeItem("pf2e:sync:room");
  const panel = host.querySelector(".panel");
  const area = host.querySelector(".paste");
  area.value = '{"apiKey":"k2","projectId":"p2"}';
  host.querySelector(".apply").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  ok("the project is saved", JSON.parse(window.localStorage.getItem("pf2e:sync:config")).projectId === "p2");
  ok("but no code is minted behind your back", !window.localStorage.getItem("pf2e:sync:room"),
    window.localStorage.getItem("pf2e:sync:room"));
  ok("and it says what is left to do", /start a sync code/i.test(host.querySelector(".resulttext").textContent),
    host.querySelector(".resulttext").textContent);
  window.localStorage.removeItem("pf2e:sync:config");
}

console.log("\ntaking in a change from another device");
{
  const key = "pf2e:char:cIN";
  API.cache.set(key, JSON.stringify({ char: { id: "cIN", name: "Mine" }, rev: 7 }));
  ok("a stale copy is refused", API.receive(key, JSON.stringify({ char: { id: "cIN" }, rev: 3 })) === false);
  ok("and ours is still there", API.cache.get(key).includes("Mine"));
  await tick(700);
  ok("a newer copy is taken", API.receive(key, JSON.stringify({ char: { id: "cIN", name: "Theirs" }, rev: 8 })) === true);
  ok("index changes are unioned, not overwritten", (function () {
    API.cache.set("pf2e:index", JSON.stringify({ ids: ["cA"], activeId: "cA", v: 4 }));
    API.receive("pf2e:index", JSON.stringify({ ids: ["cB"], activeId: "cB", v: 4 }));
    const ids = JSON.parse(API.cache.get("pf2e:index")).ids;
    return ids.includes("cA") && ids.includes("cB");
  })(), API.cache.get("pf2e:index"));
}

console.log("\nthe status pill");
ok("says it is still sending while a write is out", ["saving", "offline", "error"].includes(API.state()), API.state());


console.log(failures ? `\n${failures} failing` : "\nall green");
process.exit(failures ? 1 : 0);
