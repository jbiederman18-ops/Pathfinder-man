/* Bundles the app into a single self-contained index.html.
 *
 *   npm install && npm run build
 *
 * Everything — React, the sheet, the styles — ends up inline in that one file,
 * so it can be served by GitHub Pages straight from the repository with no
 * build step, and opened from a phone with nothing installed.
 */
import { build } from "esbuild";
import { writeFileSync, readFileSync } from "node:fs";

const PROXY = process.env.VITE_API_PROXY || process.env.API_PROXY || "";

/* Optional. A Firebase web config as JSON, which turns on cross-device sync.
   Without it the sheet saves to the browser it's opened in. */
const FIREBASE = process.env.FIREBASE_CONFIG || "{}";
try { JSON.parse(FIREBASE); } catch { throw new Error("FIREBASE_CONFIG is not valid JSON"); }

const sync = await build({
  entryPoints: ["src/sync.js"],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2020"],
  write: false,
});

const out = await build({
  entryPoints: ["src/main.jsx"],
  bundle: true,
  format: "iife",
  minify: true,
  target: ["es2020"],
  jsx: "automatic",
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});

const js = out.outputFiles[0].text;
const shell = readFileSync("src/shell.html", "utf8");

/* Home-screen artwork, inlined. Three directions live in src/icons; pick one
   with ICON=twenty npm run build. iOS only reads PNG from apple-touch-icon,
   so these are rasters rather than the SVG the rest of the sheet uses. */
const ICON = process.env.ICON || "facet";
const icon = (size) => readFileSync(`src/icons/${ICON}-${size}.png`).toString("base64");

const manifest = {
  name: "Pathfinder 2e Sheet",
  short_name: "PF2e Sheet",
  display: "standalone",
  background_color: "#12152b",
  theme_color: "#12152b",
  start_url: ".",
  icons: [192, 512].map((size) => ({
    src: `data:image/png;base64,${icon(size)}`,
    sizes: `${size}x${size}`,
    type: "image/png",
    purpose: "any",
  })),
};
const html = shell
  .replace("__ICON180__", () => icon(180))
  .replace("__ICON192__", () => icon(192))
  .replace("__MANIFEST__", () => Buffer.from(JSON.stringify(manifest)).toString("base64"))
  .replace("__PROXY__", JSON.stringify(PROXY))
  .replace("__FIREBASE__", () => FIREBASE)
  .replace("__SYNC__", () => sync.outputFiles[0].text)
  .replace("__APP__", () => js);

writeFileSync("index.html", html);
console.log("index.html written:", (html.length / 1024).toFixed(0) + " kB");
