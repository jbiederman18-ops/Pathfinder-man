// featFilter.js — search and filter logic for the feat picker.
// Kept free of React so it can be tested on its own.

/** Categories as they appear in the data, in the order a player thinks about them. */
export const CATEGORIES = [
  { key: "class", label: "Class" },
  { key: "ancestry", label: "Ancestry" },
  { key: "skill", label: "Skill" },
  { key: "general", label: "General" },
  { key: "archetype", label: "Archetype" }, // a trait, not a category — see matchesCategory
];

const norm = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * Build a search index once per data load. Strips HTML from descriptions so a
 * search for "flanking" finds feats that mention it in their rules text.
 */
export function buildIndex(feats) {
  return feats.map((feat) => ({
    feat,
    name: norm(feat.name),
    traits: feat.traits.map(norm),
    body: norm((feat.description || "").replace(/<[^>]+>/g, " ")),
  }));
}

/** Archetype is expressed as a trait; everything else is a real category. */
function matchesCategory(feat, categories) {
  if (!categories.length) return true;
  return categories.some((c) =>
    c === "archetype" ? feat.traits.includes("archetype") : feat.category === c
  );
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Prepare a query once per search rather than once per feat: split it into
 * tokens and precompile the word-boundary test for each.
 *
 * Tokens are matched with AND, so "dwarf stone" finds feats matching both
 * rather than only the literal phrase "dwarf stone".
 */
function prepareQuery(raw) {
  const phrase = norm(raw.trim());
  if (!phrase) return null;
  const tokens = phrase.split(/\s+/).filter(Boolean).map((t) => ({ text: t, wordStart: new RegExp(`\\b${escapeRe(t)}`) }));
  return { phrase, tokens };
}

/** Best score for a single token against one entry, or -1 if it appears nowhere. */
function scoreToken(entry, token) {
  const { name, traits, body } = entry;
  if (name.startsWith(token.text)) return 80;
  if (token.wordStart.test(name)) return 60;
  if (name.includes(token.text)) return 40;
  if (traits.some((t) => t.startsWith(token.text))) return 20;
  if (body.includes(token.text)) return 10;
  return -1;
}

/**
 * Relevance score, or -1 for no match. Every token must appear somewhere;
 * the feat is then ranked by its weakest token, so a feat matching both words
 * strongly outranks one that matches a word in its name and one buried in
 * its rules text.
 */
function score(entry, query) {
  if (!query) return 0;

  // Whole-phrase name hits always win.
  if (entry.name === query.phrase) return 200;
  if (entry.name.startsWith(query.phrase)) return 150;

  let weakest = Infinity;
  for (const token of query.tokens) {
    const s = scoreToken(entry, token);
    if (s < 0) return -1;
    if (s < weakest) weakest = s;
  }
  return weakest;
}

/**
 * Filter and rank.
 *
 * filters: {
 *   query, maxLevel, minLevel, categories[], traits[], traitMode, actionTypes[],
 *   includeRare, excludeIds[]
 * }
 *
 * traitMode is "any" (default) or "all".
 */
export function filterFeats(index, filters = {}) {
  const {
    query = "",
    maxLevel = null,
    minLevel = null,
    categories = [],
    traits = [],
    traitMode = "any",
    actionTypes = [],
    includeRare = true,
    excludeIds = [],
  } = filters;

  const q = prepareQuery(query);
  const excluded = new Set(excludeIds);
  const wantTraits = traits.map(norm);
  const results = [];

  for (const entry of index) {
    const feat = entry.feat;

    if (excluded.has(feat.id)) continue;
    if (maxLevel != null && feat.level > maxLevel) continue;
    if (minLevel != null && feat.level < minLevel) continue;
    if (!includeRare && feat.rarity) continue;
    if (!matchesCategory(feat, categories)) continue;
    if (actionTypes.length && !actionTypes.includes(feat.actionType || "passive")) continue;

    // "any" is the default because the traits a player reaches for are usually
    // alternatives (their class OR their ancestry), and those never co-occur on
    // one feat. "all" is there for narrowing within a set.
    if (wantTraits.length) {
      const ok =
        traitMode === "all"
          ? wantTraits.every((t) => entry.traits.includes(t))
          : wantTraits.some((t) => entry.traits.includes(t));
      if (!ok) continue;
    }

    const s = score(entry, q);
    if (s < 0) continue;

    results.push({ feat, score: s });
  }

  results.sort((a, b) => b.score - a.score || a.feat.level - b.feat.level || a.feat.name.localeCompare(b.feat.name));
  return results.map((r) => r.feat);
}

/** Every trait present in the data, with counts, for building the trait filter. */
export function traitCounts(feats) {
  const counts = new Map();
  for (const feat of feats) {
    for (const t of feat.traits) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * Suggest the traits worth pre-filtering by, given a character. A level 5
 * fighter dwarf mostly wants fighter feats and dwarf feats.
 */
export function suggestedTraits(character = {}) {
  return [character.class, character.ancestry].filter(Boolean).map((s) => s.toLowerCase());
}

/** PF2e action-cost glyphs. Passive feats get nothing. */
export function actionGlyph(feat) {
  switch (feat.actionType) {
    case "action":
      return "◆".repeat(Math.min(Math.max(Number(feat.actions) || 1, 1), 3));
    case "reaction":
      return "↺";
    case "free":
      return "◇";
    default:
      return "";
  }
}

export function actionLabel(feat) {
  switch (feat.actionType) {
    case "action": {
      const n = Number(feat.actions) || 1;
      return n === 1 ? "Single action" : `${n} actions`;
    }
    case "reaction":
      return "Reaction";
    case "free":
      return "Free action";
    default:
      return "Passive";
  }
}
