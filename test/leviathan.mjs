/* The bundled Leviathan Hammer against the character sheet PDF he was imported
   from. Every number here was read off that PDF; if the sheet's math drifts, or
   someone edits the imported character, this is where it shows up. */
import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const dom = new JSDOM(html, {
  url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true,
  beforeParse(win) { win.scrollTo = () => {}; },
});
const { window } = dom, doc = window.document;
const quiet = console.error; console.error = () => {};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
await wait(900);
console.error = quiet;

let failures = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log("  pass  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(String(extra).slice(0, 200)) : "")); }
};
const btn = (re) => [...doc.querySelectorAll("button")].find((b) => re.test(b.textContent));
const click = async (el) => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); await wait(220); };
const visible = () => [...doc.querySelector(".pf").children].filter((n) => n.tagName !== "STYLE").map((n) => n.textContent).join(" ");
const tab = (k) => doc.querySelector('.tab[data-tab="' + k + '"]');

await click(btn(/Leviathan Hammer/));

console.log("\npage one of the PDF");
ok("name, ancestry, class and racket", doc.querySelector(".sub").textContent.trim() === "Level 4 Goblin Rogue · Thief", doc.querySelector(".sub").textContent);
const stat = (label) => {
  const el = [...doc.querySelectorAll(".stat")].find((s) => (s.querySelector(".l") || {}).textContent === label);
  return el ? el.querySelector(".v").textContent.trim() : null;
};
ok("AC is 20", stat("AC") === "20", stat("AC"));
ok("Perception is +8", stat("Perception") === "+8", stat("Perception"));
for (const [label, want] of [["STR", "+2"], ["DEX", "+3"], ["CON", "+0"], ["INT", "+3"], ["WIS", "+0"], ["CHA", "+1"]]) {
  ok(label + " is " + want, stat(label) === want, stat(label));
}
const play = visible();
ok("38 hit points", /\b38\b/.test(play));
ok("speed 25", /25/.test(play));
for (const [save, want] of [["Fortitude", "+6"], ["Reflex", "+11"], ["Will", "+8"]]) {
  ok(save + " " + want, play.includes(save) && play.includes(want), save);
}
for (const w of ["Combat Grapnel", "Stiletto Pen", "Lizardfolk Fangs"]) ok(w + " is on the sheet", play.includes(w));

console.log("\nskills, with the three the rogue took to expert");
/* The skill list lives on the Play tab, each row its own button. */
const skillMod = (name) => {
  // Each row reads like "TAcrobatics+9" — a rank letter, the name, the modifier.
  const row = [...doc.querySelectorAll(".skrow")].find((n) => n.textContent.trim().replace(/^[UTEML]/, "").startsWith(name));
  const m = row && row.textContent.match(/[+-]\d+/);
  return m ? m[0] : null;
};
for (const [skill, mod] of [["Acrobatics", "+9"], ["Arcana", "+3"], ["Athletics", "+10"], ["Crafting", "+9"],
  ["Deception", "+7"], ["Diplomacy", "+7"], ["Intimidation", "+1"], ["Medicine", "+0"], ["Nature", "+6"],
  ["Occultism", "+9"], ["Performance", "+7"], ["Religion", "+0"], ["Society", "+9"], ["Stealth", "+11"],
  ["Survival", "+6"], ["Thievery", "+12"]]) {
  ok(skill + " " + mod, skillMod(skill) === mod, skillMod(skill));
}
ok("Mercantile Lore at +9", skillMod("Mercantile") === "+9", skillMod("Mercantile"));

console.log("\nthe level grid on page two");
const feats = [
  ["Fang Sharpener", "Ancestry", 1], ["Specialty Crafting", "Skill", 1], ["Dirty Trick", "Skill", 1],
  ["Tumble Behind", "Class", 1], ["Unbalancing Blow", "Class", 2], ["Lie to Me", "Skill", 2],
  ["Prescient Planner", "General", 3], ["Slippery Prey", "Skill", 3],
  ["Scoundrel's Surprise", "Class", 4], ["Crafter's Appraisal", "Skill", 4],
];
await click(tab("feats"));
const featText = visible();
for (const [name, , lv] of feats) {
  ok(name + " at level " + lv, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*L" + lv).test(featText), featText.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*L\\d+")));
}
ok("no feats beyond the ten on the PDF", (featText.match(/★/g) || []).length === feats.length, (featText.match(/★/g) || []).length);

console.log("\nnothing left outstanding on the Build tab");
await click(tab("build"));
/* Each level is a numbered button that unfolds its own checklist. */
const levelRow = (lv) => [...doc.querySelectorAll("button")].find((b) => b.textContent.trim() === String(lv));
const WANTS = {
  1: ["Class feat", "Ancestry feat", "Skill feat"],
  2: ["Class feat", "Skill feat", "Skill increase"],
  3: ["General feat", "Skill feat", "Skill increase"],
  4: ["Class feat", "Skill feat", "Skill increase"],
};
for (const lv of [1, 2, 3, 4]) {
  const row = levelRow(lv);
  if (!row) { ok("level " + lv + " unfolds", false); continue; }
  await click(row);
  const open = visible();
  for (const w of WANTS[lv]) ok("level " + lv + " lists " + w.toLowerCase(), open.includes(w), open.slice(0, 120));
  /* Every row in an unfolded level carries a dot; an unfilled slot's dot is
     missing the "done" class. */
  const dots = [...doc.querySelectorAll(".chk .dot")];
  const undone = dots.filter((d) => !d.className.split(/\s+/).includes("done")).length;
  ok("level " + lv + " has nothing outstanding", undone === 0 && dots.length > 0, undone + " undone of " + dots.length);
  await click(row);
}

console.log("\nthe library stays reachable after you have a copy");
/* Adding from the library copies the character into your own storage; that copy
   never sees later corrections, so the offer has to stay on the menu. */
await click(btn(/^Characters$/));
ok("a fresh copy is still offered", !!btn(/fresh copy of Leviathan/), visible().slice(-200));
ok("it explains why you would want one", /whatever has been fixed/.test(visible()));
await click(btn(/^Close$/));

console.log(failures ? `\n${failures} failing` : "\nall green");
process.exit(failures ? 1 : 0);
