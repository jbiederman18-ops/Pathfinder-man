import { JSDOM } from "jsdom";
import fs from "fs";

const FILE = new URL("../index.html", import.meta.url);
const html = fs.readFileSync(FILE, "utf8");

function character(over) {
  return Object.assign({
    id: "cTEST", name: "Test Subject", player: "", level: 1, xp: 0,
    ancestry: "human", heritage: "", ancFree: ["str", "dex"], ancFlawFree: "",
    background: "acolyte", bgPick: "wis", bgFree: ["con"], cls: "fighter", subclass: "",
    keyAbility: "str", l1Free: [], boosts: { 5: [], 10: [], 15: [], 20: [] },
    trainedSkills: [], skillIncreases: {}, lores: [], feats: [], profOverride: {},
    weapons: [], items: [], armor: "Unarmored", shield: "No shield",
    armorPotency: 0, armorResilient: 0, shieldRaised: false, shieldHP: 0,
    coins: { pp: 0, gp: 0, sp: 0, cp: 0 }, spellAbility: "", spellTradition: "",
    spellsKnown: [], slotsUsed: {}, focusCur: 1, focusMax: 1, hpBonus: 0, acAdjust: 0,
    archetypeCasting: false, customSlots: null, bgName: "", hp: null, tempHp: 0,
    dying: 0, wounded: 0, hero: 1, conditions: {}, effects: [], favorites: [],
    notes: "", createdAt: 0
  }, over || {});
}
const weapon = (base, over) => Object.assign({ id: "w1", base, name: base, potency: 0, striking: 0 }, over || {});

async function open(char) {
  const dom = new JSDOM(html, {
    url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true,
    beforeParse(win) {
      win.localStorage.setItem("pf2e-store:pf2e:index", JSON.stringify({ ids: [char.id], activeId: char.id, theme: "slate", v: 4 }));
      win.localStorage.setItem("pf2e-store:pf2e:char:" + char.id, JSON.stringify({ char, rev: 1, updatedAt: 1 }));
    }
  });
  const { window } = dom, doc = window.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const quiet = console.error; console.error = () => {};
  await wait(800);
  console.error = quiet;
  const click = n => { n.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); return wait(200); };
  return {
    window, doc, wait, click,
    maxRolls() { window.Math.random = () => 0.99999; },     // every die comes up max
    button(t) { return [...doc.querySelectorAll("button")].find(b => b.textContent.trim() === t); },
    // The HP card has a Damage button too, so strike rolls are looked up inside the strike row.
    strikeButton(t) { return [...doc.querySelectorAll(".atk button")].find(b => b.textContent.trim() === t); },
    strike() { return (doc.querySelector(".atk .mut.xs") || {}).textContent || ""; },
    stat(label) {
      const n = [...doc.querySelectorAll(".stat")].find(s => (s.querySelector(".l") || {}).textContent === label);
      return n ? (n.querySelector(".v") || {}).textContent : null;
    },
    lastRoll() {
      const line = doc.querySelector(".logline");
      if (!line) return null;
      return { total: +line.querySelector("strong.big").textContent, detail: line.textContent };
    },
    tab(name) { return click(doc.querySelector(`.tab[data-tab="${name}"]`)); },
    plan() { return [...doc.querySelectorAll(".chk")].map(n => n.textContent); },
    // React tracks input values, so a plain .value assignment is ignored.
    async type(el, value) {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(value));
      el.dispatchEvent(new window.Event("input", { bubbles: true }));
      await wait(80);
    },
    skill(name) {
      const row = [...doc.querySelectorAll(".skrow")].find(r => (r.querySelector(".row .sm") || {}).textContent === name);
      if (!row) throw new Error("no skill row for " + name);
      return { rank: (row.querySelector(".rk") || {}).textContent, mod: (row.querySelector(".mo") || {}).textContent };
    },
    counter(label) {
      const row = [...doc.querySelectorAll(".row")].find(r => (r.querySelector(".xs.mut") || {}).textContent === label);
      return row ? +row.querySelector("strong").textContent : null;
    },
    // Only what is rendered. document.body.textContent would also hand back the
    // inlined bundle, so assertions would match the source instead of the page.
    text() { return (doc.querySelector(".pf") || doc.body).textContent; }
  };
}

let failures = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log("  pass  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
};

