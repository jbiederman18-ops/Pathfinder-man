/* The guided first-character builder, start to finish: every step, the
   blockers that stop you skipping one, and the sheet it leaves behind. */
import { JSDOM } from "jsdom";
const dom = await JSDOM.fromFile("index.html", {
  runScripts: "dangerously", pretendToBeVisual: true, url: "https://example.test/",
  // jsdom has no layout, so its scrollTo only knows how to complain.
  beforeParse(win) { win.scrollTo = () => {}; },
});
const w = dom.window, doc = w.document;
const errs = [];
w.addEventListener("error", (e) => errs.push(e.message));
const oe = console.error;
console.error = (...a) => { const s = String(a[0]); if (!/not wrapped in act|Warning:/.test(s)) errs.push(s.slice(0, 200)); };
const tick = (ms = 90) => new Promise((r) => setTimeout(r, ms));
const visible = () => [...doc.querySelector(".pf").children].filter((n) => n.tagName !== "STYLE").map((n) => n.textContent).join(" ");
const btn = (re) => [...doc.querySelectorAll("button")].find((b) => re.test(b.textContent));
const click = async (re) => { const b = btn(re); if (!b) throw new Error("no button " + re + "\n" + visible().slice(0, 600)); b.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick(); };
let failures = 0;
const ok = (n, c, x) => {
  if (c) console.log("  pass  " + n);
  else { failures++; console.log("  FAIL  " + n + (x ? "  -> " + JSON.stringify(String(x).slice(0, 200)) : "")); }
};

await tick(800);
console.log("\nguided setup");
ok("landing offers the guided route", /Create a character — walk me through it/.test(visible()));
await click(/Create a character — walk me through it/);
ok("opens on step 1", /Step 1 of 8/.test(visible()));
ok("tabs collapse to the setup", doc.querySelector(".tabs").textContent === "Building your character", doc.querySelector(".tabs").textContent);
await click(/^Start$/);
ok("class step, beginner list only", /Step 2 of 8/.test(visible()) && !/Wizard/.test(visible()));
await click(/Show all 17 classes/);
ok("full list expands", /Wizard/.test(visible()));
await click(/^Fighter/);
await click(/^Strength/);
ok("fighter's level-5 weapon group is not demanded", !btn(/Next: Ancestry/).disabled);
await click(/Next: Ancestry/);
ok("ancestry step", /Step 3 of 8/.test(visible()));
await click(/^Dwarf/); await click(/^Forge$/); await click(/Next: Background/);
ok("background step", /Step 4 of 8/.test(visible()));
await click(/^Warrior/);
ok("background feat granted", /Intimidating Glare/.test(visible()));
await click(/Next: Ability scores/);
ok("abilities step", /Step 5 of 8/.test(visible()));
ok("next blocked while boosts are empty", btn(/Next: Skills/).disabled);
await click(/Fill in a recommended fighter spread/);
const stats = [...doc.querySelectorAll(".stat")].slice(0, 6).map((s) => s.querySelector(".l").textContent + " " + s.querySelector(".v").textContent);
ok("recommended spread fills in", !btn(/Next: Skills/).disabled, stats.join(", "));
console.log("        " + stats.join(", "));
await click(/Next: Skills/);
ok("skills step", /Step 6 of 8/.test(visible()));
await click(/Pick these for me/);
const count = visible().match(/(\d+) of (\d+) chosen/);
ok("auto-pick fills every slot", count && count[1] === count[2], count && count[0]);
await click(/Next: Level 1 feats/);
ok("feats step", /Step 7 of 8/.test(visible()));
await click(/^Sudden Charge/); await click(/^Rock Runner/);
await click(/Next: Name and finish/);
ok("finish step", /Step 8 of 8/.test(visible()));
ok("finish blocked with no name", btn(/Finish/).disabled);
const input = [...doc.querySelectorAll("input")].find((i) => i.placeholder === "What do people call you?");
Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(input, "Durgan Ironjaw");
input.dispatchEvent(new w.Event("input", { bubbles: true }));
await tick();
ok("naming unblocks the finish", !btn(/Finish/).disabled);
await click(/Finish — open my sheet/);
await tick(200);
ok("lands on the full sheet", doc.querySelector(".tabs").textContent === "PlayBuildFeatsGearNotes", doc.querySelector(".tabs").textContent);
ok("header reads correctly", doc.querySelector(".nm").textContent === "Durgan Ironjaw" && /Level 1 Dwarf Fighter/.test(doc.querySelector(".sub").textContent), doc.querySelector(".sub").textContent);
ok("the play tab works", /Fortitude/.test(visible()) && /Strikes/.test(visible()));
const build = doc.querySelector('.tab[data-tab="build"]');
build.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
await tick(150);
ok("build tab is the classic sheet again", /Ability boosts/.test(visible()) && /Walk me through it/.test(visible()));
const chk = [...doc.querySelectorAll(".chk")].map((x) => x.textContent).join(" | ");
ok("level 1 checklist lists a class feat", /Class feat/.test(chk), chk.slice(0, 160));
await tick(900);
ok("it saved", !!w.localStorage.getItem("pf2e-store:pf2e:index"));
console.error = oe;
ok("no runtime errors", errs.length === 0, errs[0]);
console.log(failures ? `\n${failures} failing` : "\nall green");

process.exit(failures ? 1 : 0);
