import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadFeats } from "./pf2eData";
import { buildIndex, filterFeats, actionGlyph, actionLabel } from "./featFilter";

// Matches the sheet's own uid()
const uid = () => Math.random().toString(36).slice(2, 9);
const aon = (n) => "https://2e.aonprd.com/Search.aspx?query=" + encodeURIComponent(n);

const PAGE = 40;

/**
 * The four slot types the sheet tracks, and how each maps onto the data.
 * Archetype feats are taken with class feat slots, so they ride along with
 * "class" rather than getting a type of their own.
 */
const TYPES = [
  { key: "class", label: "Class", categories: ["class"] },
  { key: "ancestry", label: "Ancestry", categories: ["ancestry"] },
  { key: "skill", label: "Skill", categories: ["skill"] },
  { key: "general", label: "General", categories: ["general"] },
];

/** First sentence of the rules text, for the one-line note the sheet shows. */
function toNote(feat) {
  const text = (feat.description || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  const stop = text.search(/\.(\s|$)/);
  const first = stop === -1 ? text : text.slice(0, stop + 1);
  return first.length > 120 ? first.slice(0, 117).trimEnd() + "…" : first;
}

/**
 * FeatBrowser — drop-in replacement for the browse card in the Feats tab.
 * Takes the same props as the rest of the sheet's tab components.
 */
export default function FeatBrowser({ c, setChar }) {
  const [all, setAll] = useState(null);
  const [error, setError] = useState(null);

  const [type, setType] = useState("class");
  const [q, setQ] = useState("");
  const [ownOnly, setOwnOnly] = useState(true);
  const [atLevel, setAtLevel] = useState(true);
  const [rare, setRare] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const sentinel = useRef(null);

  useEffect(() => {
    let dead = false;
    loadFeats().then(
      (d) => !dead && setAll(d),
      (e) => !dead && setError(e)
    );
    return () => {
      dead = true;
    };
  }, []);

  const index = useMemo(() => (all ? buildIndex(all) : null), [all]);

  // "Just mine" narrows class feats to your class (plus archetypes, which any
  // class can take) and ancestry feats to your ancestry.
  const traits = useMemo(() => {
    if (!ownOnly) return [];
    if (type === "class") return [c.cls, "archetype"].filter(Boolean);
    if (type === "ancestry") return [c.ancestry].filter(Boolean);
    return [];
  }, [ownOnly, type, c.cls, c.ancestry]);

  const taken = c.feats || [];
  const takenNames = useMemo(() => new Set(taken.map((f) => f.name.toLowerCase())), [taken]);

  const results = useMemo(() => {
    if (!index) return [];
    return filterFeats(index, {
      query: q,
      categories: TYPES.find((t) => t.key === type).categories,
      traits,
      traitMode: "any",
      maxLevel: atLevel ? c.level : null,
      includeRare: rare,
    });
  }, [index, q, type, traits, atLevel, rare, c.level]);

  useEffect(() => setShown(PAGE), [q, type, traits, atLevel, rare]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (e) => e[0].isIntersecting && setShown((s) => Math.min(s + PAGE, results.length)),
      { rootMargin: "300px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [results.length]);

  const take = (feat) =>
    setChar(() => ({
      feats: [
        ...(c.feats || []),
        { id: uid(), name: feat.name, type, level: feat.level, note: toNote(feat) },
      ],
    }));

  return (
    <div className="card">
      <style>{EXTRA_CSS}</style>

      <div className="between" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Browse feats</h3>
        <span className="mut xs">
          {error ? "unavailable" : !all ? "loading…" : results.length.toLocaleString() + " shown"}
        </span>
      </div>

      <div className="row" style={{ flexWrap: "wrap", marginBottom: 8 }}>
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={"pill" + (type === t.key ? " on" : "")}
            onClick={() => {
              setType(t.key);
              setOpenId(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <input
        placeholder="Search by name, trait, or rules text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />

      <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
        {(type === "class" || type === "ancestry") && (
          <button className={"pill" + (ownOnly ? " on" : "")} onClick={() => setOwnOnly((v) => !v)}>
            {type === "class" ? "Mine and archetypes" : "My ancestry"}
          </button>
        )}
        <button className={"pill" + (atLevel ? " on" : "")} onClick={() => setAtLevel((v) => !v)}>
          Up to level {c.level}
        </button>
        <button className={"pill" + (rare ? " on" : "")} onClick={() => setRare((v) => !v)}>
          Uncommon and rare
        </button>
      </div>

      <div className="line" />

      {error && (
        <div className="empty">
          The feat list didn't load. Check that data/feats.json is deployed, then reload.
        </div>
      )}

      {!error && all && results.length === 0 && (
        <div className="empty">
          Nothing matches. Try a shorter search, or switch off a filter above.
        </div>
      )}

      {results.slice(0, shown).map((f) => {
        const open = openId === f.id;
        const have = takenNames.has(f.name.toLowerCase());
        const glyph = actionGlyph(f);
        return (
          <div className="ftrow" key={f.id}>
            <div className="between">
              <button
                className="ftname"
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
              >
                <strong className="sm">{f.name}</strong>{" "}
                <span className="badge">L{f.level}</span>{" "}
                {glyph && (
                  <span className="act" title={actionLabel(f)}>
                    {glyph}
                  </span>
                )}
                {f.rarity && <span className="badge rare">{f.rarity}</span>}
                {!open && <div className="mut xs">{toNote(f)}</div>}
              </button>
              <div className="row">
                <a className="btn sm" href={aon(f.name)} target="_blank" rel="noreferrer">
                  Text
                </a>
                <button
                  className="btn sm pri"
                  disabled={have}
                  style={have ? { opacity: 0.4 } : null}
                  onClick={() => take(f)}
                >
                  {have ? "Taken" : "Take"}
                </button>
              </div>
            </div>

            {open && (
              <div className="ftdetail">
                <div className="traits">
                  {f.traits.map((t) => (
                    <span className="trait" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
                {f.prerequisites && (
                  <div className="mut xs" style={{ marginBottom: 6 }}>
                    <strong>Prerequisites</strong> {f.prerequisites.join("; ")}
                  </div>
                )}
                <div className="fttext sm" dangerouslySetInnerHTML={{ __html: f.description }} />
                {f.source && (
                  <div className="mut xs" style={{ marginTop: 6 }}>
                    {f.source}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div ref={sentinel} />

      {all && shown < results.length && (
        <button
          className="btn sm"
          style={{ width: "100%", marginTop: 8 }}
          onClick={() => setShown((s) => Math.min(s + PAGE, results.length))}
        >
          Show more ({(results.length - shown).toLocaleString()} left)
        </button>
      )}
    </div>
  );
}

/* Only what the sheet's BASE_CSS doesn't already cover. Everything else
   reuses .card, .btn, .pill, .ftrow, .badge, .mut and the theme variables,
   so this follows whichever theme is active. */
const EXTRA_CSS = `
.pf .ftname{text-align:left;flex:1;min-width:0;background:none;border:0;padding:0;color:inherit}
.pf .act{color:var(--brass);font-size:11px;letter-spacing:1px}
.pf .badge.rare{background:var(--rkm);color:var(--rkmx);margin-left:4px}
.pf .ftdetail{padding:8px 0 4px}
.pf .traits{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}
.pf .trait{background:var(--pan2);border:1px solid var(--line);color:var(--mut);
padding:1px 7px;border-radius:3px;font-size:10.5px;font-weight:600}
.pf .fttext{max-width:68ch}
.pf .fttext p{margin:0 0 .6em}
.pf .fttext ul,.pf .fttext ol{margin:0 0 .6em;padding-left:1.2em}
.pf .fttext hr{border:0;border-top:1px solid var(--line2);margin:.7em 0}
.pf .fttext table{width:100%;border-collapse:collapse;font-size:12px}
.pf .fttext td,.pf .fttext th{border:1px solid var(--line2);padding:3px 6px;text-align:left}
`;