// A rapier is 1d6 deadly d8. Strength 12 here, so +1 damage.
console.log("\ndeadly on a critical hit");
{
  const p = await open(character({ ancFree: ["str", "dex"], weapons: [weapon("Rapier")] }));
  p.maxRolls();
  ok("the strike row flags the trait", p.strike().includes("deadly"), p.strike());
  await p.click(p.strikeButton("Damage"));
  const normal = p.lastRoll();
  ok("a normal hit is just the weapon die plus Strength", normal.total === 6 + 2, normal);
  await p.click(p.strikeButton("Crit"));
  const crit = p.lastRoll();
  // (6 + 2) doubled, then a d8 added on top and not doubled.
  ok("a crit doubles, then adds the deadly die undoubled", crit.total === (6 + 2) * 2 + 8, crit);
  ok("the log shows the deadly die separately", crit.detail.includes("deadly"), crit.detail);
}

// Deadly scales with striking: two dice with a striking rune.
console.log("\ndeadly scales with striking");
{
  const p = await open(character({ weapons: [weapon("Rapier", { striking: 1 })] }));
  p.maxRolls();
  await p.click(p.strikeButton("Crit"));
  const crit = p.lastRoll();
  ok("striking turns one deadly die into two", crit.total === (12 + 2) * 2 + 16, crit);
}

// A flintlock pistol is 1d4 fatal d8: the die changes and an extra one is added,
// all of it inside the doubling.
console.log("\nfatal on a critical hit");
{
  const p = await open(character({ weapons: [weapon("Flintlock Pistol")] }));
  p.maxRolls();
  ok("the strike row flags the trait", p.strike().includes("fatal"), p.strike());
  await p.click(p.strikeButton("Damage"));
  ok("a normal hit rolls the printed die", p.lastRoll().total === 4, p.lastRoll());
  await p.click(p.strikeButton("Crit"));
  ok("a crit upgrades the die, adds one, and doubles the lot", p.lastRoll().total === 16 * 2, p.lastRoll());
}

// A bastard sword is 1d8, or 1d12 in two hands.
console.log("\ntwo-hand");
{
  const one = await open(character({ weapons: [weapon("Bastard Sword")] }));
  ok("one-handed it rolls its printed die", one.strike().startsWith("1d8"), one.strike());
  const two = await open(character({ weapons: [weapon("Bastard Sword", { twoHanded: true })] }));
  ok("both hands swap the die", two.strike().startsWith("1d12"), two.strike());
  ok("the strike row says which grip", two.strike().includes("two hands"), two.strike());
  await two.tab("gear");
  ok("the Gear tab offers the grip toggle", !!two.button("Both hands · d12"), two.text().slice(0, 0));
}

// Enfeebled is a penalty to Strength-based damage, not to a bow.
console.log("\nenfeebled");
{
  const well = await open(character({ weapons: [weapon("Longsword")] }));
  const weak = await open(character({ weapons: [weapon("Longsword")], conditions: { enfeebled: 2 } }));
  // Strength 14 gives +2; enfeebled 2 cancels it exactly, so no modifier shows.
  ok("melee damage drops", well.strike().startsWith("1d8+2") && weak.strike().startsWith("1d8 "),
    { well: well.strike().slice(0, 8), weak: weak.strike().slice(0, 8) });
  const bow = await open(character({ weapons: [weapon("Shortbow")], conditions: { enfeebled: 2 } }));
  ok("a bow is unaffected", !bow.strike().includes("-"), bow.strike());
}

// Conditions with a value step down rather than vanishing.
console.log("\nconditions");
{
  const p = await open(character({ conditions: { frightened: 3 } }));
  const pill = [...p.doc.querySelectorAll(".pill.on")].find(b => b.textContent.includes("Frightened"));
  ok("the pill shows its value", pill.textContent.includes("3"), pill.textContent);
  await p.click(pill);
  ok("tapping steps it down one", p.text().includes("Frightened 2"), p.text().match(/Frightened \d/));
  const nextRound = p.button("Next round");
  ok("Next round is offered even with no effects running", !!nextRound);
  await p.click(nextRound);
  ok("it counts frightened down too", p.text().includes("Frightened 1"), p.text().match(/Frightened \d/));
}

// Initiative can follow a skill.
console.log("\ninitiative");
{
  const p = await open(character({ trainedSkills: ["stealth"], ancFree: ["dex", "con"] }));
  const perception = p.stat("Perception");
  ok("it defaults to Perception", p.stat("Initiative") === perception, { init: p.stat("Initiative"), perception });
  const select = [...p.doc.querySelectorAll("select")].find(s => s.getAttribute("aria-label") === "Roll initiative with");
  ok("the picker is on the Play tab", !!select);
  select.value = "stealth";
  select.dispatchEvent(new p.window.Event("change", { bubbles: true }));
  await p.wait(200);
  const stealthRow = [...p.doc.querySelectorAll(".skrow")].find(r => (r.querySelector(".row .sm") || {}).textContent === "Stealth");
  ok("it follows the chosen skill", p.stat("Initiative") === stealthRow.querySelector(".mo").textContent,
    { init: p.stat("Initiative"), stealth: stealthRow.querySelector(".mo").textContent });
}

