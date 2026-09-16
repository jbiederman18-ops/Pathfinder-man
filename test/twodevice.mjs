/* Two devices, one sync code, no network: each device runs the real built file,
   and a broker in the middle plays Firestore by handing one device's writes to
   the other's inbound path. This is the thing the module tests can't see — a
   change made on a phone actually turning up on a laptop. */
import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log("  pass  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(String(extra).slice(0, 220)) : "")); }
};

const devices = [];
async function boot(label) {
  const dom = new JSDOM(html, {
    url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) { win.scrollTo = () => {}; win.confirm = () => true; },
  });
  const win = dom.window;
  const quiet = console.error; console.error = () => {};
  await wait(700);
  console.error = quiet;
  const dev = {
    label, win, doc: win.document, api: win.PF2E_SYNC,
    vis: () => [...win.document.querySelectorAll(".pf > *")].filter((n) => n.tagName !== "STYLE").map((n) => n.textContent).join(" "),
    btn: (re) => [...win.document.querySelectorAll("button")].find((b) => re.test(b.textContent)),
    tab: (k) => win.document.querySelector('.tab[data-tab="' + k + '"]'),
    click: async (el) => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); await wait(250); },
    header: () => (win.document.querySelector(".nm") || {}).textContent,
  };
  /* The broker: whatever this device sends out, every other device takes in. */
  dev.api.attach(
    (key, value) => { deliver(dev, key, value); return Promise.resolve(); },
    (key) => { devices.forEach((d) => { if (d !== dev && d.api.drop(key)) d.api.nudge(); }); return Promise.resolve(); },
  );
  devices.push(dev);
  return dev;
}
function deliver(from, key, value) {
  devices.forEach((d) => { if (d !== from && d.api.receive(key, value)) d.api.nudge(); });
}
/* Everything in flight: app debounce, sync queue, nudge, then the re-read. */
const settle = () => wait(2600);

const laptop = await boot("laptop");
const phone = await boot("phone");

console.log("\none device starts with a character, the other has nothing");
await laptop.click(laptop.btn(/Leviathan Hammer/));
await settle();
ok("the laptop opened it", laptop.header() === "Leviathan Hammer", laptop.header());
ok("it reached the phone", phone.header() === "Leviathan Hammer", phone.header() || phone.vis().slice(0, 160));

console.log("\nan edit on one shows up on the other");
await laptop.click(laptop.tab("build"));
const nameInput = [...laptop.doc.querySelectorAll("input")].find((i) => (i.value || "") === "Leviathan Hammer");
ok("the name field is editable", !!nameInput);
const setValue = (win, el, v) => {
  Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
};
setValue(laptop.win, nameInput, "Leviathan Hammer II");
await settle();
ok("the laptop kept the edit", laptop.header() === "Leviathan Hammer II", laptop.header());
ok("the phone sees the edit", phone.header() === "Leviathan Hammer II", phone.header());

console.log("\nand back the other way");
await phone.click(phone.tab("build"));
const phoneName = [...phone.doc.querySelectorAll("input")].find((i) => (i.value || "").startsWith("Leviathan"));
setValue(phone.win, phoneName, "Leviathan Hammer III");
await settle();
ok("the laptop picks up the phone's edit", laptop.header() === "Leviathan Hammer III", laptop.header());

console.log("\na second character made on one device");
await phone.click(phone.btn(/^Characters$/));
await phone.click(phone.btn(/^Create a character$/));
await settle();
await phone.click(phone.btn(/^Start$/));
await phone.click(phone.btn(/^Fighter/));
await settle();
ok("the phone has two characters", phone.api.cache.has("pf2e:index") && JSON.parse(phone.api.cache.get("pf2e:index")).ids.length === 2,
  phone.api.cache.get("pf2e:index"));
const laptopIds = JSON.parse(laptop.api.cache.get("pf2e:index")).ids;
ok("the laptop hears about both", laptopIds.length === 2, laptopIds);
await laptop.click(laptop.btn(/^Characters$/));
ok("and lists them", (laptop.vis().match(/Leviathan Hammer III/g) || []).length >= 1, laptop.vis().slice(-260));
await laptop.click(laptop.btn(/^Close$/));

console.log("\nboth devices make a character while out of touch");
{
  const held = [];
  const parked = (dev) => dev.api.attach((key, value) => { held.push([dev, key, value]); return Promise.resolve(); }, () => Promise.resolve());
  devices.forEach(parked);
  await laptop.click(laptop.btn(/^Characters$/));
  await laptop.click(laptop.btn(/^Create a character$/));
  await phone.click(phone.btn(/^Characters$/));
  await phone.click(phone.btn(/^Create a character$/));
  await settle();
  // reconnect: everything each one queued now reaches the other
  devices.forEach((d) => d.api.attach((key, value) => { deliver(d, key, value); return Promise.resolve(); }, () => Promise.resolve()));
  held.forEach(([from, key, value]) => deliver(from, key, value));
  await settle();
  const ids = (d) => JSON.parse(d.api.cache.get("pf2e:index")).ids;
  ok("neither new character is lost", ids(laptop).length === 4 && ids(phone).length === 4,
    "laptop " + ids(laptop).length + ", phone " + ids(phone).length);
  ok("and both devices agree on the list", ids(laptop).slice().sort().join() === ids(phone).slice().sort().join(),
    ids(laptop) + " vs " + ids(phone));
}

console.log("\nan older copy arriving late");
{
  const key = "pf2e:char:cOLD";
  await laptop.win.storage.set(key, JSON.stringify({ char: { id: "cOLD", name: "Newer" }, rev: 9 }));
  await wait(600);
  const stale = JSON.stringify({ char: { id: "cOLD", name: "Older" }, rev: 4 });
  laptop.api.receive(key, stale);
  ok("the newer local record survives", laptop.api.cache.get(key).includes("Newer"), laptop.api.cache.get(key));
  await wait(700);
  laptop.api.receive(key, JSON.stringify({ char: { id: "cOLD", name: "Newest" }, rev: 11 }));
  ok("a genuinely newer one is taken", laptop.api.cache.get(key).includes("Newest"), laptop.api.cache.get(key));
}

console.log(failures ? `\n${failures} failing` : "\nall green");
process.exit(failures ? 1 : 0);
