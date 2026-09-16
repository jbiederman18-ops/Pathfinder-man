/* ------------------------------------------------------------------
   Cross-device sync.

   The sheet reads and writes through window.storage (get/set/delete/list).
   Defining that here, before the bundle loads, swaps the browser-only store
   for a local cache that mirrors itself into Firestore. The sheet itself is
   untouched: it keeps its own revision numbers and its own "changed on
   another device" prompt, and this just feeds it fresher data and pushes its
   writes out.

   Setup happens inside the app — tap Sync, paste a Firebase config. Nothing
   here needs editing and nothing needs rebuilding. A config can also be baked
   in at build time via window.PF2E_FIREBASE, which then acts as the default
   for anyone opening that copy.

   With no config at all the sheet saves to this browser, exactly as before.
------------------------------------------------------------------- */
(function () {
  "use strict";

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";
  var PREFIX = "pf2e-store:";      // the prefix the sheet already used, so
  var ROOM_KEY = "pf2e:sync:room"; // anything saved before this carries over
  var CONFIG_KEY = "pf2e:sync:config";
  var CLIENT_KEY = "pf2e:sync:client";
  var COLLECTION = "pf2e-rooms";
  var INDEX_KEY = "pf2e:index";
  var CODE_PREFIX = "PF2E1:";

  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  // ---------- the local cache the sheet talks to ----------
  var cache = new Map();
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) cache.set(k.slice(PREFIX.length), localStorage.getItem(k));
    }
  } catch (e) {}

  var pending = new Map();   // key -> value written locally, not yet confirmed remote
  var timers = new Map();
  var fails = new Map();     // key -> consecutive failed attempts
  var remoteWrite = null;
  var remoteDelete = null;

  /* A rejected write used to be the end of that key: nothing retried it, and
     because an unconfirmed key also blocks anything arriving for it, one
     failure quietly froze that character in both directions. So back off and
     keep trying, and after a few attempts stop blocking the incoming side —
     the value is still in the cache and still on its way out. */
  var RETRY_MS = [1000, 3000, 8000, 20000, 60000];
  var GIVE_UP_BLOCKING_AFTER = 3;

  function settled() { return pending.size ? "saving" : "synced"; }

  function flush(key) {
    timers.delete(key);
    if (!remoteWrite) return;   // still connecting; the queue is replayed once we are
    var gone = !cache.has(key);
    var value = gone ? null : cache.get(key);
    var op = gone ? (remoteDelete && remoteDelete(key)) : remoteWrite(key, value);
    if (!op) return;
    op.then(function () {
      fails.delete(key);
      if (pending.get(key) === value) pending.delete(key);
      status(settled());
    }).catch(function (err) {
      fail(err);
      var n = (fails.get(key) || 0) + 1;
      fails.set(key, n);
      if (n >= GIVE_UP_BLOCKING_AFTER) pending.delete(key);
      if (timers.has(key)) clearTimeout(timers.get(key));
      timers.set(key, setTimeout(function () { flush(key); }, RETRY_MS[Math.min(n - 1, RETRY_MS.length - 1)]));
    });
  }

  function queue(key) {
    pending.set(key, cache.has(key) ? cache.get(key) : null);
    fails.delete(key);
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(key, setTimeout(function () { flush(key); }, 300));
    if (state === "synced") status("saving");
  }

  /* Wiring the transport is also how the test harness stands in for Firestore. */
  function attach(write, del) {
    remoteWrite = write;
    remoteDelete = del;
    var replay = []; pending.forEach(function (_, key) { replay.push(key); });
    replay.forEach(queue);
  }

  window.storage = {
    get: function (key) {
      if (!cache.has(key)) return Promise.reject(new Error("no such key: " + key));
      return Promise.resolve({ key: key, value: cache.get(key), shared: false });
    },
    set: function (key, value) {
      var v = String(value);
      cache.set(key, v);
      ls.set(PREFIX + key, v);
      queue(key);
      return Promise.resolve({ key: key, value: v, shared: false });
    },
    delete: function (key) {
      cache.delete(key);
      ls.del(PREFIX + key);
      queue(key);
      return Promise.resolve({ key: key, deleted: true, shared: false });
    },
    list: function (prefix) {
      var p = prefix || "";
      var keys = [];
      cache.forEach(function (_, key) { if (key.indexOf(p) === 0) keys.push(key); });
      return Promise.resolve({ keys: keys, prefix: p, shared: false });
    }
  };

  // ---------- telling the sheet something arrived ----------
  // The sheet already re-reads storage whenever the tab regains focus, and
  // reconciles by revision number. A synthetic focus event reuses all of it.
  var nudgeTimer = null;
  function nudge() {
    if (nudgeTimer) return;
    nudgeTimer = setTimeout(function () {
      nudgeTimer = null;
      window.dispatchEvent(new Event("focus"));
    }, 200);
  }

  /* Taking in one key from another device. Lifted out of the snapshot handler
     so the two-device test can drive it without a network, and so the index
     gets the same union treatment here as it does on first contact — a live
     index that simply overwrote ours would drop any character the other device
     hasn't heard about yet. Returns true if anything actually changed. */
  function receive(key, value) {
    if (pending.has(key)) return false;            // we have something newer going out
    var mine = cache.has(key) ? cache.get(key) : null;
    /* A device that has been offline can send a record older than the one we
       already hold. Taking it would quietly undo edits — the sheet would
       recover on its next write, but not if it never gets one. Same revision
       test the first-contact merge uses. */
    if (mine !== null && key !== INDEX_KEY && revOf(mine) > revOf(value)) {
      queue(key);                                  // put ours back out instead
      return false;
    }
    var next = key === INDEX_KEY && mine ? mergeIndex(mine, value) : value;
    if (mine === next) return false;
    cache.set(key, next);
    ls.set(PREFIX + key, next);
    /* A merge produces something neither device has; send it back so they
       converge instead of trading halves. */
    if (next !== value) queue(key);
    return true;
  }

  function drop(key) {
    if (!cache.has(key) || pending.has(key)) return false;
    cache.delete(key);
    ls.del(PREFIX + key);
    return true;
  }

  // ---------- merging when two devices meet for the first time ----------
  function parse(v) { try { return JSON.parse(v); } catch (e) { return null; } }
  function revOf(v) { var o = parse(v); return (o && +o.rev) || 0; }

  function mergeIndex(localVal, remoteVal) {
    var a = parse(localVal), b = parse(remoteVal);
    if (!a) return remoteVal;
    if (!b) return localVal;
    var ids = (b.ids || []).slice();
    (a.ids || []).forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); });
    var merged = {};
    Object.keys(b).forEach(function (key) { merged[key] = b[key]; });
    Object.keys(a).forEach(function (key) { merged[key] = a[key]; });   // this device's theme wins
    merged.ids = ids;
    return JSON.stringify(merged);
  }

  function reconcile(remote, push) {
    var changed = false;
    Object.keys(remote).forEach(function (key) {
      var mine = cache.has(key) ? cache.get(key) : null;
      var theirs = remote[key];
      if (mine === theirs) return;
      if (mine === null) { cache.set(key, theirs); ls.set(PREFIX + key, theirs); changed = true; return; }
      var winner = key === INDEX_KEY ? mergeIndex(mine, theirs)
        : revOf(mine) > revOf(theirs) ? mine : theirs;
      if (winner !== mine) { cache.set(key, winner); ls.set(PREFIX + key, winner); changed = true; }
      if (winner !== theirs && push) push(key, winner);
    });
    cache.forEach(function (value, key) { if (!(key in remote) && push) push(key, value); });
    return changed;
  }

  // ---------- config ----------
  /* Accepts whatever the Firebase console left on your clipboard: the whole
     "const firebaseConfig = {...}" snippet, just the object, or plain JSON.
     Picked apart by hand rather than eval'd, because this is pasted text. */
  var CONFIG_FIELDS = ["apiKey", "authDomain", "projectId", "appId", "storageBucket", "messagingSenderId"];
  function parseConfig(text) {
    var out = {};
    CONFIG_FIELDS.forEach(function (field) {
      var m = new RegExp("[\"']?" + field + "[\"']?\\s*[:=]\\s*[\"']([^\"']+)[\"']").exec(text || "");
      if (m) out[field] = m[1];
    });
    if (!out.apiKey || !out.projectId) return null;
    if (!out.authDomain) out.authDomain = out.projectId + ".firebaseapp.com";
    return out;
  }

  var baked = (typeof window !== "undefined" && window.PF2E_FIREBASE) || null;
  if (baked && !baked.projectId) baked = null;
  function config() { return parse(ls.get(CONFIG_KEY)) || baked; }
  function setConfig(c) { if (c) ls.set(CONFIG_KEY, JSON.stringify(c)); else ls.del(CONFIG_KEY); }

  // ---------- room codes ----------
  var ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // no I, L, O, 0, 1
  function newRoom() {
    var bytes = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var out = "";
    for (var i = 0; i < 16; i++) {
      out += ALPHABET[bytes[i] % ALPHABET.length];
      if (i % 4 === 3 && i < 15) out += "-";
    }
    return out;
  }
  /* Always exactly sixteen characters, so the security rule can check the
     length and a mistyped code fails here with an explanation rather than
     silently dropping you into an empty room. */
  function normalizeRoom(s) {
    var clean = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length !== 16) return "";
    return clean.replace(/(.{4})(?=.)/g, "$1-");
  }
  function room() { return ls.get(ROOM_KEY) || ""; }
  function setRoom(r) { if (r) ls.set(ROOM_KEY, r); else ls.del(ROOM_KEY); }

  /* One string carrying both the project and the room, so the second device
     is a single paste instead of repeating the whole console dance. */
  function setupCode() {
    var c = config();
    if (!c || !room()) return "";
    return CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify({ c: c, r: room() }))));
  }
  function readSetupCode(text) {
    try {
      var payload = JSON.parse(decodeURIComponent(escape(atob(text.slice(CODE_PREFIX.length).trim()))));
      if (!payload.c || !payload.c.projectId || !payload.r) return null;
      return payload;
    } catch (e) { return null; }
  }

  var clientId = ls.get(CLIENT_KEY);
  if (!clientId) { clientId = Math.random().toString(36).slice(2, 10); ls.set(CLIENT_KEY, clientId); }

  function docId(key) { return key.replace(/\//g, "%2F"); }
  function keyOf(doc) { var d = doc.data(); return d && d.k ? d.k : doc.id.replace(/%2F/g, "/"); }

  // ---------- status and diagnosis ----------
  var state = "off";
  var lastError = null;
  /* Whether any device other than this one has ever written to this code. Two
     devices sitting in different codes both report Synced and exchange
     nothing, which is indistinguishable from working until you notice your
     edits aren't arriving — so say it out loud. */
  var soloRoom = true;
  var listeners = [];
  function status(s) { if (s === state) return; state = s; listeners.forEach(function (f) { f(); }); }
  function onStatus(f) { listeners.push(f); f(); }

  /* Every way this goes wrong is one specific setting in the console, so name
     that setting instead of saying something went wrong. */
  var DIAGNOSIS = [
    [/auth\/operation-not-allowed|auth\/admin-restricted/, "Anonymous sign-in isn't switched on. In the Firebase console: Authentication \u2192 Sign-in method \u2192 Anonymous \u2192 Enable."],
    [/auth\/configuration-not-found/, "This project has no sign-in set up yet. In the console: Authentication \u2192 Get started \u2192 Anonymous \u2192 Enable."],
    [/api-key-not-valid|auth\/invalid-api-key|auth\/api-key/, "That API key isn't valid for this project. Copy the config again from Project settings \u2192 Your apps \u2192 Web."],
    [/auth\/unauthorized-domain/, "This address isn't on the project's allowed list. In the console: Authentication \u2192 Settings \u2192 Authorized domains \u2192 Add domain, and add your github.io host."],
    [/auth\/network-request-failed|Failed to fetch|NetworkError|dynamically imported/, "Couldn't reach Firebase. Check the connection, and whether a content blocker is blocking googleapis.com or gstatic.com."],
    [/permission-denied|Missing or insufficient permissions/, "Firestore is refusing the write, which means the security rules haven't been published. Copy the rules from Show me the setup below into Firestore \u2192 Rules \u2192 Publish."],
    [/not-found|does not exist/, "This project has no Firestore database yet. In the console: Firestore Database \u2192 Create database \u2192 production mode."],
    [/failed-precondition/, "Firestore isn't in Native mode. A project created in Datastore mode can't be used here \u2014 make a new project."],
    [/unavailable|offline/, "Firestore is unreachable right now. Your work is saved here and will go out when the connection returns."]
  ];
  function diagnose(err) {
    var text = (err && (err.code || "")) + " " + (err && (err.message || err));
    for (var i = 0; i < DIAGNOSIS.length; i++) if (DIAGNOSIS[i][0].test(text)) return DIAGNOSIS[i][1];
    return null;
  }
  function fail(err) {
    lastError = { fix: diagnose(err), raw: (err && (err.code || err.message)) || String(err) };
    status(/unavailable|offline|network/i.test(lastError.raw) ? "offline" : "error");
  }

  // ---------- Firestore ----------
  var sdk = null;
  function loadSdk() {
    if (sdk) return sdk;
    var cfg = config();
    sdk = Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-auth.js"),
      import(SDK + "firebase-firestore.js")
    ]).then(function (mods) {
      var appMod = mods[0], authMod = mods[1], fs = mods[2];
      var app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(cfg);
      var db;
      try {
        db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
      } catch (e) {
        db = fs.getFirestore(app);
      }
      return authMod.signInAnonymously(authMod.getAuth(app)).then(function () { return { fs: fs, db: db }; });
    });
    sdk.catch(function () { sdk = null; });   // let a corrected config try again
    return sdk;
  }

  var unsubscribe = null;

  function connect() {
    if (!config()) { status("off"); return; }
    if (!room()) { status("idle"); return; }
    status("connecting");
    lastError = null;

    loadSdk().then(function (ctx) {
      var fs = ctx.fs, db = ctx.db;
      var col = fs.collection(db, COLLECTION, room(), "entries");

      var write = function (key, value) {
        return fs.setDoc(fs.doc(col, docId(key)), { k: key, v: value, c: clientId, t: fs.serverTimestamp() });
      };
      var del = function (key) { return fs.deleteDoc(fs.doc(col, docId(key))); };

      var first = true;
      if (unsubscribe) unsubscribe();
      unsubscribe = fs.onSnapshot(col, function (snap) {
        lastError = null;
        if (first) {
          first = false;
          var remote = {};
          snap.forEach(function (d) {
            var data = d.data();
            if (!data || typeof data.v !== "string") return;
            if (data.c && data.c !== clientId) soloRoom = false;
            remote[keyOf(d)] = data.v;
          });
          var changed = reconcile(remote, function (key, value) { pending.set(key, value); queue(key); });
          status(settled());
          if (changed) nudge();
          return;
        }
        var touched = false;
        snap.docChanges().forEach(function (ch) {
          var key = keyOf(ch.doc);
          var data = ch.doc.data();
          if (ch.type === "removed") { if (drop(key)) touched = true; return; }
          if (!data || typeof data.v !== "string") return;
          if (data.c === clientId) return;         // our own write coming back
          soloRoom = false;
          if (receive(key, data.v)) touched = true;
        });
        status(settled());
        if (touched) nudge();
      }, fail);

      // Anything written or deleted while we were still connecting.
      attach(write, del);
    }).catch(fail);
  }

  /* Losing signal mid-session used to be permanent until you reopened the app:
     the one connect() at load had failed and nothing ever tried again. */
  function retryConnection() {
    if (state !== "offline" && state !== "error") return;
    if (!config() || !room()) return;
    connect();
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("online", retryConnection);
    window.addEventListener("focus", function () { if (state === "offline") retryConnection(); });
  }
  setInterval(function () { if (state === "offline") retryConnection(); }, 30000);

  /* Walks the same path a real save takes and reports which step broke, so a
     half-configured project is a sentence rather than a shrug. */
  function selfTest(report) {
    if (!config()) return report(false, "No Firebase project connected yet.");
    report(null, "Loading Firebase\u2026");
    loadSdk().then(function (ctx) {
      report(null, "Signed in. Testing a write\u2026");
      var fs = ctx.fs;
      var r = room() || newRoom();
      var ref = fs.doc(fs.collection(ctx.db, COLLECTION, r, "entries"), "pf2e-selftest");
      return fs.setDoc(ref, { k: "selftest", v: "ok", c: clientId, t: fs.serverTimestamp() })
        .then(function () { return fs.getDoc(ref); })
        .then(function (snap) {
          if (!snap.exists() || snap.data().v !== "ok") throw new Error("the write didn't come back");
          return fs.deleteDoc(ref);
        })
        .then(function () { report(true, "Everything works. Reads, writes and deletes all went through."); });
    }).catch(function (err) {
      fail(err);
      report(false, lastError.fix || ("Firebase said: " + lastError.raw));
    });
  }

  // ---------- panel ----------
  var HEADLINE = {
    off: "Sync is off", idle: "Project connected", connecting: "Connecting\u2026",
    saving: "Sending\u2026", synced: "Synced", offline: "Waiting to reconnect", error: "Sync stopped"
  };
  var BLURB = {
    off: "Characters are saving to this browser only. Connect a Firebase project and the same characters open on every device.",
    idle: "This device isn\u2019t in a sync code yet, so nothing is travelling. Start one here if this is your first device \u2014 otherwise paste the setup code from the device that already has your characters.",
    connecting: "Reaching your Firebase project.",
    saving: "Changes are on their way out. This clears in a second or two \u2014 if it sticks, your other devices aren\u2019t seeing these edits yet.",
    synced: "Changes here reach your other devices in a second or two.",
    offline: "Your changes are saved here and go out when the connection returns.",
    error: "Nothing is lost \u2014 the sheet keeps saving to this browser meanwhile."
  };

  var RULES =
    "rules_version = '2';\n" +
    "service cloud.firestore {\n" +
    "  match /databases/{database}/documents {\n" +
    "    match /pf2e-rooms/{room}/entries/{entry} {\n" +
    "      allow read, write: if request.auth != null && room.size() == 19;\n" +
    "    }\n" +
    "  }\n" +
    "}";

  function buildUI() {
    var host = document.createElement("div");
    host.id = "pf2e-sync";
    host.innerHTML = [
      '<style>',
      '#pf2e-sync{--p:#1a1e33;--p2:#232841;--ln:#333a55;--tx:#e9e6f5;--mut:#a9a0cc;--ac:#c9a227;--oc:#14172b;',
      /* --logh is the roll log's measured height, published by the sheet. It is
         0 when the log is closed, so one rule covers both cases and the pill
         never parks itself in the middle of the screen. */
      'position:fixed;left:12px;bottom:calc(var(--logh, 0px) + 18px + env(safe-area-inset-bottom));',
      'z-index:44;transition:bottom .2s ease;',
      'font:13px/1.45 -apple-system,system-ui,sans-serif;color:var(--tx)}',
      '#pf2e-sync button{font:inherit;color:inherit;cursor:pointer}',
      '#pf2e-sync .tab{display:flex;align-items:center;gap:7px;background:var(--p2);border:1px solid var(--ln);',
      'border-radius:999px;padding:9px 14px;font-weight:700;box-shadow:0 2px 10px rgba(0,0,0,.45)}',
      '#pf2e-sync .dot{width:8px;height:8px;border-radius:50%;background:var(--mut);flex:none}',
      '#pf2e-sync[data-state="synced"] .dot{background:#5aa469}',
      '#pf2e-sync[data-state="connecting"] .dot,#pf2e-sync[data-state="saving"] .dot',
      '{background:var(--ac);animation:pfpulse 1.1s ease-in-out infinite}',
      '#pf2e-sync[data-state="offline"] .dot,#pf2e-sync[data-state="error"] .dot{background:#c0483a}',
      '@keyframes pfpulse{0%,100%{opacity:.35}50%{opacity:1}}',
      '@media (prefers-reduced-motion:reduce){#pf2e-sync .dot{animation:none}}',
      '#pf2e-sync .panel{position:fixed;left:12px;right:12px;',
      'bottom:calc(var(--logh, 0px) + 18px + env(safe-area-inset-bottom));',
      'max-width:400px;max-height:min(620px,calc(100vh - var(--logh, 0px) - 110px));',
      'overflow:auto;background:var(--p);border:1px solid var(--ln);',
      'border-radius:14px;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,.6)}',
      '#pf2e-sync h4{margin:0 0 2px;font-size:15px}',
      '#pf2e-sync p{margin:0 0 10px;color:var(--mut);font-size:12.5px}',
      '#pf2e-sync ol{margin:0 0 10px;padding-left:18px;color:var(--mut);font-size:12.5px}',
      '#pf2e-sync li{margin-bottom:6px}',
      '#pf2e-sync .code{display:block;background:var(--p2);border:1px solid var(--ln);border-radius:8px;',
      'padding:9px 10px;font:600 14px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;',
      'word-break:break-all;margin-bottom:8px}',
      '#pf2e-sync pre{background:var(--p2);border:1px solid var(--ln);border-radius:8px;padding:9px 10px;',
      'font:11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;overflow:auto;margin:0 0 8px;white-space:pre}',
      '#pf2e-sync textarea{width:100%;min-height:72px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;',
      'font-size:16px;line-height:1.4;color:var(--tx);background:var(--p2);border:1px solid var(--ln);',
      'border-radius:8px;padding:9px 10px;margin-bottom:8px;resize:vertical}',
      '#pf2e-sync textarea:focus{outline:2px solid var(--ac);outline-offset:1px}',
      '#pf2e-sync .btn{background:var(--p2);border:1px solid var(--ln);border-radius:8px;padding:8px 12px;font-weight:600}',
      '#pf2e-sync .btn.pri{background:var(--ac);border-color:var(--ac);color:var(--oc)}',
      '#pf2e-sync .btn.quiet{background:none;border-color:transparent;color:var(--mut);padding-left:0}',
      '#pf2e-sync .btn[disabled]{opacity:.45}',
      '#pf2e-sync .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
      '#pf2e-sync .box{border:1px solid var(--ln);border-radius:10px;padding:10px;margin-bottom:10px}',
      '#pf2e-sync .box.bad{border-color:#7d3b32;background:rgba(192,72,58,.09)}',
      '#pf2e-sync .box.good{border-color:#3f6b47;background:rgba(90,164,105,.09)}',
      '#pf2e-sync .box p{margin:0;color:var(--tx)}',
      '#pf2e-sync .lbl{font-weight:700;margin-bottom:4px}',
      '#pf2e-sync .hide{display:none}',
      '</style>',
      '<button class="tab" type="button" aria-expanded="false"><span class="dot"></span><span class="tablbl">Sync</span></button>',
      '<div class="panel hide" role="dialog" aria-label="Sync across devices">',
        '<h4></h4><p class="blurb"></p>',

        '<div class="box bad problem hide"><div class="lbl">What to fix</div><p class="fix"></p></div>',
        '<div class="box result hide"><p class="resulttext"></p></div>',

        '<div class="connected hide"><div class="lbl">Project</div><p class="project"></p></div>',

        '<div class="box solo hide"><div class="lbl">Nothing else is in this code</div>',
        '<p>No other device has ever written here. If your other device says Synced too, it is sitting in a ',
        'different sync code \u2014 compare the two below and paste this one there.</p></div>',

        '<div class="hasroom hide">',
          '<div class="lbl">Set up your other device</div>',
          '<p>Paste this into the Sync panel there and it joins the project and this sync code in one go.</p>',
          '<div class="row" style="margin-bottom:10px">',
            '<button class="btn pri copysetup" type="button">Copy setup code</button>',
            '<button class="btn copyroom" type="button">Copy sync code only</button>',
          '</div>',
          '<div class="lbl">Sync code</div>',
          '<code class="code roomcode"></code>',
          '<p>Your other device has to show <b>this exact code</b>. If it shows a different one, the two are ',
          'syncing to separate piles: both say Synced and nothing crosses. Fix it by pasting this code there.</p>',
        '</div>',

        '<div class="lbl pastelbl">Paste here</div>',
        '<p class="pastehint"></p>',
        '<textarea class="paste" autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>',
        '<div class="row">',
          '<button class="btn pri apply" type="button">Connect</button>',
          '<button class="btn startfresh hide" type="button">Start a sync code</button>',
        '</div>',

        '<div class="row" style="margin-top:12px">',
          '<button class="btn check" type="button">Run a check</button>',
          '<button class="btn quiet helptoggle" type="button">Show me the setup</button>',
          '<button class="btn quiet stop hide" type="button">Stop syncing here</button>',
        '</div>',

        '<div class="help hide" style="margin-top:12px">',
          '<div class="lbl">Five minutes, once</div>',
          '<ol>',
            '<li>Make a project at console.firebase.google.com. Analytics off is fine.</li>',
            '<li><b>Authentication \u2192 Get started \u2192 Anonymous \u2192 Enable.</b> Nobody signs up for anything; this gives each device an identity the rules can check.</li>',
            '<li><b>Firestore Database \u2192 Create database</b>, production mode, any region.</li>',
            '<li><b>Firestore \u2192 Rules</b>: replace what\u2019s there with the block below, then <b>Publish</b>.</li>',
            '<li><b>Project settings \u2192 Your apps \u2192 Web.</b> Register the app, copy the whole firebaseConfig block it shows you, and paste it above.</li>',
          '</ol>',
          '<pre class="rules"></pre>',
          '<div class="row"><button class="btn copyrules" type="button">Copy the rules</button></div>',
          '<p style="margin-top:10px">The config values identify the project rather than granting access to it \u2014 the rules are what guard the data. Your sync code is the password: sixteen random characters, and anyone holding it can read and write these characters.</p>',
        '</div>',

        '<div class="row" style="margin-top:10px"><button class="btn quiet close" type="button">Close</button></div>',
      '</div>'
    ].join("");

    var $ = function (sel) { return host.querySelector(sel); };
    var panel = $(".panel"), paste = $(".paste");
    var result = null;

    $(".rules").textContent = RULES;
    function show(el, on) { el.classList.toggle("hide", !on); }

    function paint() {
      var cfg = config(), r = room();
      host.setAttribute("data-state", state);
      $(".tablbl").textContent = state === "synced" ? "Synced" : state === "off" ? "Sync" : HEADLINE[state];
      $("h4").textContent = HEADLINE[state] || "Sync";
      $(".blurb").textContent = BLURB[state] || "";

      show($(".problem"), !!(lastError && (state === "error" || state === "offline")));
      if (lastError) $(".fix").textContent = lastError.fix || ("Firebase said: " + lastError.raw);

      show($(".result"), !!result);
      if (result) {
        $(".result").className = "box result " + (result.ok === true ? "good" : result.ok === false ? "bad" : "");
        $(".resulttext").textContent = result.text;
      }

      show($(".connected"), !!cfg);
      if (cfg) $(".project").textContent = cfg.projectId + (baked && !ls.get(CONFIG_KEY) ? " \u2014 built into this file" : "");

      show($(".solo"), !!(cfg && r) && soloRoom && (state === "synced" || state === "saving"));
      show($(".hasroom"), !!(cfg && r));
      if (r) $(".roomcode").textContent = r;

      show($(".startfresh"), !!cfg && !r);
      show($(".stop"), !!r);

      $(".pastelbl").textContent = cfg ? "Join another device" : "Firebase config";
      $(".pastehint").textContent = cfg
        ? "Paste a setup code or a sync code from your other device."
        : "Paste the whole firebaseConfig block from the Firebase console, or a setup code from a device that is already syncing.";
      $(".apply").textContent = cfg ? "Use this" : "Connect";
      paste.setAttribute("placeholder", cfg ? "PF2E1:\u2026 or ABCD-EFGH-JKLM-NPQR" : "const firebaseConfig = { \u2026 }");
    }

    function say(ok, text) { result = { ok: ok, text: text }; paint(); }

    /* One box takes whatever you have: a config from the console, a setup code
       from another device, or a bare sync code. Working out which is far
       kinder than three fields and a wrong guess about which one you needed. */
    function applyPaste() {
      var text = paste.value.trim();
      if (!text) return say(false, "Paste something in first.");

      if (text.indexOf(CODE_PREFIX) === 0) {
        var payload = readSetupCode(text);
        if (!payload) return say(false, "That setup code is damaged. Copy it again from the other device.");
        setConfig(payload.c);
        setRoom(payload.r);
        paste.value = "";
        say(true, "Joined " + payload.c.projectId + ". Reloading\u2026");
        return setTimeout(function () { location.reload(); }, 900);
      }

      if (text.indexOf("{") < 0) {
        var asRoom = normalizeRoom(text);
        if (!asRoom) {
          return say(false, "A sync code is sixteen characters, like ABCD-EFGH-JKLM-NPQR. That one has " +
            text.replace(/[^A-Za-z0-9]/g, "").length + ".");
        }
        if (!config()) return say(false, "Connect a Firebase project first \u2014 that is the config block from the console.");
        setRoom(asRoom);
        paste.value = "";
        say(null, "Joining " + asRoom + "\u2026");
        connect();
        return;
      }

      var cfg = parseConfig(text);
      if (!cfg) return say(false, "That config is missing apiKey or projectId. Copy the whole block the console shows you, braces and all.");
      setConfig(cfg);
      paste.value = "";
      /* Deliberately no sync code yet. Minting one here is right for the first
         device and quietly wrong for the second: pasting the same config on a
         phone would put it in a code of its own, both devices would say Synced,
         and nothing would ever cross between them. */
      say(true, room()
        ? "Connected to " + cfg.projectId + ". Reloading\u2026"
        : "Connected to " + cfg.projectId + ". One step left: start a sync code here, or paste the code from a device that already has your characters.");
      setTimeout(function () { location.reload(); }, room() ? 900 : 2600);
    }

    function copy(button, text) {
      var restore = button.textContent;
      var done = function () { button.textContent = "Copied"; setTimeout(function () { button.textContent = restore; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done); else done();
    }

    $(".tab").addEventListener("click", function () {
      var opening = panel.classList.contains("hide");
      show(panel, opening);
      $(".tab").setAttribute("aria-expanded", opening ? "true" : "false");
      if (opening) { theme(); paint(); }
    });
    $(".close").addEventListener("click", function () { show(panel, false); });
    $(".apply").addEventListener("click", applyPaste);
    $(".startfresh").addEventListener("click", function () { setRoom(newRoom()); connect(); paint(); });
    $(".copysetup").addEventListener("click", function (e) { copy(e.currentTarget, setupCode()); });
    $(".copyroom").addEventListener("click", function (e) { copy(e.currentTarget, room()); });
    $(".copyrules").addEventListener("click", function (e) { copy(e.currentTarget, RULES); });
    $(".helptoggle").addEventListener("click", function (e) {
      var open = $(".help").classList.contains("hide");
      show($(".help"), open);
      e.currentTarget.textContent = open ? "Hide the setup" : "Show me the setup";
    });
    $(".check").addEventListener("click", function (e) {
      var btn = e.currentTarget;
      btn.disabled = true;
      selfTest(function (ok, text) {
        say(ok, text);
        if (ok !== null) { btn.disabled = false; if (ok) connect(); }
      });
    });
    $(".stop").addEventListener("click", function () {
      if (!confirm("Stop syncing on this device? Your characters stay here, they just stop travelling.")) return;
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      remoteWrite = remoteDelete = null;
      setRoom("");
      status("idle");
      say(null, "Stopped. Nothing was deleted.");
    });

    // Borrow the sheet's current colours so the panel doesn't look bolted on.
    function theme() {
      var pf = document.querySelector(".pf");
      if (!pf) return;
      var cs = getComputedStyle(pf);
      [["--p", "--pan"], ["--p2", "--pan2"], ["--ln", "--line"], ["--tx", "--tx"],
       ["--mut", "--mut"], ["--ac", "--brass"], ["--oc", "--onbrass"]].forEach(function (pair) {
        var v = cs.getPropertyValue(pair[1]).trim();
        if (v) host.style.setProperty(pair[0], v);
      });
    }

    onStatus(paint);
    document.body.appendChild(host);

    // Keep the panel's borrowed colours current while it is open.
    setInterval(function () {
      if (!panel.classList.contains("hide")) theme();
    }, 1500);

    paint();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildUI);
  else buildUI();
  connect();

  window.PF2E_SYNC = {
    reconcile: reconcile, mergeIndex: mergeIndex, normalizeRoom: normalizeRoom,
    newRoom: newRoom, parseConfig: parseConfig, setupCode: setupCode,
    readSetupCode: readSetupCode, diagnose: diagnose, cache: cache,
    attach: attach, pending: pending, state: function () { return state; },
    receive: receive, drop: drop, nudge: nudge, solo: function () { return soloRoom; }
  };
})();