// A thousand coins is one Bulk.
console.log("\ncoins and Bulk");
{
  const p = await open(character({ coins: { pp: 0, gp: 2400, sp: 0, cp: 0 } }));
  await p.tab("gear");
  ok("coins count toward the load", p.text().includes("Bulk 2 /"), p.text().match(/Bulk [\d.]+ \/ \d+/));
}

// Rogues take a skill feat at every level.
console.log("\nskill feat cadence");
{
  const rogue = await open(character({ cls: "rogue", keyAbility: "dex", level: 3 }));
  await rogue.tab("build");
  const level3 = [...rogue.doc.querySelectorAll(".pill")].find(b => b.textContent.trim() === "3");
  await rogue.click(level3);
  ok("level 3 offers a rogue a skill feat", rogue.plan().some(t => t.startsWith("Skill feat")), rogue.plan());
  const fighter = await open(character({ level: 3 }));
  await fighter.tab("build");
  await fighter.click([...fighter.doc.querySelectorAll(".pill")].find(b => b.textContent.trim() === "3"));
  ok("a fighter still alternates", !fighter.plan().some(t => t.startsWith("Skill feat")), fighter.plan());
}


// ---- derived numbers ----------------------------------------------------

// An Acolyte trains Religion; the Build tab says so, so the maths must agree.
console.log("\nbackground-trained skill");
{
  const p = await open(character({ level: 5, l1Free: ["str", "dex", "con", "wis"], boosts: { 5: ["str", "dex", "con", "wis"], 10: [], 15: [], 20: [] } }));
  ok("the background skill is trained", p.skill("Religion").rank === "T", p.skill("Religion"));
  ok("level 5 + trained 2 + Wis 3", p.skill("Religion").mod === "+10", p.skill("Religion"));
  ok("skills you never took stay untrained", p.skill("Arcana").rank === "U");
}

// Clumsy is a Dex penalty, so it applies to AC as well as Reflex, and status
// penalties take the worst rather than adding or averaging.
console.log("\nstatus penalties");
{
  const plain = await open(character());
  const clumsy = await open(character({ conditions: { clumsy: 2 } }));
  ok("clumsy lowers AC", +clumsy.stat("AC") === +plain.stat("AC") - 2, { plain: plain.stat("AC"), clumsy: clumsy.stat("AC") });
  const both = await open(character({ conditions: { clumsy: 2, fatigued: 1 } }));
  ok("fatigued doesn't soften clumsy on Reflex", both.stat("Reflex") === clumsy.stat("Reflex"),
    { both: both.stat("Reflex"), clumsy: clumsy.stat("Reflex") });
  ok("or on AC", both.stat("AC") === clumsy.stat("AC"));
}

// Devotion spells are not a prepared caster's slot table.
console.log("\nspell slots");
{
  const champ = await open(character({ cls: "champion", subclass: "Paladin" }));
  await champ.tab("spells");
  ok("a champion keeps focus points", champ.text().includes("Focus points"));
  ok("and gets no slot grid", !champ.text().includes("Rank 3"), champ.text().match(/Rank \d/g));
  const wiz = await open(character({ cls: "wizard", keyAbility: "int", level: 5 }));
  await wiz.tab("spells");
  ok("a wizard still gets one", wiz.text().includes("Rank 3"));
}

// Encumbrance is a rule, not a warning.
console.log("\nencumbrance");
{
  const light = await open(character());
  const heavy = await open(character({ items: [{ id: "i1", name: "Anvil", bulk: 20, price: 0, qty: 1 }] }));
  ok("Speed drops 10 ft when overloaded", +heavy.stat("Speed").split(" ")[0] === +light.stat("Speed").split(" ")[0] - 10,
    { light: light.stat("Speed"), heavy: heavy.stat("Speed") });
}

// Dropping to 0 starts you dying; being hit again pushes it further.
console.log("\ndying");
{
  const p = await open(character({ hp: 5, wounded: 1 }));
  const amount = [...p.doc.querySelectorAll("input")].find(i => i.getAttribute("placeholder") === "Amount");
  const hit = async (n) => {
    await p.type(amount, n);
    await p.click([...p.doc.querySelectorAll("button")].find(b => b.textContent.trim() === "Damage"));
  };
  await hit(99);
  ok("first knockdown is dying 1 + wounded", p.text().includes("Dying (dies at 4)") && p.counter("Dying (dies at 4)") === 2, p.counter("Dying (dies at 4)"));
  await hit(5);
  ok("a hit while down makes it worse", p.counter("Dying (dies at 4)") === 3, p.counter("Dying (dies at 4)"));
}

