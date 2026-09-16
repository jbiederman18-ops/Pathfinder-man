import { JSDOM } from "jsdom";
import fs from "fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// Syntax-check every script block before executing anything.
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
console.log(`script blocks: ${blocks.length}`);
for (const [i, b] of blocks.entries()) {
  try { new Function(b); console.log(`  block ${i}: parses (${b.length} chars)`); }
  catch (e) { console.log(`  block ${i}: SYNTAX ERROR ${e.message}`); process.exit(1); }
}

const dom = new JSDOM(html, { url: "https://example.test/", runScripts: "dangerously", pretendToBeVisual: true });
const { window } = dom;
const errors = [];
window.addEventListener("error", e => errors.push(e.message));
const origErr = console.error;
console.error = (...a) => { const s = String(a[0]); if (!/not wrapped in act|Warning:/.test(s)) errors.push(s); };

const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(900);
console.error = origErr;

let failures = 0;
const ok = (name, cond, extra) => {
  if (cond) console.log("  pass  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra ? "  -> " + JSON.stringify(String(extra).slice(0, 300)) : "")); }
};

const doc = window.document;
console.log("\nboot");
ok("no runtime errors", errors.length === 0, errors[0]);
ok("the loading placeholder is gone", !doc.getElementById("boot"));
ok("the sheet mounted", !!doc.querySelector(".pf"));
ok("the start screen offers a character", doc.querySelector(".pf").textContent.includes("Create a character"));
ok("the sync control mounted alongside it", !!doc.getElementById("pf2e-sync"));

console.log("\nhome-screen icon");
{
  const touch = doc.querySelector('link[rel="apple-touch-icon"]');
  ok("an apple-touch-icon is present", !!touch);
  // iOS ignores SVG here, so it has to be a real raster.
  ok("it is a PNG data URI", (touch.getAttribute("href") || "").startsWith("data:image/png;base64,"));
  const png = Buffer.from(touch.getAttribute("href").split(",")[1], "base64");
  ok("the PNG decodes", png.slice(0, 4).toString("hex") === "89504e47");
  ok("it is 180x180, the size iOS asks for", png.readUInt32BE(16) === 180 && png.readUInt32BE(20) === 180,
    [png.readUInt32BE(16), png.readUInt32BE(20)]);

  const man = doc.querySelector('link[rel="manifest"]');
  const parsed = JSON.parse(Buffer.from(man.getAttribute("href").split(",")[1], "base64").toString());
  ok("the manifest still parses", parsed.short_name === "PF2e Sheet", parsed.short_name);
  ok("it carries both icon sizes", parsed.icons.map(i => i.sizes).join(",") === "192x192,512x512", parsed.icons.map(i => i.sizes));
  ok("the icon background matches the splash", parsed.background_color === "#12152b");
}

console.log("\nsafe areas and touch");
ok("header pads for the status bar", html.includes(".top{position:sticky;top:0;padding-top:env(safe-area-inset-top)"));
ok("inputs are 16px on phones", html.includes("@media(max-width:719px){.pf input,.pf select,.pf textarea{font-size:16px}}"));

console.log("\nopening a character");
// Add the bundled sample character, then walk into the sheet.
const byText = t => [...doc.querySelectorAll("button")].find(b => b.textContent.includes(t));
const add = byText("imported from your PDF") || byText("Danny");
ok("the bundled character is offered", !!add);
if (add) {
  add.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(300);
  ok("the play tab renders", doc.querySelector(".pf").textContent.includes("Fortitude") && doc.querySelector(".pf").textContent.includes("Strikes"));
  ok("tabs are present", !!doc.querySelector('.tab[data-tab="gear"]'));

  const stats = [...doc.querySelectorAll(".stat")].map(s => s.textContent);
  const ac = stats.find(s => s.includes("AC"));
  ok("AC is computed", /\d/.test(ac || ""), ac);

  // Skills should include the background-trained skill now.
  const build = doc.querySelector('.tab[data-tab="build"]');
  build.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  await wait(250);
  ok("the build tab renders", doc.querySelector(".pf").textContent.includes("Ability boosts"));

  await wait(900);
  const saved = window.localStorage.getItem("pf2e-store:pf2e:index");
  ok("the character saved through the sync shim", !!saved && saved.includes("ids"), saved);
}

console.log(failures ? `\n${failures} failing` : "\nall green");
process.exit(failures ? 1 : 0);