// A level's worth of HP arrives at full strength.
console.log("\nlevelling");
{
  const p = await open(character({ level: 3, hp: 20 }));
  const before = p.text().match(/(\d+)\s*\/\s*(\d+)/);
  await p.tab("build");
  await p.click([...p.doc.querySelectorAll("button")].find(b => b.textContent.startsWith("Level up to")));
  await p.tab("play");
  const after = p.text().match(/(\d+)\s*\/\s*(\d+)/);
  const gained = +after[2] - +before[2];
  ok("maximum HP rises", gained > 0, { before: before[2], after: after[2] });
  ok("current HP rises with it", +after[1] - +before[1] === gained, { before: before[1], after: after[1], gained });
}

// The characters bundled into the file are imports from real PDFs, so they are
// checked against the numbers printed on those sheets.
console.log("\nbundled characters");
{
  const html2 = html;   // fresh window, no seeded storage: the start screen offers them
  const { JSDOM: J } = await import("jsdom");
  const dom = new J(html2, { url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true });
  const w = dom.window, doc = w.document;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const click = n => { n.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); return wait(250); };
  const quiet = console.error; console.error = () => {};
  await wait(800); console.error = quiet;

  const offer = [...doc.querySelectorAll("button")].find(b => b.textContent.includes("Leviathan"));
  ok("Leviathan Hammer is offered from the library", !!offer);
  await click(offer);

  await click(doc.querySelector('.tab[data-tab="feats"]'));
  const taken = [...doc.querySelectorAll(".card")][0];
  const names = [...taken.querySelectorAll(".ftrow strong")].map(n => n.textContent);
  ok("the feats came across", names.length === 10, names.length);
  ["Fang Sharpener", "Unbalancing Blow", "Scoundrel's Surprise", "Specialty Crafting",
   "Lie to Me", "Prescient Planner", "Slippery Prey", "Crafter's Appraisal"].forEach((n) =>
    ok(`  ${n}`, names.includes(n), names));

  await click(doc.querySelector('.tab[data-tab="play"]'));
  const stat = (l) => {
    const n = [...doc.querySelectorAll(".stat")].find(s => (s.querySelector(".l") || {}).textContent === l);
    return n && n.querySelector(".v").textContent;
  };
  // Straight off page one of the PDF.
  const printed = { AC: "20", Fortitude: "+6", Reflex: "+11", Will: "+8", Perception: "+8", "Class DC": "19" };
  Object.entries(printed).forEach(([label, want]) =>
    ok(`${label} matches the printed sheet (${want})`, stat(label) === want, stat(label)));
  ok("Speed matches (25 ft)", stat("Speed") === "25 ft", stat("Speed"));
  ok("HP matches (38)", doc.querySelector(".pf").textContent.includes("38 / 38"));

  await click(doc.querySelector('.tab[data-tab="gear"]'));
  const gear = doc.querySelector(".pf").textContent;
  ["Charlatan's Gloves", "Masquerade Scarf", "Handwraps", "Spacious Pouch", "Keymaking Tools"].forEach((n) =>
    ok(`  carries ${n}`, gear.includes(n)));
  // Coins live in inputs, so they are read off the element rather than the text.
  const coinField = [...doc.querySelectorAll("label")].find(l => l.textContent.startsWith("Gold"));
  ok("the gold came across", coinField && coinField.querySelector("input").value === "2014",
    coinField && coinField.querySelector("input").value);
  ok("not accidentally encumbered", !gear.includes("You're encumbered"));
}

// ---- themes ------------------------------------------------------------
console.log("\nthemes");
{
  const p = await open(character({ weapons: [weapon("Longsword")] }));
  const root = p.doc.querySelector(".pf");
  const css = () => p.doc.querySelector(".pf style").textContent;
  const varOf = (n) => {
    const m = new RegExp("--" + n + ":([^;]+)").exec(css());
    return m && m[1].trim();
  };

  ok("slate is the default", varOf("brass") === "#5fd8ff", varOf("brass"));
  ok("it runs on near-black", varOf("ink") === "#07090e", varOf("ink"));
  ok("headings are tracked out and uppercased", /\.card h3\{[^}]*text-transform:uppercase/.test(css()));
  ok("the survey grid is sized", /\.pf\{background-size:44px 44px/.test(css()));
  ok("the die gets tracking rings", /\.die:before,\.pf \.die:after/.test(css()));
  ok("motion is opt-out", /prefers-reduced-motion/.test(css()));
  ok("no dreidel on slate", !/dreidelspin/.test(css()));

  // Switch to the goblin theme the way a person would: the swatch in the top
  // bar opens the picker, then pick it by name.
  await p.click(p.doc.querySelector('button[aria-label="Change theme"]'));
  const choice = [...p.doc.querySelectorAll("button")].find((b) => b.textContent.includes("Jewish goblin"));
  ok("the theme picker offers it", !!choice);
  await p.click(choice);
  const close = [...p.doc.querySelectorAll("button")].find((b) => b.textContent.trim() === "Close" || b.textContent.trim() === "Done");
  if (close) await p.click(close);

  ok("the accent goes back to brass", varOf("brass") === "#e0a63c", varOf("brass"));
  ok("the die becomes a dreidel", /dreidelspin/.test(css()));
  ok("it wobbles down rather than stopping dead", /dreidelsettle/.test(css()));
  ok("gelt pops on a crit", /@keyframes gelt/.test(css()));
  ok("Hebrew faces are named, not left to chance", /Arial Hebrew/.test(css()));
  ok("the drawing is inlined", /viewBox='0 0 100 124'/.test(css()));

  // Roll something and watch what the die shows.
  const strike = [...p.doc.querySelectorAll(".atk button")].find((b) => b.textContent.trim() === "Damage");
  await p.click(strike);
  const die = p.doc.querySelector(".die");
  ok("a die is on screen", !!die);
  const HEB = ["\u05E0", "\u05D2", "\u05D4", "\u05E9"];
  ok("it shows a dreidel letter while spinning", HEB.includes(die.textContent), die.textContent);
  ok("and it is spinning", die.getAttribute("data-phase") === "rolling");
  await p.wait(800);
  const landed = p.doc.querySelector(".die");
  ok("it lands on the number", /^\d+$/.test(landed.textContent), landed.textContent);
  ok("and has settled", landed.getAttribute("data-phase") !== "rolling", landed.getAttribute("data-phase"));
}

// ---- the floating controls --------------------------------------------
// They used to jump to a flat 45vh whenever the roll log opened, which parked
// them in the middle of the screen when the log only had a couple of rolls in
// it. They now ride on the log's measured height.
console.log("\nfloating controls follow the roll log");
{
  const p = await open(character({ weapons: [weapon("Longsword")] }));
  const root = p.doc.documentElement;
  const ask = p.doc.querySelector(".askbtn");
  const sync = p.doc.getElementById("pf2e-sync");

  ok("Ask Claude has no inline bottom to fight the stylesheet", !ask.style.bottom, ask.style.bottom);
  ok("it starts sitting on the log variable", root.style.getPropertyValue("--logh") === "0px",
    root.style.getPropertyValue("--logh"));

  // Roll something; the log opens by itself.
  await p.click([...p.doc.querySelectorAll(".atk button")].find(b => b.textContent.trim() === "Damage"));
  await p.wait(300);
  const log = p.doc.querySelector(".log");
  ok("the log opened", !!log);

  // jsdom reports no layout, so the height is stubbed to stand in for a short
  // log — the point is that the offset tracks it rather than ignoring it.
  Object.defineProperty(log, "offsetHeight", { value: 180, configurable: true });
  p.window.dispatchEvent(new p.window.Event("resize"));
  await p.wait(120);
  ok("the offset follows the log's real height", root.style.getPropertyValue("--logh") === "180px",
    root.style.getPropertyValue("--logh"));

  const usesVar = (sel) => {
    const css = [...p.doc.querySelectorAll("style")].map(n => n.textContent).join("\n");
    const rule = new RegExp(sel + "\\{[^}]*bottom:calc\\(var\\(--logh");
    return rule.test(css.replace(/\s*\n\s*/g, ""));
  };
  ok("Ask Claude is positioned from it", usesVar("\\.askbtn"), "askbtn");
  ok("the sync pill is too", usesVar("#pf2e-sync"), "sync");
  ok("nothing is pinned to a fraction of the viewport any more",
    ![...p.doc.querySelectorAll("style")].some(n => /45vh/.test(n.textContent)));
  ok("the sync pill no longer needs a class toggle", !sync.classList.contains("up"));

  // Closing the log puts them back down.
  await p.click([...p.doc.querySelectorAll(".log button")].find(b => b.textContent.trim() === "Hide"));
  await p.wait(150);
  ok("closing the log resets the offset", root.style.getPropertyValue("--logh") === "0px",
    root.style.getPropertyValue("--logh"));
}

console.log(failures ? `\n${failures} failing` : "\nall green");
process.exit(failures ? 1 : 0);
