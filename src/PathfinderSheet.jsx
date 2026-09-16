import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ------------------------------------------------------------------
   Pathfinder 2e character sheet
   Rules data condensed from the Archives of Nethys (2e.aonprd.com).
   Mechanics only — every entry links out to the Archives for full text.
   Pathfinder is a trademark of Paizo Inc.
------------------------------------------------------------------- */

// ---------- helpers ----------
const aon = (q) => "https://2e.aonprd.com/Search.aspx?query=" + encodeURIComponent(q);
const RANKS = ["Untrained", "Trained", "Expert", "Master", "Legendary"];
const RANKABBR = ["U", "T", "E", "M", "L"];
const ABIL = ["str", "dex", "con", "int", "wis", "cha"];
const ABILNAME = { str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma" };
const mod = (s) => Math.floor((s - 10) / 2);
const sgn = (n) => (n >= 0 ? "+" + n : "" + n);
const profBonus = (rank, level) => (rank <= 0 ? 0 : level + rank * 2);

const SKILLS = [
  ["acrobatics", "Acrobatics", "dex"], ["arcana", "Arcana", "int"], ["athletics", "Athletics", "str"],
  ["crafting", "Crafting", "int"], ["deception", "Deception", "cha"], ["diplomacy", "Diplomacy", "cha"],
  ["intimidation", "Intimidation", "cha"], ["medicine", "Medicine", "wis"], ["nature", "Nature", "wis"],
  ["occultism", "Occultism", "int"], ["performance", "Performance", "cha"], ["religion", "Religion", "wis"],
  ["society", "Society", "int"], ["stealth", "Stealth", "dex"], ["survival", "Survival", "wis"],
  ["thievery", "Thievery", "dex"],
];
const SKILLMAP = Object.fromEntries(SKILLS.map((s) => [s[0], { name: s[1], ab: s[2] }]));

// progression helper: {1:1, 5:2} => rank at each level

// ---------- ancestries ----------
const H = (...a) => a;
const ANCESTRIES = {
  dwarf: { n: "Dwarf", hp: 10, spd: 20, size: "Medium", b: ["con", "wis", "free"], f: "cha", lang: ["Common", "Dwarven"], vision: "Darkvision", her: H("Ancient-Blooded", "Death Warden", "Forge", "Rock", "Strong-Blooded", "Elemental Heart"), feats: ["Dwarven Doughtiness", "Dwarven Lore", "Dwarven Weapon Familiarity", "Mountain Strategy", "Rock Runner", "Unburdened Iron", "Vengeful Hatred"] },
  elf: { n: "Elf", hp: 6, spd: 30, size: "Medium", b: ["dex", "int", "free"], f: "con", lang: ["Common", "Elven"], vision: "Low-light vision", her: H("Ancient Elf", "Arctic Elf", "Cavern Elf", "Desert Elf", "Seer Elf", "Whisper Elf", "Woodland Elf"), feats: ["Ancestral Longevity", "Elven Lore", "Elven Weapon Familiarity", "Forlorn", "Nimble Elf", "Otherworldly Magic", "Unwavering Mien"] },
  gnome: { n: "Gnome", hp: 8, spd: 25, size: "Small", b: ["con", "cha", "free"], f: "str", lang: ["Common", "Fey", "Gnomish"], vision: "Low-light vision", her: H("Chameleon Gnome", "Fey-Touched Gnome", "Sensate Gnome", "Umbral Gnome", "Wellspring Gnome"), feats: ["Animal Accomplice", "Fey Fellowship", "First World Magic", "Gnome Obsession", "Gnome Weapon Familiarity", "Illusion Sense", "Razzle-Dazzle"] },
  goblin: { n: "Goblin", hp: 6, spd: 25, size: "Small", b: ["dex", "cha", "free"], f: "wis", lang: ["Common", "Goblin"], vision: "Darkvision", her: H("Charhide Goblin", "Irongut Goblin", "Razortooth Goblin", "Snow Goblin", "Unbreakable Goblin", "Treedweller Goblin"), feats: ["Burn It!", "City Scavenger", "Goblin Lore", "Goblin Scuttle", "Goblin Song", "Goblin Weapon Familiarity", "Junk Tinker", "Rough Rider", "Very Sneaky"] },
  halfling: { n: "Halfling", hp: 6, spd: 25, size: "Small", b: ["dex", "wis", "free"], f: "str", lang: ["Common", "Halfling"], vision: "Normal", her: H("Gutsy Halfling", "Hillock Halfling", "Jinxed Halfling", "Nomadic Halfling", "Twilight Halfling", "Wildwood Halfling"), feats: ["Distracting Shadows", "Folksy Patter", "Halfling Lore", "Halfling Luck", "Halfling Weapon Familiarity", "Prairie Rider", "Sure Feet", "Titan Slinger", "Unfettered Halfling", "Watchful Halfling"] },
  human: { n: "Human", hp: 8, spd: 25, size: "Medium", b: ["free", "free"], f: null, lang: ["Common"], vision: "Normal", her: H("Skilled Heritage", "Versatile Heritage"), feats: ["Adapted Cantrip", "Cooperative Nature", "General Training", "Haughty Obstinacy", "Natural Ambition", "Natural Skill", "Unconventional Weaponry", "Viking Shieldbearer"] },
  leshy: { n: "Leshy", hp: 8, spd: 25, size: "Small", b: ["con", "wis", "free"], f: "int", lang: ["Common", "Fey"], vision: "Low-light vision", her: H("Cactus Leshy", "Fruit Leshy", "Fungus Leshy", "Gourd Leshy", "Leaf Leshy", "Lotus Leshy", "Pine Leshy", "Root Leshy", "Seaweed Leshy", "Sunflower Leshy", "Vine Leshy"), feats: ["Grasping Reach", "Harmlessly Cute", "Leshy Lore", "Leshy Superstition", "Seedpod", "Shadow of the Wilds", "Undaunted"] },
  orc: { n: "Orc", hp: 10, spd: 25, size: "Medium", b: ["str", "free"], f: null, lang: ["Common", "Orcish"], vision: "Darkvision", her: H("Badlands Orc", "Battle-Ready Orc", "Deep Orc", "Grave Orc", "Hold-Scarred Orc", "Rainfall Orc", "Winter Orc"), feats: ["Beast Trainer", "Hold Mark", "Iron Fists", "Orc Ferocity", "Orc Lore", "Orc Superstition", "Orc Weapon Familiarity", "Tusks"] },
  kobold: { n: "Kobold", hp: 6, spd: 25, size: "Small", b: ["dex", "cha", "free"], f: "con", lang: ["Common", "Draconic"], vision: "Darkvision", her: H("Caveclimber Kobold", "Dragonscaled Kobold", "Spellscale Kobold", "Strongjaw Kobold", "Tunnelflood Kobold", "Venomtail Kobold"), feats: ["Cringe", "Dragon's Presence", "Kobold Breath", "Kobold Lore", "Kobold Weapon Familiarity", "Scamper", "Snare Setter"] },
  catfolk: { n: "Catfolk", hp: 8, spd: 25, size: "Medium", b: ["dex", "cha", "free"], f: "wis", lang: ["Common", "Amurrun"], vision: "Low-light vision", her: H("Clawed Catfolk", "Cat's Eye Catfolk", "Hunting Catfolk", "Jungle Catfolk", "Liminal Catfolk", "Nine Lives Catfolk", "Sharp-Eared Catfolk", "Winter Catfolk"), feats: ["Cat Nap", "Cat's Luck", "Catfolk Lore", "Catfolk Weapon Familiarity", "Saberteeth", "Well-Met Traveler"] },
  tengu: { n: "Tengu", hp: 6, spd: 25, size: "Medium", b: ["dex", "free", "free"], f: null, lang: ["Common", "Tengu"], vision: "Low-light vision", her: H("Jinxed Tengu", "Mountainkeeper Tengu", "Skyborn Tengu", "Stormtossed Tengu", "Taloned Tengu", "Wavediver Tengu"), feats: ["Mauler", "One-Toed Hop", "Scavenger's Search", "Squawk!", "Storm's Lash", "Tengu Lore", "Tengu Weapon Familiarity"] },
  ratfolk: { n: "Ratfolk", hp: 6, spd: 25, size: "Small", b: ["dex", "int", "free"], f: "str", lang: ["Common", "Ysoki"], vision: "Low-light vision", her: H("Deep Rat", "Desert Rat", "Longsnout Rat", "Sewer Rat", "Shadow Rat", "Sned Rat", "Tunnel Rat"), feats: ["Cheek Pouches", "Rat Familiar", "Ratfolk Lore", "Ratspeak", "Tinkering Fingers", "Vicious Incisors", "Warren Navigator"] },
  lizardfolk: { n: "Lizardfolk", hp: 8, spd: 25, size: "Medium", b: ["str", "wis", "free"], f: "int", lang: ["Common", "Iruxi"], vision: "Normal", her: H("Cliffscale Lizardfolk", "Frilled Lizardfolk", "Sandstrider Lizardfolk", "Unseen Lizardfolk", "Wetlander Lizardfolk", "Woodstalker Lizardfolk"), feats: ["Bone Magic", "Consume Memories", "Iruxi Unarmored Defense", "Lizardfolk Lore", "Parthenogenic Hatchling", "Razor Claws", "Sharp Fangs"] },
  hobgoblin: { n: "Hobgoblin", hp: 8, spd: 25, size: "Medium", b: ["con", "int", "free"], f: "wis", lang: ["Common", "Goblin"], vision: "Darkvision", her: H("Elfbane Hobgoblin", "Runtboss Hobgoblin", "Smokeworker Hobgoblin", "Steelskin Hobgoblin", "Warmarch Hobgoblin", "Warrenbred Hobgoblin"), feats: ["Alchemical Scholar", "Cantorian Reinforcement", "Hobgoblin Lore", "Hobgoblin Weapon Familiarity", "Leech-Clipper", "Remorseless Lash", "Sneaky"] },
  custom: { n: "Custom ancestry", hp: 8, spd: 25, size: "Medium", b: ["free", "free"], f: null, lang: ["Common"], vision: "Normal", her: H("Custom heritage"), feats: [] },
};

// ---------- backgrounds ----------
const bg = (n, b, sk, lore, feat) => ({ n, b, sk, lore, feat });
const BACKGROUNDS = {
  acolyte: bg("Acolyte", ["int", "wis"], "religion", "Scribing", "Student of the Canon"),
  acrobat: bg("Acrobat", ["str", "dex"], "acrobatics", "Circus", "Steady Balance"),
  animal: bg("Animal Whisperer", ["wis", "cha"], "nature", "Terrain", "Train Animal"),
  artisan: bg("Artisan", ["str", "int"], "crafting", "Guild", "Specialty Crafting"),
  artist: bg("Artist", ["dex", "cha"], "crafting", "Art", "Specialty Crafting"),
  barkeep: bg("Barkeep", ["con", "cha"], "diplomacy", "Alcohol", "Hobnobber"),
  bounty: bg("Bounty Hunter", ["str", "wis"], "survival", "Legal", "Experienced Tracker"),
  charlatan: bg("Charlatan", ["int", "cha"], "deception", "Underworld", "Charming Liar"),
  criminal: bg("Criminal", ["dex", "int"], "stealth", "Underworld", "Experienced Smuggler"),
  detective: bg("Detective", ["int", "wis"], "society", "Underworld", "Streetwise"),
  emissary: bg("Emissary", ["int", "cha"], "society", "City", "Multilingual"),
  entertainer: bg("Entertainer", ["dex", "cha"], "performance", "Theater", "Fascinating Performance"),
  farmhand: bg("Farmhand", ["con", "wis"], "athletics", "Farming", "Assurance (Athletics)"),
  fieldmedic: bg("Field Medic", ["con", "wis"], "medicine", "Warfare", "Battle Medicine"),
  fortune: bg("Fortune Teller", ["int", "cha"], "occultism", "Fortune-Telling", "Oddity Identification"),
  gladiator: bg("Gladiator", ["str", "cha"], "performance", "Gladiatorial", "Impressive Performance"),
  guard: bg("Guard", ["str", "cha"], "intimidation", "Legal", "Quick Coercion"),
  herbalist: bg("Herbalist", ["con", "wis"], "nature", "Herbalism", "Natural Medicine"),
  hermit: bg("Hermit", ["con", "int"], "nature", "Terrain", "Dubious Knowledge"),
  hunter: bg("Hunter", ["dex", "wis"], "survival", "Tanning", "Survey Wildlife"),
  laborer: bg("Laborer", ["str", "con"], "athletics", "Labor", "Hefty Hauler"),
  martial: bg("Martial Disciple", ["str", "dex"], "athletics", "Warfare", "Cat Fall"),
  merchant: bg("Merchant", ["int", "cha"], "diplomacy", "Mercantile", "Bargain Hunter"),
  miner: bg("Miner", ["str", "wis"], "survival", "Mining", "Terrain Expertise (Underground)"),
  noble: bg("Noble", ["int", "cha"], "society", "Heraldry", "Courtly Graces"),
  nomad: bg("Nomad", ["con", "wis"], "survival", "Terrain", "Assurance (Survival)"),
  prisoner: bg("Prisoner", ["str", "con"], "stealth", "Underworld", "Experienced Smuggler"),
  sailor: bg("Sailor", ["str", "dex"], "athletics", "Sailing", "Underwater Marauder"),
  scholar: bg("Scholar", ["int", "wis"], "arcana", "Academia", "Assurance (Arcana)"),
  scout: bg("Scout", ["dex", "wis"], "survival", "Terrain", "Forager"),
  street: bg("Street Urchin", ["dex", "con"], "thievery", "City", "Pickpocket"),
  tinker: bg("Tinker", ["dex", "int"], "crafting", "Engineering", "Specialty Crafting"),
  warrior: bg("Warrior", ["str", "con"], "intimidation", "Warfare", "Intimidating Glare"),
  custom: bg("Custom background", ["free", "free"], "", "Custom", ""),
};

// ---------- classes ----------
// prof maps: {level: rank}
const C = (o) => o;
const CLASSES = {
  alchemist: C({
    n: "Alchemist", hp: 8, key: ["int"], skills: 3, tradition: null,
    perc: { 1: 1, 7: 2 }, fort: { 1: 2, 11: 3 }, ref: { 1: 2, 13: 3 }, will: { 1: 1, 9: 2 },
    simple: { 1: 1, 13: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 13: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 1, 13: 2 }, heavy: { 1: 0 },
    classDC: { 1: 1, 7: 2, 15: 3 },
    sub: { label: "Research field", opts: ["Bomber", "Chirurgeon", "Mutagenist", "Toxicologist"] },
    feat: [
      ["Alchemical Familiar", 1], ["Alchemical Savant", 1], ["Far Lobber", 1], ["Quick Bomber", 1],
      ["Poison Resistance", 2], ["Revivifying Mutagen", 2], ["Smoke Bomb", 2], ["Calculated Splash", 4],
      ["Efficient Alchemy", 4], ["Enduring Alchemy", 4], ["Combine Elixirs", 6], ["Debilitating Bomb", 6],
      ["Directional Bombs", 6], ["Feral Mutagen", 6],
    ],
    features: [[1, "Alchemy, infused reagents, quick alchemy, formula book"], [1, "Research field"], [3, "Alchemical expertise (class DC)"], [5, "Field discovery"], [7, "Iron will / perceptive"], [9, "Alchemical alacrity"], [11, "Juggernaut"], [13, "Alchemical mastery"], [15, "Evasion"], [17, "Alchemical perfection"], [19, "Field discovery (greater)"]],
  }),
  barbarian: C({
    n: "Barbarian", hp: 12, key: ["str"], skills: 3, tradition: null,
    perc: { 1: 2, 9: 3 }, fort: { 1: 2, 7: 3, 19: 4 }, ref: { 1: 1, 9: 2 }, will: { 1: 2, 15: 3 },
    simple: { 1: 2, 5: 3, 13: 4 }, martial: { 1: 2, 5: 3, 13: 4 }, unarmed: { 1: 2, 5: 3, 13: 4 },
    unarmored: { 1: 1, 7: 2, 19: 3 }, light: { 1: 1, 7: 2, 19: 3 }, medium: { 1: 1, 7: 2, 19: 3 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Instinct", opts: ["Animal", "Dragon", "Fury", "Giant", "Spirit", "Superstition"] },
    feat: [["Acute Vision", 1], ["Moment of Clarity", 1], ["Raging Intimidation", 1], ["Raging Thrower", 1], ["Sudden Charge", 1], ["Acute Scent", 2], ["Furious Finish", 2], ["No Escape", 2], ["Second Wind", 2], ["Shake It Off", 2], ["Fast Movement", 4], ["Raging Athlete", 4], ["Swipe", 4], ["Wounded Rage", 4], ["Animal Skin", 6], ["Attack of Opportunity", 6], ["Brutal Bully", 6], ["Dragon's Rage Breath", 6]],
    features: [[1, "Rage, instinct"], [3, "Deny advantage, juggernaut"], [5, "Brutality (weapon expertise)"], [7, "Juggernaut (master Fort), weapon specialization"], [9, "Lightning reflexes, raging resistance"], [11, "Mighty rage"], [13, "Greater juggernaut, medium armor expertise, weapon fury"], [15, "Greater weapon specialization, indomitable will"], [17, "Heightened senses, quick rage"], [19, "Armor of fury, devastator"]],
  }),
  bard: C({
    n: "Bard", hp: 8, key: ["cha"], skills: 4, tradition: "occult", casting: "spontaneous",
    perc: { 1: 2, 9: 3 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 15: 2 }, will: { 1: 2, 9: 3, 17: 4 },
    simple: { 1: 1, 11: 2, 19: 3 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2, 19: 3 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Muse", opts: ["Enigma", "Maestro", "Polymath", "Warrior"] },
    feat: [["Bardic Lore", 1], ["Hymn of Healing", 1], ["Lingering Composition", 1], ["Reach Spell", 1], ["Versatile Performance", 1], ["Well-Versed", 1], ["Cantrip Expansion", 2], ["Directed Audience", 2], ["Martial Performance", 2], ["Rallying Anthem", 2], ["Triple Time", 2], ["Courageous Advance", 4], ["Inspire Competence", 4], ["Loremaster's Etude", 4], ["Multifarious Muse", 4], ["Assured Knowledge", 6], ["Dirge of Doom", 6], ["Educate Allies", 6]],
    features: [[1, "Spellcasting, composition spells, muse"], [3, "Lightning reflexes, signature spells"], [5, "Ability boosts"], [7, "Expert spellcaster"], [9, "Great fortitude, resolve"], [11, "Bard weapon expertise, vigilant senses"], [13, "Light armor expertise, weapon specialization"], [15, "Master spellcaster"], [17, "Greater resolve"], [19, "Magnum opus"]],
  }),
  champion: C({
    n: "Champion", hp: 10, key: ["str", "dex"], skills: 2, tradition: "divine", casting: "focus",
    perc: { 1: 1, 7: 2 }, fort: { 1: 2, 9: 3 }, ref: { 1: 1, 17: 2 }, will: { 1: 2, 9: 3 },
    simple: { 1: 1, 5: 2, 13: 3 }, martial: { 1: 1, 5: 2, 13: 3 }, unarmed: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 1, 7: 2, 17: 3 }, light: { 1: 1, 7: 2, 17: 3 }, medium: { 1: 1, 7: 2, 17: 3 }, heavy: { 1: 1, 7: 2, 17: 3 },
    classDC: { 1: 1, 9: 2, 17: 3 }, spellProf: { 1: 1, 9: 2 },
    sub: { label: "Cause", opts: ["Paladin", "Redeemer", "Liberator", "Desecrator", "Antipaladin", "Tyrant"] },
    feat: [["Deity's Domain", 1], ["Ranged Reprisal", 1], ["Unimpeded Step", 1], ["Weight of Guilt", 1], ["Divine Grace", 2], ["Dragonslayer Oath", 2], ["Fiendsbane Oath", 2], ["Shining Oath", 2], ["Vengeful Oath", 2], ["Aura of Courage", 4], ["Divine Health", 4], ["Mercy", 4], ["Attack of Opportunity", 6], ["Litany against Wrath", 6], ["Loyal Warhorse", 6], ["Shield Warden", 6]],
    features: [[1, "Champion's cause, deity, champion's reaction, devotion spells, shield block"], [3, "Divine ally, general feat"], [5, "Weapon expertise, ability boosts"], [7, "Armor expertise, weapon specialization"], [9, "Champion expertise, divine smite"], [11, "Exalt"], [13, "Armor mastery, weapon mastery"], [15, "Greater weapon specialization"], [17, "Champion mastery, legendary armor"], [19, "Hero's defiance"]],
  }),
  cleric: C({
    n: "Cleric", hp: 8, key: ["wis"], skills: 2, tradition: "divine", casting: "prepared",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 15: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Doctrine", opts: ["Cloistered cleric", "Warpriest"] },
    feat: [["Deadly Simplicity", 1], ["Domain Initiate", 1], ["Harming Hands", 1], ["Healing Hands", 1], ["Holy Castigation", 1], ["Premonition of Avoidance", 1], ["Reach Spell", 1], ["Cantrip Expansion", 2], ["Communal Healing", 2], ["Emblazon Armament", 2], ["Sap Life", 2], ["Turn Undead", 2], ["Versatile Font", 2], ["Channel Smite", 4], ["Command Undead", 4], ["Directed Channel", 4], ["Necrotic Infusion", 4], ["Cast Down", 6], ["Divine Weapon", 6], ["Selective Energy", 6]],
    features: [[1, "Divine spellcasting, divine font, doctrine, deity"], [3, "Second doctrine"], [5, "Ability boosts"], [7, "Third doctrine"], [9, "Resolve"], [11, "Fourth doctrine, lightning reflexes"], [13, "Divine defense, weapon specialization"], [15, "Fifth doctrine"], [17, "Miraculous spell"], [19, "Final doctrine"]],
  }),
  druid: C({
    n: "Druid", hp: 8, key: ["wis"], skills: 2, tradition: "primal", casting: "prepared",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 15: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 1, 13: 2 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Order", opts: ["Animal", "Leaf", "Storm", "Wild", "Flame", "Untamed"] },
    feat: [["Animal Companion", 1], ["Leshy Familiar", 1], ["Reach Spell", 1], ["Storm Born", 1], ["Widen Spell", 1], ["Wild Shape", 1], ["Call of the Wild", 2], ["Enhanced Familiar", 2], ["Order Explorer", 2], ["Poison Resistance", 2], ["Form Control", 4], ["Mature Animal Companion", 4], ["Order Magic", 4], ["Thousand Faces", 4], ["Woodland Stride", 4], ["Green Empathy", 6], ["Insect Shape", 6], ["Steady Spellcasting", 6]],
    features: [[1, "Primal spellcasting, druidic order, anathema, wild empathy"], [3, "Alertness, great fortitude"], [5, "Ability boosts"], [7, "Expert spellcaster"], [9, "Druid weapon expertise, resolve"], [11, "Lightning reflexes"], [13, "Medium armor expertise, weapon specialization"], [15, "Master spellcaster"], [17, "Legendary will"], [19, "Primal hierophant"]],
  }),
  fighter: C({
    n: "Fighter", hp: 10, key: ["str", "dex"], skills: 3, tradition: null,
    perc: { 1: 2, 7: 3 }, fort: { 1: 2, 9: 3 }, ref: { 1: 2, 15: 3 }, will: { 1: 1, 3: 2 },
    simple: { 1: 2, 5: 3, 13: 4 }, martial: { 1: 2, 5: 3, 13: 4 }, unarmed: { 1: 2, 5: 3, 13: 4 }, advanced: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 1, 11: 2, 17: 3 }, light: { 1: 1, 11: 2, 17: 3 }, medium: { 1: 1, 11: 2, 17: 3 }, heavy: { 1: 1, 11: 2, 17: 3 },
    classDC: { 1: 1, 11: 2, 19: 3 },
    sub: { label: "Weapon group mastery", opts: ["Chosen at level 5 (Fighter Weapon Mastery)"] },
    feat: [["Combat Assessment", 1], ["Double Slice", 1], ["Exacting Strike", 1], ["Point-Blank Stance", 1], ["Power Attack", 1], ["Reactive Shield", 1], ["Snagging Strike", 1], ["Sudden Charge", 1], ["Aggressive Block", 2], ["Assisting Shot", 2], ["Brutish Shove", 2], ["Combat Grab", 2], ["Dueling Parry", 2], ["Intimidating Strike", 2], ["Lunge", 2], ["Double Shot", 4], ["Dual-Handed Assault", 4], ["Knockdown", 4], ["Powerful Shove", 4], ["Quick Reversal", 4], ["Shielded Stride", 4], ["Swipe", 4], ["Twin Parry", 4], ["Advanced Weapon Training", 6], ["Advantageous Assault", 6], ["Disarming Stance", 6], ["Furious Focus", 6], ["Guardian's Deflection", 6], ["Reflexive Shield", 6], ["Revealing Stab", 6], ["Shatter Defenses", 6], ["Triple Shot", 6]],
    features: [[1, "Attack of opportunity, fighter feats, shield block"], [3, "Bravery, general feat, skill increase"], [5, "Ability boosts, fighter weapon mastery"], [7, "Battlefield surveyor, weapon specialization"], [9, "Combat flexibility, juggernaut"], [11, "Armor expertise, fighter expertise"], [13, "Weapon legend"], [15, "Evasion, greater weapon specialization, improved flexibility"], [17, "Armor mastery"], [19, "Versatile legend"]],
  }),
  gunslinger: C({
    n: "Gunslinger", hp: 8, key: ["dex"], skills: 3, tradition: null,
    perc: { 1: 2, 7: 3, 15: 4 }, fort: { 1: 2, 9: 3 }, ref: { 1: 2, 9: 3 }, will: { 1: 1, 11: 2 },
    simple: { 1: 1, 5: 2, 13: 3 }, martial: { 1: 1, 5: 2, 13: 3 }, unarmed: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 1, 13: 2 }, heavy: { 1: 0 },
    classDC: { 1: 1, 11: 2, 17: 3 },
    sub: { label: "Gunslinger's way", opts: ["Way of the Drifter", "Way of the Pistolero", "Way of the Sniper", "Way of the Vanguard", "Way of the Spellshot", "Way of the Triggerbrand"] },
    feat: [["Cover Fire", 1], ["Crossbow Crack Shot", 1], ["Hit the Dirt!", 1], ["Warning Shot", 1], ["Quick Draw", 1], ["Munitions Crafter", 1], ["Defensive Armaments", 2], ["Fake Out", 2], ["Pistol Twirl", 2], ["Risky Reload", 3], ["Sword and Pistol", 4], ["Phalanx Breaker", 5], ["Grit and Tenacity", 6], ["Instant Backup", 6], ["Paired Shots", 6]],
    features: [[1, "Gunslinger's way, singular expertise, initial deed"], [3, "Gunslinger feats, skill increase"], [5, "Ability boosts, gunslinger weapon mastery"], [7, "Advanced deed, weapon specialization"], [9, "Stunning fire"], [11, "Gunslinger expertise"], [13, "Greater deed, weapon mastery"], [15, "Greater weapon specialization, evasion"], [17, "Shootist's edge"], [19, "Gunslinging legend"]],
  }),
  investigator: C({
    n: "Investigator", hp: 8, key: ["int"], skills: 5, tradition: null, skillFeatEveryLevel: true,
    perc: { 1: 2, 9: 3 }, fort: { 1: 1, 11: 2 }, ref: { 1: 2, 9: 3 }, will: { 1: 2, 17: 3 },
    simple: { 1: 1, 5: 2, 13: 3 }, martial: { 1: 0 }, unarmed: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Methodology", opts: ["Alchemical sciences", "Empiricism", "Forensic medicine", "Interrogation"] },
    feat: [["Flexible Studies", 1], ["Known Weaknesses", 1], ["That's Odd", 1], ["Underworld Investigator", 1], ["Athletic Strategist", 2], ["Strategic Assessment", 2], ["Alchemical Discoveries", 4], ["Connect the Dots", 4], ["Lie Detector", 4], ["Ongoing Strategy", 4], ["Predictive Purchase", 6], ["Thorough Research", 6]],
    features: [[1, "On the case, methodology, devise a stratagem, strategic strike"], [3, "Keen recollection, skillful lessons"], [5, "Weapon expertise"], [7, "Vigilant senses, weapon specialization"], [9, "Investigator expertise, resolve"], [11, "Deductive improvisation"], [13, "Incredible senses, light armor expertise"], [15, "Evasion, greater weapon specialization"], [17, "Master detective"], [19, "Just One More Thing"]],
  }),
  monk: C({
    n: "Monk", hp: 10, key: ["str", "dex"], skills: 4, tradition: null,
    perc: { 1: 1, 5: 2, 19: 3 }, fort: { 1: 2, 9: 3 }, ref: { 1: 2, 9: 3 }, will: { 1: 2, 9: 3, 17: 4 },
    simple: { 1: 1, 5: 2, 13: 3 }, martial: { 1: 1, 5: 2, 13: 3 }, unarmed: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 2, 13: 3, 17: 4 }, light: { 1: 0 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Path", opts: ["Martial artist", "Ki / focus tradition", "None"] },
    feat: [["Crane Stance", 1], ["Dragon Stance", 1], ["Ki Rush", 1], ["Ki Strike", 1], ["Monastic Weaponry", 1], ["Mountain Stance", 1], ["Tiger Stance", 1], ["Wolf Stance", 1], ["Brawling Focus", 2], ["Crushing Grab", 2], ["Dancing Leaf", 2], ["Elemental Fist", 2], ["Stunning Fist", 2], ["Deflect Arrow", 4], ["Flurry of Maneuvers", 4], ["Flying Kick", 4], ["Guarded Movement", 4], ["Abundant Step", 6], ["Crane Flutter", 6], ["Dragon Roar", 6], ["Ki Blast", 6], ["Wall Run", 6], ["Whirling Throw", 6]],
    features: [[1, "Flurry of blows, powerful fist, monk feats"], [3, "General feat, incredible movement, mystic strikes"], [5, "Alertness, expert strikes"], [7, "Path to perfection, weapon specialization"], [9, "Metal strikes, monk expertise"], [11, "Second path to perfection"], [13, "Graceful mastery, master strikes"], [15, "Greater weapon specialization"], [17, "Third path to perfection"], [19, "Adamantine strikes, graceful legend"]],
  }),
  oracle: C({
    n: "Oracle", hp: 8, key: ["cha"], skills: 3, tradition: "divine", casting: "spontaneous",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 15: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Mystery", opts: ["Ancestors", "Battle", "Bones", "Cosmos", "Flames", "Life", "Lore", "Tempest"] },
    feat: [["Glean Lore", 1], ["Reach Spell", 1], ["Widen Spell", 1], ["Cantrip Expansion", 2], ["Divine Aegis", 2], ["Domain Acumen", 2], ["Advanced Revelation", 4], ["Ashes of Memory", 4], ["Sacrifice Armor", 4], ["Steady Spellcasting", 6], ["Vision of Weakness", 6]],
    features: [[1, "Divine spellcasting, mystery, curse, revelation spells"], [3, "Alertness"], [5, "Ability boosts, magical fortitude"], [7, "Expert spellcaster"], [9, "Lightning reflexes"], [11, "Major curse, resolve"], [13, "Light armor expertise, weapon specialization"], [15, "Master spellcaster"], [17, "Greater resolve"], [19, "Oracular clarity"]],
  }),
  ranger: C({
    n: "Ranger", hp: 10, key: ["str", "dex"], skills: 4, tradition: null,
    perc: { 1: 2, 7: 3, 17: 4 }, fort: { 1: 2, 11: 3 }, ref: { 1: 2, 15: 3 }, will: { 1: 1, 3: 2 },
    simple: { 1: 2, 5: 3, 13: 4 }, martial: { 1: 2, 5: 3, 13: 4 }, unarmed: { 1: 2, 5: 3, 13: 4 },
    unarmored: { 1: 1, 11: 2, 17: 3 }, light: { 1: 1, 11: 2, 17: 3 }, medium: { 1: 1, 11: 2, 17: 3 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Hunter's edge", opts: ["Flurry", "Outwit", "Precision"] },
    feat: [["Animal Companion", 1], ["Crossbow Ace", 1], ["Hunted Shot", 1], ["Monster Hunter", 1], ["Twin Takedown", 1], ["Favored Terrain", 2], ["Hunter's Aim", 2], ["Monster Warden", 2], ["Quick Draw", 2], ["Wild Empathy", 2], ["Far Shot", 4], ["Favored Enemy", 4], ["Running Reload", 4], ["Scout's Warning", 4], ["Snare Specialist", 4], ["Disrupt Prey", 6], ["Far Lobber", 6], ["Skirmish Strike", 6], ["Snap Shot", 6], ["Swift Tracker", 6]],
    features: [[1, "Hunt prey, hunter's edge, ranger feats"], [3, "Iron will, general feat"], [5, "Ability boosts, ranger weapon expertise, trackless step"], [7, "Evasion, vigilant senses, weapon specialization"], [9, "Nature's edge, ranger expertise"], [11, "Juggernaut, medium armor expertise, wild stride"], [13, "Weapon mastery"], [15, "Greater weapon specialization, improved evasion, incredible senses"], [17, "Masterful hunter"], [19, "Second skin, swift prey"]],
  }),
  rogue: C({
    n: "Rogue", hp: 8, key: ["dex", "str", "int", "cha"], skills: 7, tradition: null,
    skillFeatEveryLevel: true, skillIncreaseEveryLevel: true,
    perc: { 1: 2, 7: 3, 17: 4 }, fort: { 1: 1, 11: 2 }, ref: { 1: 2, 9: 3 }, will: { 1: 2, 17: 3 },
    simple: { 1: 1, 5: 2, 13: 3 }, martial: { 1: 0 }, unarmed: { 1: 1, 5: 2, 13: 3 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 1, 13: 2 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Racket", opts: ["Ruffian", "Scoundrel", "Thief", "Eldritch trickster", "Mastermind"] },
    feat: [["Nimble Dodge", 1], ["Trap Finder", 1], ["Twin Feint", 1], ["You're Next", 1], ["Brutal Beating", 1], ["Distracting Feint", 1], ["Minor Magic", 1], ["Mobility", 1], ["Quick Draw", 1], ["Battle Assessment", 2], ["Dread Striker", 2], ["Magical Trickster", 2], ["Poison Weapon", 2], ["Reactive Pursuit", 2], ["Sabotage", 2], ["Gang Up", 4], ["Light Step", 4], ["Skirmish Strike", 4], ["Twist the Knife", 4], ["Blind-Fight", 6], ["Delay Trap", 6], ["Improved Poison Weapon", 6], ["Nimble Roll", 6], ["Opportune Backstab", 6], ["Sidestep", 6], ["Sly Striker", 6]],
    features: [[1, "Rogue's racket, sneak attack 1d6, surprise attack, rogue feats"], [3, "Deny advantage, general feat"], [5, "Ability boosts, weapon tricks"], [7, "Evasion, vigilant senses, weapon specialization"], [9, "Debilitating strike, great fortitude"], [11, "Rogue expertise"], [13, "Improved evasion, incredible senses, light armor expertise, master tricks"], [15, "Double debilitation, greater weapon specialization"], [17, "Slippery mind"], [19, "Light armor mastery, master strike"]],
  }),
  sorcerer: C({
    n: "Sorcerer", hp: 6, key: ["cha"], skills: 2, tradition: "varies", casting: "spontaneous",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 17: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 0 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Bloodline", opts: ["Aberrant", "Angelic", "Demonic", "Diabolic", "Draconic", "Elemental", "Fey", "Hag", "Imperial", "Undead"] },
    feat: [["Counterspell", 1], ["Dangerous Sorcery", 1], ["Familiar", 1], ["Reach Spell", 1], ["Widen Spell", 1], ["Cantrip Expansion", 2], ["Enhanced Familiar", 2], ["Arcane Evolution", 4], ["Bespell Weapon", 4], ["Divine Evolution", 4], ["Occult Evolution", 4], ["Primal Evolution", 4], ["Advanced Bloodline", 6], ["Steady Spellcasting", 6]],
    features: [[1, "Bloodline, spellcasting, bloodline spells"], [3, "Signature spells"], [5, "Magical fortitude, ability boosts"], [7, "Expert spellcaster"], [9, "Lightning reflexes"], [11, "Alertness, weapon expertise"], [13, "Defensive robes, weapon specialization"], [15, "Master spellcaster"], [17, "Resolve"], [19, "Bloodline paragon"]],
  }),
  swashbuckler: C({
    n: "Swashbuckler", hp: 10, key: ["dex"], skills: 4, tradition: null,
    perc: { 1: 2, 7: 3 }, fort: { 1: 2, 11: 3 }, ref: { 1: 2, 9: 3 }, will: { 1: 2, 17: 3 },
    simple: { 1: 2, 5: 3, 13: 4 }, martial: { 1: 2, 5: 3, 13: 4 }, unarmed: { 1: 2, 5: 3, 13: 4 },
    unarmored: { 1: 1, 13: 2, 17: 3 }, light: { 1: 1, 13: 2, 17: 3 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 1, 9: 2, 17: 3 },
    sub: { label: "Style", opts: ["Battledancer", "Braggart", "Fencer", "Gymnast", "Wit"] },
    feat: [["After You", 1], ["Antagonize", 1], ["Nimble Dodge", 1], ["One for All", 1], ["You're Next", 1], ["Goading Feint", 2], ["Guardian's Deflection", 2], ["Unbalancing Finisher", 2], ["Bleeding Finisher", 4], ["Dual Finisher", 4], ["Flying Blade", 4], ["Twin Parry", 4], ["Impaling Finisher", 6], ["Leading Dance", 6], ["Precise Finisher", 6]],
    features: [[1, "Panache, swashbuckler's style, precise strike, confident finisher"], [3, "Opportune riposte, vivacious speed"], [5, "Ability boosts, weapon expertise"], [7, "Evasiveness, vigilant senses, weapon specialization"], [9, "Exemplary finisher"], [11, "Continuous flair, swashbuckler expertise"], [13, "Improved evasion, light armor expertise, weapon mastery"], [15, "Greater weapon specialization"], [17, "Keen flair"], [19, "Eternal confidence"]],
  }),
  witch: C({
    n: "Witch", hp: 6, key: ["int"], skills: 3, tradition: "varies", casting: "prepared",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 17: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 0 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Patron", opts: ["Faith's Flamekeeper", "The Inscribed One", "The Resentment", "Silence in Snow", "Spinner of Threads", "Starless Shadow", "Wilding Steward"] },
    feat: [["Cauldron", 1], ["Counterspell", 1], ["Widen Spell", 1], ["Conceal Spell", 2], ["Enhanced Familiar", 2], ["Familiar Conduit", 2], ["Rites of Convocation", 4], ["Steady Spellcasting", 6], ["Witch's Charge", 6]],
    features: [[1, "Patron, familiar, hexes, spellcasting"], [3, "Alertness"], [5, "Magical fortitude, ability boosts"], [7, "Expert spellcaster"], [9, "Lightning reflexes"], [11, "Patron's gift"], [13, "Defensive robes, weapon specialization"], [15, "Master spellcaster"], [17, "Patron's claim"], [19, "Patron's truth"]],
  }),
  wizard: C({
    n: "Wizard", hp: 6, key: ["int"], skills: 2, tradition: "arcane", casting: "prepared",
    perc: { 1: 1, 11: 2 }, fort: { 1: 1, 9: 2 }, ref: { 1: 1, 17: 2 }, will: { 1: 2, 9: 3, 19: 4 },
    simple: { 1: 1, 11: 2 }, martial: { 1: 0 }, unarmed: { 1: 1, 11: 2 },
    unarmored: { 1: 1, 13: 2 }, light: { 1: 0 }, medium: { 1: 0 }, heavy: { 1: 0 },
    classDC: { 1: 0 }, spellProf: { 1: 1, 7: 2, 15: 3, 19: 4 },
    sub: { label: "Arcane thesis / school", opts: ["Improved familiar attunement", "Metamagical experimentation", "Spell blending", "Spell substitution", "Staff nexus"] },
    feat: [["Counterspell", 1], ["Eschew Materials", 1], ["Familiar", 1], ["Hand of the Apprentice", 1], ["Reach Spell", 1], ["Widen Spell", 1], ["Cantrip Expansion", 2], ["Conceal Spell", 2], ["Enhanced Familiar", 2], ["Bespell Weapon", 4], ["Linked Focus", 4], ["Silent Spell", 4], ["Advanced School Spell", 6], ["Bond Conservation", 6], ["Universal Versatility", 6]],
    features: [[1, "Arcane spellcasting, arcane school, arcane bond, arcane thesis"], [3, "Alertness"], [5, "Ability boosts"], [7, "Expert spellcaster"], [9, "Magical fortitude"], [11, "Alertness, wizard weapon expertise"], [13, "Defensive robes, weapon specialization"], [15, "Master spellcaster"], [17, "Resolve"], [19, "Archwizard's spellcraft"]],
  }),
};

// ---------- spell slot tables ----------
const FULL_CASTER_SLOTS = {
  1: { 1: 2 }, 2: { 1: 3 }, 3: { 1: 3, 2: 2 }, 4: { 1: 3, 2: 3 }, 5: { 1: 3, 2: 3, 3: 2 },
  6: { 1: 3, 2: 3, 3: 3 }, 7: { 1: 3, 2: 3, 3: 3, 4: 2 }, 8: { 1: 3, 2: 3, 3: 3, 4: 3 },
  9: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 2 }, 10: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3 },
  11: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2 }, 12: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3 },
  13: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 2 }, 14: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 },
  15: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 2 }, 16: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3 },
  17: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 2 }, 18: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3 },
  19: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 },
  20: { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 1 },
};

// ---------- equipment ----------
// [name, category, damage, type, traits, bulk, price(gp), group, ranged]
const w = (n, c, d, t, tr, b, p, g, r) => ({ n, c, d, t, tr: tr || [], b, p, g, r: !!r });
const WEAPONS = [
  w("Fist", "unarmed", "1d4", "B", ["agile", "finesse", "nonlethal"], 0, 0, "brawling"),
  w("Club", "simple", "1d6", "B", ["thrown 10 ft."], 1, 0, "club"),
  w("Dagger", "simple", "1d4", "P", ["agile", "finesse", "thrown 10 ft.", "versatile S"], 0.1, 0.2, "knife"),
  w("Sap", "simple", "1d6", "B", ["agile", "nonlethal"], 0.1, 0.1, "club"),
  w("Shortsword", "martial", "1d6", "P", ["agile", "finesse", "versatile S"], 0.1, 0.9, "sword"),
  w("Spear", "simple", "1d6", "P", ["thrown 20 ft."], 1, 0.1, "spear"),
  w("Staff", "simple", "1d4", "B", ["two-hand d8"], 1, 0, "club"),
  w("Light Mace", "simple", "1d4", "B", ["agile", "finesse", "shove"], 0.1, 0.4, "club"),
  w("Mace", "simple", "1d6", "B", ["shove"], 1, 1, "club"),
  w("Morningstar", "simple", "1d6", "B", ["versatile P"], 1, 1, "club"),
  w("Sickle", "simple", "1d4", "S", ["agile", "finesse", "trip"], 0.1, 0.2, "knife"),
  w("Longsword", "martial", "1d8", "S", ["versatile P"], 1, 1, "sword"),
  w("Bastard Sword", "martial", "1d8", "S", ["two-hand d12"], 1, 4, "sword"),
  w("Greatsword", "martial", "1d12", "S", ["versatile P"], 2, 2, "sword"),
  w("Rapier", "martial", "1d6", "P", ["deadly d8", "disarm", "finesse"], 1, 2, "sword"),
  w("Scimitar", "martial", "1d6", "S", ["forceful", "sweep"], 1, 1, "sword"),
  w("Falchion", "martial", "1d10", "S", ["forceful", "sweep"], 2, 3, "sword"),
  w("Battle Axe", "martial", "1d8", "S", ["sweep"], 1, 1, "axe"),
  w("Greataxe", "martial", "1d12", "S", ["sweep"], 2, 2, "axe"),
  w("Hatchet", "martial", "1d6", "S", ["agile", "sweep", "thrown 10 ft."], 0.1, 0.4, "axe"),
  w("Warhammer", "martial", "1d8", "B", ["shove"], 1, 1, "hammer"),
  w("Maul", "martial", "1d12", "B", ["shove"], 2, 3, "hammer"),
  w("Flail", "martial", "1d6", "B", ["disarm", "sweep", "trip"], 1, 0.8, "flail"),
  w("Glaive", "martial", "1d8", "S", ["deadly d8", "forceful", "reach"], 2, 1, "polearm"),
  w("Halberd", "martial", "1d10", "P", ["reach", "versatile S"], 2, 2, "polearm"),
  w("Guisarme", "martial", "1d10", "S", ["reach", "trip"], 2, 2, "polearm"),
  w("Longspear", "simple", "1d8", "P", ["reach"], 2, 0.5, "spear"),
  w("Trident", "martial", "1d8", "P", ["thrown 20 ft."], 1, 1, "spear"),
  w("Whip", "martial", "1d4", "S", ["disarm", "finesse", "nonlethal", "reach", "trip"], 1, 0.1, "flail"),
  w("Katar", "simple", "1d4", "P", ["agile", "deadly d6", "monk"], 0.1, 0.3, "knife"),
  w("Dogslicer", "martial", "1d6", "S", ["agile", "backstabber", "finesse", "goblin"], 0.1, 0.1, "sword"),
  w("Elven Curve Blade", "advanced", "1d8", "S", ["elf", "finesse", "forceful"], 2, 4, "sword"),
  w("Dwarven War Axe", "advanced", "1d12", "S", ["dwarf", "sweep", "two-hand d12"], 2, 3, "axe"),
  w("Shield Boss", "martial", "1d6", "B", [], 0, 0.5, "shield"),
  w("Shield Bash", "martial", "1d4", "B", [], 0, 0, "shield"),
  // ranged
  w("Shortbow", "martial", "1d6", "P", ["deadly d10", "range 60 ft.", "reload 0"], 1, 3, "bow", 1),
  w("Longbow", "martial", "1d8", "P", ["deadly d10", "range 100 ft.", "reload 0", "volley 30 ft."], 2, 6, "bow", 1),
  w("Composite Shortbow", "martial", "1d6", "P", ["deadly d10", "propulsive", "range 60 ft.", "reload 0"], 1, 14, "bow", 1),
  w("Composite Longbow", "martial", "1d8", "P", ["deadly d10", "propulsive", "range 100 ft.", "volley 30 ft."], 2, 20, "bow", 1),
  w("Crossbow", "simple", "1d8", "P", ["range 120 ft.", "reload 1"], 1, 3, "bow", 1),
  w("Hand Crossbow", "martial", "1d6", "P", ["range 60 ft.", "reload 1"], 0.1, 3, "bow", 1),
  w("Heavy Crossbow", "martial", "1d10", "P", ["range 120 ft.", "reload 2"], 2, 4, "bow", 1),
  w("Sling", "simple", "1d6", "B", ["propulsive", "range 50 ft.", "reload 1"], 0.1, 0, "sling", 1),
  w("Javelin", "simple", "1d6", "P", ["thrown 30 ft."], 0.1, 0.1, "dart", 1),
  w("Dart", "simple", "1d4", "P", ["agile", "thrown 20 ft."], 0.1, 0.01, "dart", 1),
  w("Dueling Pistol", "martial", "1d6", "P", ["concealable", "concussive", "fatal d10", "range 60 ft.", "reload 1", "uncommon"], 0.1, 6, "firearm", 1),
  w("Flintlock Pistol", "simple", "1d4", "P", ["concussive", "fatal d8", "range 40 ft.", "reload 1"], 0.1, 5, "firearm", 1),
  w("Coat Pistol", "simple", "1d4", "P", ["concealable", "concussive", "fatal d6", "range 30 ft.", "reload 1"], 0.1, 3, "firearm", 1),
  w("Flintlock Musket", "simple", "1d6", "P", ["concussive", "fatal d10", "range 80 ft.", "reload 1"], 1, 10, "firearm", 1),
  w("Arquebus", "martial", "1d8", "P", ["concussive", "fatal d12", "kickback", "range 150 ft.", "reload 1"], 2, 10, "firearm", 1),
  w("Blunderbuss", "martial", "1d8", "P", ["concussive", "range 40 ft.", "reload 1", "scatter 10 ft."], 1, 10, "firearm", 1),
  w("Hand Cannon", "simple", "1d6", "P", ["concussive", "fatal d10", "range 20 ft.", "reload 1"], 0.1, 4, "firearm", 1),
  w("Air Repeater", "martial", "1d4", "P", ["backstabber", "range 30 ft.", "repeating"], 1, 7, "firearm", 1),
  w("Fire Lance", "martial", "1d6", "P", ["concussive", "range 20 ft.", "reload 1", "scatter 5 ft."], 1, 9, "firearm", 1),
  w("Net Launcher", "martial", "1d4", "B", ["nonlethal", "range 20 ft.", "reload 1"], 1, 8, "firearm", 1),
  w("Alchemical Bomb", "martial", "1d6", "varies", ["splash", "thrown 20 ft."], 0.1, 0, "bomb", 1),
];

// [name, category, acBonus, dexCap, checkPenalty, speedPenalty, strength, bulk, group]
const ar = (n, c, ac, dx, ck, sp, st, b, g) => ({ n, c, ac, dx, ck, sp, st, b, g });
const ARMORS = [
  ar("Unarmored", "unarmored", 0, 99, 0, 0, 0, 0, "-"),
  ar("Explorer's Clothing", "unarmored", 0, 5, 0, 0, 0, 0.1, "cloth"),
  ar("Padded Armor", "light", 1, 3, 0, 0, 10, 0.1, "cloth"),
  ar("Leather Armor", "light", 1, 4, -1, 0, 10, 1, "leather"),
  ar("Studded Leather", "light", 2, 3, -1, 0, 12, 1, "leather"),
  ar("Chain Shirt", "light", 2, 3, -1, 0, 12, 1, "chain"),
  ar("Elven Chain", "light", 2, 5, 0, 0, 10, 1, "chain"),
  ar("Hide Armor", "medium", 3, 2, -2, -5, 14, 2, "leather"),
  ar("Scale Mail", "medium", 3, 2, -2, -5, 14, 2, "composite"),
  ar("Chain Mail", "medium", 4, 1, -2, -5, 16, 2, "chain"),
  ar("Breastplate", "medium", 4, 1, -2, -5, 16, 2, "plate"),
  ar("Splint Mail", "heavy", 5, 1, -3, -10, 16, 3, "composite"),
  ar("Half Plate", "heavy", 5, 1, -3, -10, 16, 3, "plate"),
  ar("Full Plate", "heavy", 6, 0, -3, -10, 18, 4, "plate"),
];

const SHIELDS = [
  { n: "No shield", ac: 0, hard: 0, hp: 0, bt: 0, b: 0 },
  { n: "Buckler", ac: 1, hard: 3, hp: 6, bt: 3, b: 0.1 },
  { n: "Wooden Shield", ac: 2, hard: 3, hp: 12, bt: 6, b: 1 },
  { n: "Steel Shield", ac: 2, hard: 5, hp: 20, bt: 10, b: 1 },
  { n: "Tower Shield", ac: 2, hard: 5, hp: 20, bt: 10, b: 4 },
];

const GEAR = [
  ["Adventurer's Pack", 0.2, 1], ["Rations (1 week)", 0.4, 0.5], ["Rope (50 ft.)", 1, 0.5],
  ["Torch", 0.1, 0.01], ["Lantern (hooded)", 1, 0.7], ["Bedroll", 0.1, 0.02],
  ["Healer's Tools", 1, 5], ["Thieves' Tools", 0.1, 3], ["Repair Toolkit", 1, 2],
  ["Climbing Kit", 1, 0.5], ["Grappling Hook", 0.1, 0.1], ["Crowbar", 1, 0.5],
  ["Waterskin", 0.1, 0.05], ["Chalk (10)", 0, 0.01], ["Flint and Steel", 0, 0.05],
  ["Holy Water", 0.1, 3], ["Minor Healing Potion", 0.1, 4], ["Lesser Healing Potion", 0.1, 12],
  ["Moderate Healing Potion", 0.1, 50], ["Elixir of Life (minor)", 0.1, 3],
  ["Antidote (lesser)", 0.1, 3], ["Antiplague (lesser)", 0.1, 3],
  ["Alchemist's Fire (lesser)", 0.1, 3], ["Tanglefoot Bag (lesser)", 0.1, 3],
  ["Arrows (10)", 0.1, 0.1], ["Bolts (10)", 0.1, 0.1], ["Sling Bullets (10)", 0.1, 0.01],
  ["Spellbook", 1, 10], ["Material Component Pouch", 0.1, 0.5], ["Religious Symbol (wooden)", 0.1, 0.1],
  ["Musical Instrument (handheld)", 0.1, 1], ["Writing Set", 0.1, 1], ["Mirror", 0.1, 1],
  ["Tent (pup)", 1, 0.8], ["Sack", 0.1, 0.01], ["Backpack", 0.1, 0.1],
];

// ---------- feats ----------
const GENERAL_FEATS = [
  ["Additional Lore", 1, "Become trained in a new Lore, improving as you level."],
  ["Adopted Ancestry", 1, "Access ancestry feats from another ancestry."],
  ["Armor Proficiency", 1, "Become trained in the next heavier armor category."],
  ["Breath Control", 1, "Hold your breath far longer; bonus vs. inhaled threats."],
  ["Canny Acumen", 1, "Become expert in a save or Perception (master at 17)."],
  ["Diehard", 1, "You die at dying 5 instead of dying 4."],
  ["Fast Recovery", 1, "Regain more HP from rest; recover faster from afflictions."],
  ["Feather Step", 1, "Step into difficult terrain."],
  ["Fleet", 1, "+5 ft. Speed."],
  ["Incredible Initiative", 1, "+2 to initiative rolls."],
  ["Ride", 1, "Command an animal you're riding as a free action."],
  ["Shield Block", 1, "Reduce damage with your shield as a reaction."],
  ["Toughness", 1, "+1 HP per level; lower recovery DC."],
  ["Untrained Improvisation", 1, "Add part of your level to untrained skill checks."],
  ["Weapon Proficiency", 1, "Become trained in martial or one advanced weapon."],
  ["Ancestral Paragon", 3, "Gain a 1st-level ancestry feat."],
  ["Untrained Improvisation", 3, "Improve untrained skill checks further."],
  ["Incredible Investiture", 11, "Invest up to 12 magic items."],
];

const SKILL_FEATS = [
  ["Assurance", 1, "Skip the roll: take 10 + proficiency on a chosen skill.", "any"],
  ["Cat Fall", 1, "Treat falls as shorter.", "acrobatics"],
  ["Quick Squeeze", 1, "Squeeze through tight spaces faster.", "acrobatics"],
  ["Steady Balance", 1, "Never off-guard while balancing; keep your footing.", "acrobatics"],
  ["Arcane Sense", 1, "Cast detect magic at will as an innate spell.", "arcana"],
  ["Combat Climber", 1, "Climb without being off-guard, one hand free.", "athletics"],
  ["Hefty Hauler", 1, "Increase your Bulk limits by 2.", "athletics"],
  ["Quick Jump", 1, "High Jump and Long Jump as a single action.", "athletics"],
  ["Titan Wrestler", 1, "Disarm, Grapple, Shove, Trip creatures two sizes larger.", "athletics"],
  ["Underwater Marauder", 1, "Fight underwater without penalty.", "athletics"],
  ["Alchemical Crafting", 1, "Craft alchemical items; gain 4 common formulas.", "crafting"],
  ["Quick Repair", 1, "Repair an item in 1 minute (or 3 actions at master).", "crafting"],
  ["Specialty Crafting", 1, "+1/+2 to Craft a chosen specialty.", "crafting"],
  ["Charming Liar", 1, "Improve attitude on a critical Lie.", "deception"],
  ["Lengthy Diversion", 1, "Stay hidden after a critical Create a Diversion.", "deception"],
  ["Lie to Me", 1, "Use Deception to detect lies.", "deception"],
  ["Bargain Hunter", 1, "Earn Income by Buying Low/Selling High.", "diplomacy"],
  ["Group Impression", 1, "Make an Impression on more people at once.", "diplomacy"],
  ["Hobnobber", 1, "Gather Information faster.", "diplomacy"],
  ["Battle Cry", 1, "Demoralize as a free action on initiative.", "intimidation"],
  ["Group Coercion", 1, "Coerce multiple targets.", "intimidation"],
  ["Intimidating Glare", 1, "Demoralize visually, no language penalty.", "intimidation"],
  ["Quick Coercion", 1, "Coerce in 1 round.", "intimidation"],
  ["Battle Medicine", 1, "Heal an ally in combat as a single action.", "medicine"],
  ["Natural Medicine", 1, "Use Nature to Treat Wounds.", "nature"],
  ["Train Animal", 1, "Teach an animal a trick.", "nature"],
  ["Oddity Identification", 1, "+2 to Identify Magic for certain traits.", "occultism"],
  ["Fascinating Performance", 1, "Fascinate observers with a performance.", "performance"],
  ["Impressive Performance", 1, "Make an Impression with Performance.", "performance"],
  ["Student of the Canon", 1, "Better results recalling religious/philosophical lore.", "religion"],
  ["Courtly Graces", 1, "Use Society to impersonate or impress nobility.", "society"],
  ["Multilingual", 1, "Learn two new languages.", "society"],
  ["Read Lips", 1, "Read lips of creatures you can see.", "society"],
  ["Streetwise", 1, "Gather Information using Society in familiar settlements.", "society"],
  ["Experienced Smuggler", 1, "Conceal items more reliably.", "stealth"],
  ["Terrain Stalker", 1, "Sneak in chosen terrain without a check.", "stealth"],
  ["Experienced Tracker", 1, "Track at full Speed.", "survival"],
  ["Forager", 1, "Subsist reliably and feed extra creatures.", "survival"],
  ["Survey Wildlife", 1, "Identify creatures from indirect signs.", "survival"],
  ["Pickpocket", 1, "Steal or Palm an Object more effectively.", "thievery"],
  ["Subtle Theft", 1, "Your thefts are harder to notice.", "thievery"],
  ["Automatic Knowledge", 2, "Recall Knowledge as a free action once per round.", "any"],
  ["Magical Shorthand", 2, "Learn spells faster and cheaper.", "arcana"],
  ["Quick Identification", 2, "Identify Magic far faster.", "arcana"],
  ["Robust Recovery", 2, "Better results treating diseases and poisons.", "medicine"],
  ["Ward Medic", 2, "Treat several patients at once.", "medicine"],
  ["Bizarre Magic", 7, "Your magic is harder to identify.", "occultism"],
  ["Legendary Negotiation", 15, "Negotiate as a three-action activity.", "diplomacy"],
];

const CONDITIONS = [
  { k: "clumsy", n: "Clumsy", val: true, d: "Penalty to Dex-based checks and DCs." },
  { k: "drained", n: "Drained", val: true, d: "Penalty to Fortitude and Con checks; lose HP." },
  { k: "enfeebled", n: "Enfeebled", val: true, d: "Penalty to Str-based checks and damage." },
  { k: "frightened", n: "Frightened", val: true, d: "Penalty to all checks and DCs; decreases each turn." },
  { k: "sickened", n: "Sickened", val: true, d: "Penalty to all checks and DCs." },
  { k: "stupefied", n: "Stupefied", val: true, d: "Penalty to Int/Wis/Cha checks, spell DCs, and spell attacks." },
  { k: "slowed", n: "Slowed", val: true, d: "Lose actions at the start of your turn." },
  { k: "quickened", n: "Quickened", val: false, d: "Gain an extra action with limited uses." },
  { k: "offguard", n: "Off-guard", val: false, d: "-2 circumstance penalty to AC." },
  { k: "prone", n: "Prone", val: false, d: "Off-guard and -2 to melee attacks." },
  { k: "doomed", n: "Doomed", val: true, d: "You die at a lower dying value." },
  { k: "fatigued", n: "Fatigued", val: false, d: "-1 to AC and saves." },
  { k: "blinded", n: "Blinded", val: false, d: "All terrain is difficult; you can't see." },
  { k: "concealed", n: "Concealed", val: false, d: "Attackers must succeed at a DC 5 flat check." },
  { k: "grabbed", n: "Grabbed", val: false, d: "Immobilized and off-guard." },
  { k: "restrained", n: "Restrained", val: false, d: "Immobilized, off-guard, limited actions." },
];

const SPELLS = [
  // [name, rank(0=cantrip), traditions, blurb]
  ["Detect Magic", 0, "ADOP", "Sense whether magic is nearby."],
  ["Guidance", 0, "ADOP", "Give an ally a bonus to one roll."],
  ["Light", 0, "ADOP", "Make an object shed light."],
  ["Prestidigitation", 0, "ADOP", "Perform a minor magical trick."],
  ["Read Aura", 0, "ADOP", "Learn an item's magical tradition."],
  ["Shield", 0, "ADOP", "Block an attack with a force shield."],
  ["Telekinetic Projectile", 0, "AOP", "Hurl an object as a spell attack."],
  ["Electric Arc", 0, "AP", "Arc of lightning against one or two foes."],
  ["Ignition", 0, "AP", "Fire attack, stronger in melee range."],
  ["Divine Lance", 0, "D", "Spirit damage aligned with your deity."],
  ["Daze", 0, "ADO", "Mental damage; may stun on a crit."],
  ["Stabilize", 0, "D", "Stop a dying creature from getting worse."],
  ["Shepherd of Souls", 0, "D", "Vitality or void healing at a touch."],
  ["Forbidding Ward", 0, "DO", "Protect an ally from one enemy."],
  ["Message", 0, "ADOP", "Whisper to a creature you can see."],
  ["Sigil", 0, "ADOP", "Mark a creature or object."],
  ["Heal", 1, "DP", "Restore Hit Points; harms undead."],
  ["Harm", 1, "D", "Void damage; heals undead."],
  ["Bless", 1, "D", "Aura granting allies a bonus to attacks."],
  ["Fear", 1, "ADO", "Make a creature frightened."],
  ["Magic Missile", 1, "AO", "Unerring force darts."],
  ["Grease", 1, "AP", "Slick surface causes falls."],
  ["Mage Armor", 1, "A", "Magical armor bonus to AC."],
  ["Gentle Landing", 1, "AP", "Slow a falling creature."],
  ["Runic Weapon", 1, "ADOP", "Add potency and striking to a weapon."],
  ["Burning Hands", 1, "AP", "Cone of flame."],
  ["Summon Animal", 1, "P", "Call an animal to fight for you."],
  ["Sure Strike", 1, "ADO", "Roll your next attack twice, take the higher."],
  ["Command", 1, "ADO", "Force a creature to obey a simple order."],
  ["Soothe", 1, "O", "Heal and grant a bonus against mental effects."],
  ["Charm", 1, "AO", "Make a creature friendly to you."],
  ["Tailwind", 1, "AP", "Increase Speed."],
  ["Pest Form", 1, "AP", "Turn into a tiny animal."],
  ["Spider Sting", 1, "AP", "Poison damage plus enfeebled."],
  ["Illusory Disguise", 1, "AO", "Change your appearance."],
  ["Sleep", 1, "AO", "Put creatures to sleep."],
  ["Mystic Armor", 1, "ADOP", "Bonus to AC and saves against magic."],
  ["Dizzying Colors", 1, "AO", "Dazzling burst that can blind or stun."],
  ["Blazing Bolt", 2, "AP", "Fire ray, scaling with actions spent."],
  ["Mirror Image", 2, "AO", "Illusory duplicates misdirect attacks."],
  ["Invisibility", 2, "AO", "Become invisible."],
  ["See the Unseen", 2, "ADO", "See invisible creatures."],
  ["Resist Energy", 2, "ADOP", "Grant resistance to one energy type."],
  ["Restore Senses", 2, "DOP", "End a blinding or deafening effect."],
  ["Enlarge", 2, "AP", "Make a creature larger and stronger."],
  ["Water Breathing", 2, "ADP", "Breathe underwater."],
  ["Sound Body", 2, "DP", "Reduce a condition's value."],
  ["Dispel Magic", 2, "ADOP", "End a magical effect."],
  ["Revealing Light", 2, "ADOP", "Light that reveals and dazzles."],
  ["Spiritual Armament", 2, "DO", "Summon a floating weapon that strikes."],
  ["Fireball", 3, "AP", "Explosive burst of fire."],
  ["Haste", 3, "AP", "Grant an extra Strike or Stride action."],
  ["Slow", 3, "ADOP", "Reduce a creature's actions."],
  ["Vampiric Feast", 3, "AD", "Drain life to heal yourself."],
  ["Lightning Bolt", 3, "AP", "Line of electricity."],
  ["Wall of Fire", 4, "AP", "Burning wall blocks a path."],
  ["Fly", 4, "AP", "Grant a fly Speed."],
  ["Vital Beacon", 4, "DP", "Store healing to release over time."],
  ["Cone of Cold", 5, "AP", "Freezing cone of cold damage."],
  ["Breath of Life", 5, "D", "Snatch an ally back from death."],
  ["Chain Lightning", 6, "AP", "Lightning jumps between foes."],
  ["Disintegrate", 6, "A", "Reduce a target to dust."],
  ["Wall of Stone", 5, "AP", "Conjure a solid stone barrier."],
  ["Heroism", 3, "DO", "Status bonus to attacks, Perception, and saves."],
  ["Sanctuary", 1, "DO", "Discourage attacks against a creature."],
  ["Summon Elemental", 2, "AP", "Call an elemental ally."],
  ["Animal Form", 2, "P", "Become a fighting beast."],
  ["Darkvision", 2, "ADP", "See in darkness."],
  ["Comprehend Language", 2, "ADO", "Understand a language you hear."],
];
const TRADITION_LETTER = { arcane: "A", divine: "D", occult: "O", primal: "P" };

/* ---------- plain-language guide ----------
   Content for the step-by-step builder only: none of it touches the math.
   The blurbs are a table-level description of how a thing actually plays, not
   rules text — every card links out to the Archives for the real wording.
   `cx` is how much bookkeeping the class asks of you, 1 to 3.
   `sec` is the ability order a recommended spread follows after the key one.
   `sk` is a starting skill suggestion, not a requirement. */
const CXLABEL = ["", "Easy to run", "A few moving parts", "Lots to track"];

const CLASSINFO = {
  fighter: { cx: 1, first: 1, d: "The most accurate attacker in the game. Pick a weapon, hit things with it, protect the people behind you.", sec: ["con", "dex", "wis"], sk: ["athletics", "intimidation", "acrobatics"] },
  champion: { cx: 1, first: 1, d: "A holy knight in heavy armour. Your reaction steps in front of hits aimed at your friends.", sec: ["con", "dex", "wis"], sk: ["religion", "athletics", "diplomacy"] },
  barbarian: { cx: 1, first: 1, d: "Rage, hit enormously hard, take the punishment. Simple turns, huge numbers.", sec: ["con", "dex", "wis"], sk: ["athletics", "intimidation", "survival"] },
  guardian: { cx: 1, first: 1, d: "The purpose-built tank: taunt enemies into attacking you, then soak what they throw.", sec: ["con", "dex", "wis"], sk: ["athletics", "intimidation", "medicine"] },
  ranger: { cx: 1, first: 1, d: "Mark one enemy and land repeat hits on it, with a bow or two blades. Can bring an animal companion.", sec: ["con", "wis", "dex"], sk: ["survival", "nature", "athletics", "stealth"] },
  rogue: { cx: 2, first: 1, d: "Sneak attack damage when enemies are distracted, and more trained skills than anyone else at the table.", sec: ["con", "cha", "int"], sk: ["stealth", "thievery", "acrobatics", "deception", "society"] },
  cleric: { cx: 2, first: 1, d: "Your god's power, spent on healing the party or on hurting whatever needs hurting.", sec: ["con", "dex", "cha"], sk: ["religion", "medicine", "diplomacy"] },
  druid: { cx: 2, first: 1, d: "Primal magic — storms, vines, an animal companion, or turning into a bear.", sec: ["con", "dex", "int"], sk: ["nature", "survival", "medicine"] },
  monk: { cx: 2, d: "Fast and mobile, fighting unarmed or with monk weapons out of stances.", sec: ["con", "wis", "dex"], sk: ["acrobatics", "athletics", "stealth"] },
  bard: { cx: 2, d: "Sing magic that makes everyone else better at their job, plus a wide occult spell list.", sec: ["con", "dex", "wis"], sk: ["performance", "diplomacy", "occultism", "deception"] },
  sorcerer: { cx: 2, d: "Magic in the blood. Fewer spells known than a wizard, but you cast them freely without preparing.", sec: ["con", "dex", "wis"], sk: ["arcana", "deception", "intimidation"] },
  swashbuckler: { cx: 2, d: "A duellist who earns panache by showing off, then spends it on a finishing move.", sec: ["cha", "con", "str"], sk: ["acrobatics", "athletics", "deception", "diplomacy"] },
  gunslinger: { cx: 2, d: "Firearms and crossbows. Big single shots with a reload to manage between them.", sec: ["con", "wis", "str"], sk: ["crafting", "acrobatics", "stealth"] },
  kineticist: { cx: 2, d: "Elemental blasts you can throw all day — no spell slots to run out of.", sec: ["dex", "wis", "str"], sk: ["nature", "athletics", "acrobatics"] },
  commander: { cx: 2, d: "Battlefield tactics: your orders hand allies free movement and attacks.", sec: ["con", "dex", "wis"], sk: ["society", "athletics", "diplomacy"] },
  exemplar: { cx: 2, d: "A mortal carrying a spark of divinity, moved between legendary objects mid-fight.", sec: ["con", "dex", "cha"], sk: ["athletics", "religion", "intimidation"] },
  oracle: { cx: 3, d: "Divine power taken without permission. Your curse deepens the more you lean on it.", sec: ["con", "dex", "wis"], sk: ["religion", "diplomacy", "intimidation"] },
  alchemist: { cx: 3, d: "Bombs, mutagens and elixirs, brewed in batches each day and spent fast.", sec: ["dex", "con", "wis"], sk: ["crafting", "medicine", "acrobatics"] },
  investigator: { cx: 3, d: "Study a target to make your hit land, and carry the party through everything outside combat.", sec: ["dex", "con", "wis"], sk: ["society", "thievery", "medicine", "occultism"] },
  wizard: { cx: 3, d: "Prepare a fresh spell list every morning. The widest magic in the game if you plan ahead.", sec: ["con", "dex", "wis"], sk: ["arcana", "society", "crafting"] },
  witch: { cx: 3, d: "A familiar carries your spells, and you throw a hex most rounds.", sec: ["con", "dex", "wis"], sk: ["arcana", "occultism", "nature"] },
  magus: { cx: 3, d: "Half fighter, half arcane caster: charge a spell into a weapon strike, then recharge.", sec: ["con", "int", "wis"], sk: ["arcana", "athletics", "acrobatics"] },
  summoner: { cx: 3, d: "You and your eidolon share one pool of actions and act as a single creature.", sec: ["con", "dex", "str"], sk: ["arcana", "diplomacy", "athletics"] },
  psychic: { cx: 3, d: "Mind magic. Ordinary cantrips, amped up into something much bigger.", sec: ["con", "dex", "wis"], sk: ["occultism", "diplomacy", "intimidation"] },
  thaumaturge: { cx: 3, d: "Esoteric lore and a bag of trinkets, used to find and exploit every monster's weakness.", sec: ["con", "dex", "wis"], sk: ["occultism", "religion", "intimidation"] },
  inventor: { cx: 3, d: "One overclocked invention — armour, weapon or construct — pushed past what it can take.", sec: ["con", "dex", "wis"], sk: ["crafting", "society", "athletics"] },
  runesmith: { cx: 3, d: "Etch runes onto gear and onto enemies, then set them off at the right moment.", sec: ["con", "dex", "str"], sk: ["crafting", "arcana", "society"] },
  necromancer: { cx: 3, d: "Raise a crowd of small minions and direct them around the battlefield.", sec: ["con", "dex", "wis"], sk: ["occultism", "religion", "medicine"] },
  animist: { cx: 3, d: "Bound spirits ride along with you, and you swap which one is awake each day.", sec: ["con", "dex", "cha"], sk: ["religion", "nature", "occultism"] },
};

const ANCINFO = {
  human: "Two free boosts and the broadest feat list. The easy pick if nothing else calls to you.",
  dwarf: "Tough and stubborn, sees in the dark, slower on foot but very hard to shift.",
  elf: "Long-lived, quick and observant, but physically frailer than most.",
  gnome: "Small, fey-touched and endlessly curious — magic clings to them.",
  goblin: "Small, fast, fearless and extremely fond of fire.",
  halfling: "Small and genuinely lucky: rerolls when things go badly wrong.",
  leshy: "A small plant spirit walking around in a body of wood, fungus or fruit.",
  orc: "Strong and relentless, still swinging at the point where most people fall over.",
  kobold: "Small draconic scavengers with a breath weapon and a talent for traps.",
  catfolk: "Nimble, curious and lucky enough to land on their feet twice.",
  tengu: "Crow-folk who pick up languages, weapons and other people's tricks easily.",
  ratfolk: "Small, clever, quick with tools and comfortable in tight spaces.",
  lizardfolk: "Iruxi: strong swimmers with claws, fangs and thick hide.",
  hobgoblin: "A disciplined martial culture — drilled for war from childhood.",
  custom: "Your own species. Set the numbers by hand on the Build tab afterwards.",
};

const SKILLINFO = {
  acrobatics: "Balance, tumble past an enemy, wriggle out of a grab.",
  arcana: "Recognise magic, arcane creatures and what a spell just did.",
  athletics: "Climb, swim, jump — and shove, trip or grapple in a fight.",
  crafting: "Build and repair things, identify gear, work out how a trap functions.",
  deception: "Lie, feint mid-combat, pass yourself off as someone else.",
  diplomacy: "Talk people round, calm a situation, gather word on the street.",
  intimidation: "Frighten an enemy stiff, or lean on someone for answers.",
  medicine: "Patch up wounds between fights, treat poison and disease.",
  nature: "Animals, plants, weather and primal magic.",
  occultism: "Ghosts, aberrations and the older, stranger mysteries.",
  performance: "Entertain a crowd, hold a room, impress a court.",
  religion: "Gods, undead, the planes and divine magic.",
  society: "Cities, law, history, languages and forged paperwork.",
  stealth: "Hide, sneak, follow someone without being spotted.",
  survival: "Track, forage, navigate and keep camp alive in the wild.",
  thievery: "Pick locks, disarm traps, lift what isn't yours.",
};

/* Fallback order when a class's suggestions don't fill every slot: the skills
   that pull their weight in most parties. */
const SKILLFILL = ["athletics", "medicine", "survival", "diplomacy", "stealth", "society",
  "nature", "crafting", "intimidation", "acrobatics", "religion", "arcana", "occultism",
  "deception", "performance", "thievery"];

const ABILINFO = {
  str: "Melee attack and damage, Athletics, and how much you can carry.",
  dex: "AC, Reflex saves, bows and finesse weapons, Acrobatics and Stealth.",
  con: "Hit points and Fortitude saves. Nobody has ever regretted raising this.",
  int: "Extra trained skills and languages, and the key stat for arcane study.",
  wis: "Perception — so initiative and spotting things — plus Will saves and Medicine.",
  cha: "Talking your way through things, and the key stat for several casters.",
};

/* A first-character spread: push the key ability to 18, then fill in the
   class's supporting abilities. Every batch still obeys the one-per-batch rule,
   so this is a legal set of picks, not a shortcut around them. */
function recommendAbilities(c) {
  const cls = CLASSES[c.cls] || CLASSES.fighter;
  const anc = ANCESTRIES[c.ancestry] || ANCESTRIES.human;
  const bgd = BACKGROUNDS[c.background] || BACKGROUNDS.acolyte;
  /* Trust the stored key ability only if the current class can actually use it
     — swapping class leaves the old one behind otherwise. */
  const keys = cls.key || ["str"];
  const key = keys.includes(c.keyAbility) ? c.keyAbility : keys[0];
  const sec = (CLASSINFO[c.cls] || {}).sec || ["con", "dex", "wis"];
  const pri = [];
  [key, ...sec, ...ABIL.filter((a) => a !== anc.f), ...ABIL].forEach((a) => {
    if (a && !pri.includes(a)) pri.push(a);
  });
  const pick = (used) => pri.find((a) => !used.includes(a)) || "";

  const ancFixed = (anc.b || []).filter((b) => b !== "free");
  const ancFree = [];
  for (let i = 0; i < (anc.b || []).filter((b) => b === "free").length; i++) {
    ancFree.push(pick([...ancFixed, ...ancFree]));
  }

  const opts = (bgd.b || []).filter((b) => b !== "free");
  let bgPick = "";
  const bgFree = [];
  if (opts.length === 2) {
    bgPick = pri.find((a) => opts.includes(a)) || opts[0];
    bgFree[0] = pick([bgPick]);
  } else {
    bgFree[0] = pick([]);
    bgFree[1] = pick([bgFree[0]]);
  }

  const l1Free = [];
  for (let i = 0; i < 4; i++) l1Free.push(pick(l1Free));

  return { ancFree, bgPick, bgFree, l1Free, keyAbility: key };
}

/* Blank fields are now a real state rather than a stand-in for "human fighter",
   so anywhere a character is listed has to be able to say so. */
const charName = (x) => (x.name || "").trim() || "Unnamed character";
const charLine = (x) => {
  const a = (ANCESTRIES[x.ancestry] || {}).n;
  const k = (CLASSES[x.cls] || {}).n;
  if (!a && !k) return x.setup ? "Still being built" : "Level " + x.level;
  return "Level " + x.level + " " + [a, k].filter(Boolean).join(" ") + (x.subclass ? " · " + x.subclass : "");
};

// ---------- character factory ----------
function newChar(name) {
  return {
    id: "c" + Math.random().toString(36).slice(2, 9),
    /* Nothing is pre-chosen. A blank ancestry/class/background reads as "not
       decided yet" everywhere, and `setup` is the step the guided builder is
       on — 0 once the player is done with it (or skips it). */
    name: name || "",
    setup: 1,
    player: "", level: 1, xp: 0,
    ancestry: "", heritage: "", ancFree: [], ancFlawFree: "",
    background: "", bgPick: "", bgFree: [],
    cls: "", subclass: "", keyAbility: "",
    l1Free: [], boosts: { 5: [], 10: [], 15: [], 20: [] },
    trainedSkills: [], skillIncreases: {}, lores: [],
    feats: [], profOverride: {},
    weapons: [], items: [], armor: "Unarmored", shield: "No shield",
    armorPotency: 0, armorResilient: 0, shieldRaised: false, shieldHP: 0,
    coins: { pp: 0, gp: 15, sp: 0, cp: 0 },
    spellAbility: "", spellTradition: "", spellsKnown: [], slotsUsed: {},
    focusCur: 1, focusMax: 1,
    hpBonus: 0, acAdjust: 0, archetypeCasting: false, customSlots: null, bgName: "",
    hp: null, tempHp: 0, dying: 0, wounded: 0, hero: 1,
    conditions: {}, effects: [], favorites: [], notes: "",
    createdAt: Date.now(),
  };
}

// ---------- ability boosts ----------
function computeAbilities(c, ANCESTRIES, BACKGROUNDS, CLASSES) {
  const s = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const apply = (k) => { if (!k || !s[k]) return; s[k] += s[k] >= 18 ? 1 : 2; };
  const anc = ANCESTRIES[c.ancestry] || ANCESTRIES.human;
  const bgd = BACKGROUNDS[c.background] || BACKGROUNDS.acolyte;
  const cls = CLASSES[c.cls] || CLASSES.fighter;

  // ancestry flaw applies before boosts in the rules; it's a flat -2
  if (anc.f) s[anc.f] -= 2;
  let fi = 0;
  (anc.b || []).forEach((b) => { if (b === "free") apply(c.ancFree[fi++]); else apply(b); });
  // background: one of the two listed abilities, plus one free
  const bgOpts = (bgd.b || []).filter((b) => b !== "free");
  if (bgOpts.length === 2) { apply(c.bgPick || bgOpts[0]); apply(c.bgFree[0]); }
  else { apply(c.bgFree[0]); apply(c.bgFree[1]); }
  // class key ability
  apply(c.keyAbility || (cls.key && cls.key[0]));
  // four free boosts at level 1
  (c.l1Free || []).slice(0, 4).forEach(apply);
  // level 5/10/15/20 boosts (4 each)
  [5, 10, 15, 20].forEach((lv) => {
    if (c.level >= lv) (c.boosts[lv] || []).slice(0, 4).forEach(apply);
  });
  return s;
}

// ---------- proficiency ----------
function rankAt(prog, level) {
  let r = 0;
  if (!prog) return 0;
  for (const k of Object.keys(prog)) if (level >= +k) r = Math.max(r, prog[k]);
  return r;
}

function skillRank(c, key) {
  let r = 0;
  /* Your background trains a skill on top of the class's allowance. The Build
     tab shows it as trained, so it has to count here too. */
  if ((c.trainedSkills || []).includes(key) || (BACKGROUNDS[c.background] || {}).sk === key) r = 1;
  const inc = c.skillIncreases || {};
  for (const lv of Object.keys(inc)) {
    if (c.level >= +lv && inc[lv] === key) {
      r = r + 1;
      // cap by level
    }
  }
  const cap = c.level >= 15 ? 4 : c.level >= 7 ? 3 : c.level >= 3 ? 2 : 1;
  return Math.min(r, cap);
}

// ---------- conditions ----------
function conditionPenalties(c) {
  const co = c.conditions || {};
  const n = (k) => +co[k] || 0;
  const allStatus = Math.max(n("frightened"), n("sickened")); // status penalties don't stack
  return {
    all: -allStatus,
    dex: -Math.max(n("clumsy"), allStatus),
    str: -Math.max(n("enfeebled"), allStatus),
    mental: -Math.max(n("stupefied"), allStatus),
    fort: -Math.max(n("drained"), allStatus),
    acStatus: -(co.fatigued ? Math.max(1, allStatus) : allStatus),
    acCirc: co.offguard || co.prone || co.grabbed || co.restrained ? -2 : 0,
    meleeAtk: co.prone ? -2 : 0,
    saveStatus: -(co.fatigued ? Math.max(1, allStatus) : allStatus),
    drained: n("drained"),
    slowed: n("slowed"),
    enfeebled: n("enfeebled"),
  };
}

const abilityPenKey = (ab, pen) =>
  ab === "dex" ? pen.dex : ab === "str" ? pen.str : ["int", "wis", "cha"].includes(ab) ? pen.mental : pen.all;

// ---------- master derive ----------
/* ---------- temporary effects ----------
   An effect is a named bag of bonuses with an optional round counter. Nothing
   it does is written into the character's own fields, so ending it puts every
   number back exactly where it was. Bonus types follow the real stacking rule:
   best of each type, penalties worst of each type, untyped all stack. */
const FX_TYPES = ["status", "circumstance", "item", "untyped"];
const FX_LABEL = {
  ac: "AC", atk: "attack rolls", dmg: "damage", saves: "all saves",
  fort: "Fortitude", ref: "Reflex", will: "Will", per: "Perception",
  skill: "all skills", speed: "Speed", classDC: "Class DC",
  spellDC: "Spell DC", spellAtk: "spell attacks",
};
const fxTargetName = (k) =>
  FX_LABEL[k] || (k.indexOf("skill:") === 0 ? ((SKILLMAP[k.slice(6)] || {}).name || k.slice(6)) : k);

function fxLabel(e) {
  const parts = Object.entries((e && e.b) || {})
    .filter(([, v]) => +v)
    .map(([k, v]) => sgn(+v) + " " + fxTargetName(k));
  if (!parts.length) return "no bonus";
  const t = e && e.type && e.type !== "untyped" ? " " + e.type : "";
  return parts.join(", ") + t;
}

function fxOf(c) {
  const acc = {};
  const put = (target, type, n) => {
    acc[target] = acc[target] || {};
    acc[target][type] = (acc[target][type] || []).concat(n);
  };
  (c.effects || []).forEach((e) => {
    const type = FX_TYPES.includes(e.type) ? e.type : "untyped";
    Object.entries(e.b || {}).forEach(([k, raw]) => {
      const n = +raw || 0;
      if (!n) return;
      if (k === "saves") { put("fort", type, n); put("ref", type, n); put("will", type, n); }
      else if (k === "skill") SKILLS.forEach(([sk]) => put("skill:" + sk, type, n));
      else put(k, type, n);
    });
  });
  const best = (a) => (a && a.length ? Math.max(0, ...a) + Math.min(0, ...a) : 0);
  return (target) => {
    const a = acc[target];
    if (!a) return 0;
    return best(a.status) + best(a.circumstance) + best(a.item) +
      (a.untyped || []).reduce((t, x) => t + x, 0);
  };
}

function derive(c, D) {
  const { ANCESTRIES, BACKGROUNDS, CLASSES, SKILLS, ARMORS, SHIELDS, WEAPONS } = D;
  const cls = CLASSES[c.cls] || CLASSES.fighter;
  const anc = ANCESTRIES[c.ancestry] || ANCESTRIES.human;
  const lvl = c.level;
  const ab = computeAbilities(c, ANCESTRIES, BACKGROUNDS, CLASSES);
  const m = {}; Object.keys(ab).forEach((k) => (m[k] = Math.floor((ab[k] - 10) / 2)));
  const pen = conditionPenalties(c);
  const fx = fxOf(c);
  const ov = c.profOverride || {};
  const pr = (key, prog) => (ov[key] != null ? ov[key] : rankAt(prog, lvl));
  const pb = (rank) => (rank <= 0 ? 0 : lvl + rank * 2);

  const ranks = {
    perception: pr("perception", cls.perc),
    fortitude: pr("fortitude", cls.fort),
    reflex: pr("reflex", cls.ref),
    will: pr("will", cls.will),
    classDC: pr("classDC", cls.classDC),
    spell: pr("spell", cls.spellProf),
    unarmed: pr("unarmed", cls.unarmed),
    simple: pr("simple", cls.simple),
    martial: pr("martial", cls.martial),
    advanced: pr("advanced", cls.advanced || { 1: 0 }),
    unarmored: pr("unarmored", cls.unarmored),
    light: pr("light", cls.light),
    medium: pr("medium", cls.medium),
    heavy: pr("heavy", cls.heavy),
  };

  const hasToughness = (c.feats || []).some((f) => /toughness/i.test(f.name));
  const hpMax =
    anc.hp + lvl * ((cls.hp || 8) + m.con) + (hasToughness ? lvl : 0) + (+c.hpBonus || 0) - pen.drained * lvl;

  const armor = ARMORS.find((a) => a.n === c.armor) || ARMORS[0];
  const shield = SHIELDS.find((s) => s.n === c.shield) || SHIELDS[0];
  const armorRank = ranks[armor.c] || 0;
  const dexToAc = Math.min(m.dex, armor.dx);
  const ac =
    10 + (armor.ac || 0) + pb(armorRank) + dexToAc + (c.armorPotency || 0) +
    (c.shieldRaised ? shield.ac : 0) + (+c.acAdjust || 0) +
    /* AC is a Dex-based DC, so clumsy applies to it. Status penalties never
       stack — the worst of clumsy, frightened, sickened and fatigued wins. */
    Math.min(pen.acStatus, pen.dex) + pen.acCirc + fx("ac");

  const saveBonus = (c.armorResilient || 0);
  const saves = {
    fortitude: pb(ranks.fortitude) + m.con + saveBonus + pen.fort + fx("fort"),
    /* Two status penalties at once don't average out and don't add up: you
       take the worse of them. */
    reflex: pb(ranks.reflex) + m.dex + saveBonus + Math.min(pen.dex, pen.saveStatus) + fx("ref"),
    will: pb(ranks.will) + m.wis + saveBonus + Math.min(pen.mental, pen.saveStatus) + fx("will"),
  };

  const perception = pb(ranks.perception) + m.wis + pen.mental + fx("per");

  const meetsStr = !armor.st || ab.str >= armor.st;
  const checkPen = meetsStr ? 0 : (armor.ck || 0);
  const speedPen = meetsStr ? 0 : (armor.sp || 0);

  const coin = c.coins || {};
  const bulk =
    (c.items || []).reduce((t, i) => t + (i.bulk || 0) * (i.qty || 1), 0) +
    (c.weapons || []).reduce((t, wn) => { const b = (D.WEAPONS || WEAPONS).find((x) => x.n === wn.base); return t + (b ? b.b : 0); }, 0) +
    (armor.b || 0) + (shield.b || 0) +
    Math.floor(((+coin.pp || 0) + (+coin.gp || 0) + (+coin.sp || 0) + (+coin.cp || 0)) / 1000);
  const bulkLimit = 5 + m.str;
  const encumbered = bulk > bulkLimit;

  /* Encumbered is −10 ft Speed and clumsy 1. The Speed comes off here; the
     clumsy stays a condition you toggle, because whether you keep carrying
     the loot is your call, not the sheet's. */
  const speed = anc.spd + speedPen + (encumbered ? -10 : 0) + fx("speed");

  const skills = {};
  SKILLS.forEach(([key, name, abil]) => {
    const r = ov["skill:" + key] != null ? ov["skill:" + key] : skillRank(c, key);
    const armorPen = ["acrobatics", "athletics", "stealth", "thievery"].includes(key) ? checkPen : 0;
    skills[key] = {
      name, abil, rank: r,
      mod: pb(r) + m[abil] + abilityPenKey(abil, pen) + armorPen + fx("skill:" + key),
      armorPen,
    };
  });

  const keyMod = m[c.keyAbility || (cls.key && cls.key[0]) || "str"];
  const classDC = ranks.classDC > 0 ? 10 + pb(ranks.classDC) + keyMod + pen.all + fx("classDC") : null;

  const spAb = c.spellAbility || (cls.key && cls.key[0]);
  const casts = !!(cls.casting || c.archetypeCasting);
  const spellDC = casts ? 10 + pb(ranks.spell) + m[spAb] + pen.mental + fx("spellDC") : null;
  const spellAtk = casts ? pb(ranks.spell) + m[spAb] + pen.mental + fx("spellAtk") : null;

  // weapon specialization
  const specClasses = ["alchemist", "barbarian", "champion", "fighter", "monk", "ranger", "rogue", "swashbuckler", "investigator", "bard", "cleric", "druid", "sorcerer", "witch", "wizard", "oracle"];
  const specLevel = { barbarian: 7, champion: 7, fighter: 7, monk: 7, ranger: 7, rogue: 7, swashbuckler: 7, investigator: 7, alchemist: 7, bard: 13, cleric: 13, druid: 13, sorcerer: 13, witch: 13, wizard: 13, oracle: 13 }[c.cls] || 99;
  const greaterSpec = lvl >= 15 && specLevel === 7;

  const attacks = (c.weapons || []).map((wpn) => {
    const base = (D.WEAPONS || WEAPONS).find((x) => x.n === wpn.base) || {};
    /* When the base weapon is still in the tables, it wins — that way editing a
       homebrew stat block updates every copy already being carried. Weapons
       whose base has since been deleted fall back to the stats they were
       created with, so nothing a character owns ever breaks. */
    const known = !!base.n;
    const ovr = wpn.over || {};   // this one copy differs from the table on purpose
    const traits = ovr.tr || (known ? base.tr : wpn.traits) || wpn.traits || [];
    const tstr = traits.join(" ").toLowerCase();
    const cat = ovr.c || (known && base.c) || wpn.cat || "simple";
    const r = ranks[cat] != null ? ranks[cat] : 0;
    const ranged = ovr.r != null ? !!ovr.r : known ? !!base.r : !!wpn.ranged;
    const finesse = /finesse/.test(tstr);
    const propulsive = /propulsive/.test(tstr);
    const thrown = /thrown/.test(tstr);
    const agile = /agile/.test(tstr);
    const deadly = /deadly d(\d+)/.exec(tstr);
    const fatal = /fatal d(\d+)/.exec(tstr);
    const twoHand = /two-hand d(\d+)/.exec(tstr);
    const versatile = /versatile ([bps])/.exec(tstr);
    const atkAb = ranged ? "dex" : finesse ? (m.dex > m.str ? "dex" : "str") : "str";
    const atkMod =
      pb(r) + m[atkAb] + (wpn.potency || 0) + abilityPenKey(atkAb, pen) +
      (ranged ? 0 : pen.meleeAtk) + (wpn.atkBonus || 0) + fx("atk");
    /* Enfeebled is a status penalty to Strength-based damage: melee, thrown,
       and the half-Strength a propulsive bow adds. Not a plain bow. */
    const strDamage = !ranged || thrown || propulsive;
    const dmgAbMod =
      (ranged ? (propulsive ? Math.floor(m.str / 2) : thrown ? m.str : 0) : m.str) -
      (strDamage ? pen.enfeebled : 0);
    const spec = lvl >= specLevel ? (greaterSpec ? (r >= 4 ? 8 : r >= 3 ? 6 : 4) : r >= 4 ? 4 : r >= 3 ? 3 : 2) : 0;
    const dice = 1 + (wpn.striking || 0);
    const baseDie = (ovr.d || (known && base.d) || wpn.die || "1d6").replace(/^\d+/, "");
    /* two-hand dN: holding it in both hands swaps the damage die. Per weapon
       rather than per stat block, because it's a choice you make mid-fight. */
    const die = twoHand && wpn.twoHanded ? "d" + twoHand[1] : baseDie;

    /* On a critical hit everything the weapon rolls doubles. Fatal swaps the
       die and adds one more of the new size before that doubling; deadly adds
       its dice afterwards, undoubled. Deadly scales with striking: one die
       normally, two with striking, three with greater, four with major. */
    const critDmg = fatal ? (dice + 1) + "d" + fatal[1] : dice + die;
    const deadlyDmg = deadly ? dice + "d" + deadly[1] : "";
    const mapStep = agile ? 4 : 5;
    return {
      id: wpn.id, name: wpn.name || base.n, cat, rank: r, traits, ranged,
      atk: atkMod, map1: atkMod - mapStep, map2: atkMod - mapStep * 2,
      dmg: dice + die, dmgMod: dmgAbMod + spec + (wpn.dmgBonus || 0) + fx("dmg"),
      critDmg, deadlyDmg,
      critNote: fatal ? "fatal " + critDmg + " on a crit" : deadly ? "deadly +" + deadlyDmg + " on a crit" : "",
      twoHand: twoHand ? +twoHand[1] : 0, twoHanded: !!wpn.twoHanded,
      versatile: versatile ? versatile[1].toUpperCase() : null,
      extraDice: wpn.extraDice || "", extraNote: wpn.extraNote || "",
      dmgType: wpn.versatileAs || ovr.t || (known && base.t) || wpn.dmgType || "B", spec, potency: wpn.potency || 0, striking: wpn.striking || 0,
      edited: !!(ovr.d || ovr.t || ovr.c || ovr.tr || ovr.r != null),
      agile,
    };
  });

  return {
    ab, m, ranks, pb, hpMax, ac, saves, perception, skills, classDC, spellDC, spellAtk, fx,
    speed, bulk, bulkLimit, checkPen, keyMod, attacks, pen, armor, shield, cls, anc, casts,
    dyingMax: 4 - (+(c.conditions || {}).doomed || 0),
    spellAbility: spAb,
  };
}

// ---------- level-up plan ----------
function levelPlan(level, cls) {
  const out = [];
  const feats = (cls.features || []).filter((f) => f[0] === level);
  if (feats.length) out.push({ k: "classFeature", label: level === 1 ? "Class features" : "Class feature", detail: feats.map((f) => f[1]).join("; ") });
  else if (level === 1) out.push({ k: "classFeature", label: "Class features" });
  /* Level 1 gives a class feat as well as an ancestry one — it was missing. */
  if (level === 1) {
    out.push({ k: "skills", label: "Trained skills" });
    out.push({ k: "classFeat", label: "Class feat" });
    out.push({ k: "ancestryFeat", label: "Ancestry feat" });
  }
  if (level % 2 === 0) out.push({ k: "classFeat", label: "Class feat" });
  /* Most classes alternate; rogues and investigators take one every level. */
  if (level % 2 === 0 || cls.skillFeatEveryLevel) out.push({ k: "skillFeat", label: "Skill feat" });
  if ([3, 7, 11, 15, 19].includes(level)) out.push({ k: "generalFeat", label: "General feat" });
  /* Standard is every odd level from 3rd; the rogue gets one every level from 2nd. */
  if (cls.skillIncreaseEveryLevel ? level >= 2 : level >= 3 && level % 2 === 1) out.push({ k: "skillIncrease", label: "Skill increase" });
  if ([5, 9, 13, 17].includes(level)) out.push({ k: "ancestryFeat", label: "Ancestry feat" });
  if ([5, 10, 15, 20].includes(level)) out.push({ k: "boosts", label: "Four ability boosts" });
  return out;
}


const BASE_CSS = `
*{box-sizing:border-box}
.pf{font-family:var(--font);color:var(--tx);background:var(--ink);background-image:var(--bgimg);
background-attachment:fixed;min-height:100vh;font-variant-numeric:tabular-nums;
-webkit-font-smoothing:antialiased;font-size:15px;line-height:1.45}
:where(.pf button){font:inherit;color:inherit;background:none;border:none;cursor:pointer}
.pf input,.pf select,.pf textarea{font:inherit;color:var(--tx);background:var(--pan2);
border:var(--bd) solid var(--line);border-radius:var(--radsm);padding:7px 9px;width:100%}
.pf input:focus,.pf select:focus,.pf textarea:focus{outline:2px solid var(--brass);outline-offset:1px}
/* Safari zooms the page when you focus anything under 16px, which rearranges
   the screen mid-fight just because you typed a damage number. */
@media(max-width:719px){.pf input,.pf select,.pf textarea{font-size:16px}}
/* Long-press is a control here, not an invitation to select text. */
.pf button{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.pf input,.pf textarea{-webkit-user-select:text;user-select:text}
.pf button:focus-visible{outline:2px solid var(--brass);outline-offset:2px}
.wrap{max-width:1180px;margin:0 auto;
padding:0 calc(12px + env(safe-area-inset-right)) calc(110px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left))}
.top{position:sticky;top:0;padding-top:env(safe-area-inset-top);z-index:30;background:var(--topbg);border-bottom:var(--bd) solid var(--line);
backdrop-filter:blur(8px)}
.topin{max-width:1180px;margin:0 auto;padding:9px 12px;display:flex;align-items:center;gap:8px;position:relative;z-index:2}
.nm{font-family:var(--fontd);font-weight:800;font-size:17px;letter-spacing:var(--trackd);
white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub{color:var(--mut);font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabs{display:flex;gap:3px;overflow-x:auto;padding:0 8px 8px;max-width:1180px;margin:0 auto;
scrollbar-width:none;position:relative;z-index:2}
.tabs::-webkit-scrollbar{display:none}
.tab{padding:6px 13px;border-radius:var(--pillrad);color:var(--mut);font-size:13.5px;font-weight:600;
white-space:nowrap;border:var(--bd) solid transparent}
.tab.on{background:var(--pan2);color:var(--tx);border-color:var(--line);box-shadow:var(--btnshadow)}
.card{background:var(--pan);border:var(--bd) solid var(--line);border-radius:var(--rad);padding:13px;
margin:10px 0;box-shadow:var(--cardshadow)}
.card h3{margin:0 0 9px;font-family:var(--fontd);font-size:var(--h3size);font-weight:800;color:var(--brass);
letter-spacing:var(--trackd)}
.row{display:flex;align-items:center;gap:9px}
.between{display:flex;align-items:center;justify-content:space-between;gap:9px}
.grid{display:grid;gap:8px}
.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g4{grid-template-columns:repeat(4,1fr)}
.g6{grid-template-columns:repeat(3,1fr)}
@media(min-width:720px){.g6{grid-template-columns:repeat(6,1fr)}.cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}}
.stat{background:var(--pan2);border:var(--bd) solid var(--line);border-radius:var(--radsm);padding:9px 6px;
text-align:center;box-shadow:var(--statshadow)}
.stat .v{font-family:var(--fontd);font-size:23px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
.stat .l{font-size:10.5px;color:var(--mut);margin-top:2px;font-weight:600}
.stat .s{font-size:10px;color:var(--steel)}
.btn{background:var(--pan2);border:var(--bd) solid var(--line);border-radius:var(--radsm);padding:8px 12px;
font-weight:600;font-size:14px;box-shadow:var(--btnshadow);display:inline-block;text-decoration:none}
.btn:hover{border-color:var(--brass)}
.btn:active{transform:translate(1px,1px)}
.btn.pri{background:var(--brass);color:var(--onbrass);border-color:var(--brass)}
.btn.dan{background:var(--danbg);border-color:var(--danbd);color:var(--dantx)}
.btn.gd{background:var(--gdbg);border-color:var(--gdbd);color:var(--gdtx)}
.btn.sm{padding:4px 9px;font-size:12.5px}
.hpbar{height:16px;background:var(--hpbg);border-radius:var(--pillrad);overflow:hidden;border:var(--bd) solid var(--line)}
.hpfill{height:100%;background:var(--hpfill);transition:width .25s ease}
.hpnum{font-family:var(--fontd);font-size:36px;font-weight:800;letter-spacing:-.03em;line-height:1}
.pill{display:inline-flex;align-items:center;gap:6px;background:var(--pan2);border:var(--bd) solid var(--line);
border-radius:var(--pillrad);padding:4px 10px;font-size:12.5px;font-weight:600}
.pill.on{background:var(--pillon);border-color:var(--brass);color:var(--brass)}
.line{border-top:var(--bd) solid var(--line);margin:9px 0}
.atk{display:grid;grid-template-columns:1fr auto;gap:8px;padding:9px 0;border-bottom:1px solid var(--line2)}
.atk:last-child{border-bottom:none}
.maps{display:flex;gap:5px}
.mapb{background:var(--pan2);border:var(--bd) solid var(--line);border-radius:var(--radsm);padding:5px 9px;
font-family:var(--fontd);font-weight:800;font-size:14px;min-width:46px;text-align:center;box-shadow:var(--btnshadow)}
.mapb:hover{border-color:var(--brass)}
.mapb small{display:block;font-size:9px;color:var(--mut);font-weight:600;font-family:var(--font)}
.skrow{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line2)}
.skrow:last-child{border-bottom:none}
.rk{font-size:10px;font-weight:800;width:16px;height:16px;line-height:16px;text-align:center;
border-radius:3px;background:var(--pan2);color:var(--mut)}
.rk.t{background:var(--rkt);color:var(--rktx)}.rk.e{background:var(--rke);color:var(--rkex)}
.rk.m{background:var(--rkm);color:var(--rkmx)}.rk.l{background:var(--rkl);color:var(--rklx)}
.mo{font-family:var(--fontd);font-weight:800;font-size:15px;min-width:40px;text-align:right}
.mut{color:var(--mut)}.sm{font-size:12.5px}.xs{font-size:11.5px}
.chk{display:flex;gap:9px;align-items:flex-start;padding:9px;border:var(--bd) solid var(--line);
border-radius:var(--radsm);background:var(--pan2);margin-bottom:7px}
.dot{width:9px;height:9px;border-radius:50%;background:var(--line);margin-top:6px;flex:none}
.dot.done{background:var(--verd)}
.log{position:fixed;left:0;right:0;bottom:0;z-index:40;background:var(--pan);border-top:var(--bd) solid var(--line);
padding:9px 12px calc(9px + env(safe-area-inset-bottom));max-height:42vh;overflow:auto}
.logline{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid var(--line2);font-size:13px}
.big{font-family:var(--fontd);font-size:19px;font-weight:800}
.crit{color:var(--verd)}.fumble{color:var(--crim)}
.sheet{position:fixed;inset:0;z-index:50;background:var(--scrim);display:flex;align-items:flex-end;justify-content:center}
.sheetin{background:var(--pan);border:var(--bd) solid var(--line);border-radius:var(--rad) var(--rad) 0 0;
width:100%;max-width:640px;max-height:88vh;overflow:auto;padding:14px}
@media(min-width:720px){.sheet{align-items:center}.sheetin{border-radius:var(--rad)}}
.link{color:var(--brass);text-decoration:none;border-bottom:1px dotted var(--brass);font-size:12px}
.ftrow{padding:9px 0;border-bottom:1px solid var(--line2)}
.ftrow:last-child{border-bottom:none}
.badge{font-size:10px;font-weight:700;padding:2px 6px;border-radius:3px;background:var(--pan2);color:var(--mut)}
.empty{text-align:center;color:var(--mut);padding:22px 10px;font-size:13.5px}
.askbtn{position:fixed;right:14px;z-index:45;background:var(--brass);color:var(--onbrass);
bottom:calc(var(--logh, 0px) + 18px + env(safe-area-inset-bottom));
border:var(--bd) solid var(--line);border-radius:var(--pillrad);padding:11px 16px;font-weight:800;
font-family:var(--fontd);letter-spacing:var(--trackd);transition:bottom .2s ease;
box-shadow:0 0 0 4px var(--ink),var(--askshadow)}
.askbtn:active{transform:translate(1px,1px)}
.bub{padding:9px 11px;border-radius:var(--rad);margin-bottom:8px;max-width:92%;font-size:14px;line-height:1.5}
.bub.me{background:var(--pan2);border:var(--bd) solid var(--line);margin-left:auto}
.bub.cl{background:var(--bubcl);border:var(--bd) solid var(--brass)}
.opsbox{border:var(--bd) dashed var(--brass);border-radius:var(--rad);padding:10px;margin-bottom:8px;background:var(--pillon)}
.opline{display:flex;gap:7px;padding:3px 0;font-size:13px}

/* --- dice roller --- */
.dicewrap{position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;
justify-content:center;gap:9px;background:var(--diceScrim)}
.die{width:116px;height:116px;display:flex;align-items:center;justify-content:center;
font-family:var(--fontd);font-weight:800;font-size:50px;line-height:1;color:var(--tx);
background:var(--diebg);border:3px solid var(--diebd);border-radius:var(--dierad);
box-shadow:var(--dieshadow)}
.die[data-phase="rolling"]{animation:tumble .62s ease-out}
.die[data-phase="land"]{animation:land .34s cubic-bezier(.2,1.7,.4,1)}
.die[data-phase="crit"]{animation:land .34s cubic-bezier(.2,1.7,.4,1);border-color:var(--verd);
box-shadow:var(--dieshadow),0 0 34px var(--verd)}
.die[data-phase="fumble"]{animation:shake .42s;border-color:var(--crim);
box-shadow:var(--dieshadow),0 0 28px var(--crim)}
@keyframes tumble{0%{transform:translateY(-150px) rotate(0deg)}
34%{transform:translateY(10px) rotate(210deg)}
54%{transform:translateY(-30px) rotate(310deg)}
76%{transform:translateY(6px) rotate(400deg)}
100%{transform:translateY(0) rotate(360deg)}}
@keyframes land{0%{transform:scale(1.3)}100%{transform:scale(1)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}
40%{transform:translateX(10px)}60%{transform:translateX(-7px)}80%{transform:translateX(7px)}}
.dicelabel{font-family:var(--fontd);font-weight:800;font-size:17px;text-align:center;padding:0 20px}
.dicemath{color:var(--mut);font-size:13px}
.diceverdict{font-family:var(--fontd);font-weight:800;font-size:15px;letter-spacing:.07em}
.dicehint{color:var(--steel);font-size:11px;margin-top:8px}
.critter,.coinpop{display:none}
@media (prefers-reduced-motion:reduce){.die,.critter,.coinpop i{animation:none !important}}
.swatch{width:15px;height:15px;border-radius:50%;border:2px solid rgba(255,255,255,.25);display:inline-block}

/* --- guided builder --- */
.opt{display:block;width:100%;text-align:left;background:var(--pan2);border:var(--bd) solid var(--line);
border-radius:var(--radsm);padding:10px 12px;margin-bottom:7px;box-shadow:var(--btnshadow)}
.opt:hover{border-color:var(--brass)}
.opt.on{border-color:var(--brass);background:var(--pillon)}
.opt .t{font-weight:700;font-size:14.5px;display:flex;align-items:center;gap:7px}
.opt .why{color:var(--mut);font-size:12.5px;margin-top:3px;line-height:1.4}
.tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.tick{color:var(--brass);font-weight:800;margin-left:auto;font-size:13px}
.bar{height:6px;background:var(--pan2);border:1px solid var(--line);border-radius:99px;overflow:hidden}
.barfill{height:100%;background:var(--brass);transition:width .3s ease}
.note{background:var(--pillon);border:var(--bd) solid var(--line);border-left:3px solid var(--brass);
border-radius:var(--radsm);padding:9px 11px;font-size:13px;line-height:1.5;margin:10px 0}
.gnav{display:flex;gap:9px;align-items:center;justify-content:space-between;margin:14px 0 4px}
.steplabel{font-family:var(--fontd);font-size:11px;font-weight:800;letter-spacing:.09em;
text-transform:uppercase;color:var(--steel)}
.numlist{counter-reset:g;list-style:none;padding:0;margin:0}
.numlist li{counter-increment:g;position:relative;padding:5px 0 5px 30px;font-size:13.5px;line-height:1.45}
.numlist li:before{content:counter(g);position:absolute;left:0;top:5px;width:20px;height:20px;
border-radius:50%;background:var(--pan2);border:var(--bd) solid var(--line);color:var(--brass);
font-size:11px;font-weight:800;text-align:center;line-height:18px}
`;

const THEMES = {
  underground: {
    name: "Gritty Mario",
    blurb: "Soot-caked brick, warp-pipe green, coin gold. Chunky arcade edges and hard drop shadows.",
    dot: "#f2b632",
    vars: {
      ink: "#1d120d", pan: "#33211a", pan2: "#412b21", line: "#6a4432", line2: "#4d3226",
      tx: "#f6e8d3", mut: "#bb9878", steel: "#94725a",
      brass: "#f2b632", onbrass: "#241408", crim: "#e0432b", verd: "#57a83f", vio: "#8b6bd6",
      rad: "6px", radsm: "4px", pillrad: "4px", bd: "2px",
      font: '"Helvetica Neue",Helvetica,Arial,sans-serif',
      fontd: '"Arial Black","Arial Bold",Gadget,Impact,sans-serif',
      trackd: ".01em", h3size: "12px",
      btnshadow: "2px 2px 0 rgba(0,0,0,.5)", cardshadow: "3px 3px 0 rgba(0,0,0,.38)",
      statshadow: "inset 0 -3px 0 rgba(0,0,0,.3)", askshadow: "3px 3px 0 rgba(0,0,0,.55)",
      topbg: "linear-gradient(180deg,#3a251c,#2a1a13)",
      hpbg: "#2a1512", hpfill: "repeating-linear-gradient(90deg,#e0432b 0 11px,#a82e1c 11px 15px)",
      pillon: "#4a3412", bubcl: "#3b2a13",
      danbg: "#48201a", danbd: "#7a352a", dantx: "#f5b5a7",
      gdbg: "#1e3a18", gdbd: "#3d6b30", gdtx: "#b7e3a3",
      scrim: "rgba(12,7,4,.88)",
      rkt: "#2d3f56", rktx: "#a3c8ee", rke: "#2f4a26", rkex: "#aede98",
      rkm: "#4d3a1a", rkmx: "#f0c67d", rkl: "#42284c", rklx: "#d6a8ef",
      diebg: "linear-gradient(180deg,#5c3b2b,#43291e)", diebd: "#8b4a2b", dierad: "7px",
      dieshadow: "inset -5px -5px 0 rgba(0,0,0,.34),inset 5px 5px 0 rgba(255,255,255,.13),5px 5px 0 rgba(0,0,0,.5)",
      diceScrim: "rgba(18,10,6,.82)",
      bgimg: "repeating-linear-gradient(0deg,transparent 0 30px,rgba(0,0,0,.34) 30px 33px),repeating-linear-gradient(90deg,transparent 0 62px,rgba(0,0,0,.26) 62px 65px)",
    },
    extra: `
.pf .top{position:sticky;overflow:hidden}
.pf .top:after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 1px,transparent 1px 3px)}
.pf .card{border-top:3px solid rgba(242,182,50,.5)}
.pf .card h3{text-shadow:1px 1px 0 rgba(0,0,0,.55)}
.pf .hpnum{text-shadow:2px 2px 0 rgba(0,0,0,.5)}
.pf .stat .v{text-shadow:1px 1px 0 rgba(0,0,0,.45)}
.pf .mapb{background:linear-gradient(180deg,#4b3226,#3a241b)}

/* --- 8-bit iconography (original pixel art, no licensed characters) --- */
.pf .card h3[data-icon]:before,.pf .tab:before,.pf .hpnum:before,.pf .askbtn:before{
content:"";display:inline-block;image-rendering:pixelated;background-repeat:no-repeat;
background-position:center;background-size:contain;flex:none}
.pf .card h3[data-icon]:before{width:15px;height:15px;margin-right:7px;vertical-align:-3px}
.pf .tab:before{width:13px;height:13px;margin-right:6px;vertical-align:-2px;opacity:.75}
.pf .tab.on:before{opacity:1}
.pf .hpnum:before{width:27px;height:27px;margin-right:11px;vertical-align:1px}
.pf .askbtn:before{width:15px;height:15px;margin-right:8px;vertical-align:-3px}
.pf .hpnum:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e0453a' d='M1 1h2v1H1z M5 1h2v1H5z M0 2h8v2H0z M1 4h6v1H1z M2 5h4v1H2z M3 6h2v1H3z'/><path fill='%23ff9b8c' d='M1 2h1v1H1z M2 3h1v1H2z'/></svg>")}
.pf .askbtn:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23f2b632' d='M3 0h2v1H3z M2 1h4v1H2z M1 2h6v4H1z M2 6h4v1H2z M3 7h2v1H3z'/><path fill='%23a8761a' d='M3 2h2v4H3z'/><path fill='%23ffe08a' d='M2 2h1v4H2z'/></svg>")}
.pf h3[data-icon="coin"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23f2b632' d='M3 0h2v1H3z M2 1h4v1H2z M1 2h6v4H1z M2 6h4v1H2z M3 7h2v1H3z'/><path fill='%23a8761a' d='M3 2h2v4H3z'/><path fill='%23ffe08a' d='M2 2h1v4H2z'/></svg>")}
.pf h3[data-icon="heart"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e0453a' d='M1 1h2v1H1z M5 1h2v1H5z M0 2h8v2H0z M1 4h6v1H1z M2 5h4v1H2z M3 6h2v1H3z'/><path fill='%23ff9b8c' d='M1 2h1v1H1z M2 3h1v1H2z'/></svg>")}
.pf h3[data-icon="star"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23f2d24b' d='M3 0h2v2H3z M0 2h8v2H0z M1 4h6v1H1z M2 5h4v1H2z M1 6h2v2H1z M5 6h2v2H5z'/><path fill='%23fff3b0' d='M3 2h1v2H3z'/></svg>")}
.pf h3[data-icon="flag"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23cfc9b8' d='M1 0h1v8H1z'/><path fill='%23e0453a' d='M2 1h5v3H2z'/><path fill='%2357a83f' d='M0 7h8v1H0z'/></svg>")}
.pf h3[data-icon="shield"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%239fb4cc' d='M1 0h6v1H1z M0 1h8v3H0z M1 4h6v2H1z M2 6h4v1H2z M3 7h2v1H3z'/><path fill='%235b7492' d='M3 2h2v3H3z'/></svg>")}
.pf h3[data-icon="fire"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e0453a' d='M2 1h4v1H2z M1 2h6v4H1z M2 6h4v1H2z'/><path fill='%23f2d24b' d='M3 3h2v2H3z'/></svg>")}
.pf h3[data-icon="book"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%234a6fa8' d='M0 0h8v7H0z'/><path fill='%232c4570' d='M3 0h2v7H3z'/><path fill='%23efe6d0' d='M1 1h2v5H1z M5 1h2v5H5z'/></svg>")}
.pf h3[data-icon="gem"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%237fd4d0' d='M2 0h4v1H2z M1 1h6v2H1z M2 3h4v2H2z M3 5h2v2H3z'/><path fill='%23d8fbf9' d='M3 1h1v2H3z'/></svg>")}
.pf h3[data-icon="bomb"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%232b2b2b' d='M2 2h4v1H2z M1 3h6v4H1z M2 7h4v1H2z'/><path fill='%23f2b632' d='M5 0h1v2H5z'/><path fill='%237a7a7a' d='M2 4h1v1H2z'/></svg>")}
.pf h3[data-icon="box"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23a8701f' d='M0 0h8v8H0z'/><path fill='%236f4710' d='M0 3h8v2H0z M3 0h2v8H3z'/><path fill='%23d8a552' d='M1 1h1v1H1z M6 1h1v1H6z M1 6h1v1H1z M6 6h1v1H6z'/></svg>")}
.pf h3[data-icon="scroll"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e8dcc0' d='M0 1h8v6H0z'/><path fill='%237a6a4a' d='M1 2h6v1H1z M1 4h6v1H1z M1 6h4v1H1z'/></svg>")}
.pf h3[data-icon="pipe"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%2357a83f' d='M0 0h8v2H0z'/><path fill='%233b7a2c' d='M1 2h6v6H1z'/><path fill='%238fe06a' d='M2 2h1v6H2z M1 0h1v2H1z'/></svg>")}
.pf .tab[data-tab="play"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e0453a' d='M1 1h2v1H1z M5 1h2v1H5z M0 2h8v2H0z M1 4h6v1H1z M2 5h4v1H2z M3 6h2v1H3z'/><path fill='%23ff9b8c' d='M1 2h1v1H1z M2 3h1v1H2z'/></svg>")}
.pf .tab[data-tab="build"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%237fd4d0' d='M2 0h4v1H2z M1 1h6v2H1z M2 3h4v2H2z M3 5h2v2H3z'/><path fill='%23d8fbf9' d='M3 1h1v2H3z'/></svg>")}
.pf .tab[data-tab="feats"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23cfc9b8' d='M1 0h1v8H1z'/><path fill='%23e0453a' d='M2 1h5v3H2z'/><path fill='%2357a83f' d='M0 7h8v1H0z'/></svg>")}
.pf .tab[data-tab="gear"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23a8701f' d='M0 0h8v8H0z'/><path fill='%236f4710' d='M0 3h8v2H0z M3 0h2v8H3z'/><path fill='%23d8a552' d='M1 1h1v1H1z M6 1h1v1H6z M1 6h1v1H1z M6 6h1v1H6z'/></svg>")}
.pf .tab[data-tab="spells"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23f2d24b' d='M3 0h2v2H3z M0 2h8v2H0z M1 4h6v1H1z M2 5h4v1H2z M1 6h2v2H1z M5 6h2v2H5z'/><path fill='%23fff3b0' d='M3 2h1v2H3z'/></svg>")}
.pf .tab[data-tab="notes"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23e8dcc0' d='M0 1h8v6H0z'/><path fill='%237a6a4a' d='M1 2h6v1H1z M1 4h6v1H1z M1 6h4v1H1z'/></svg>")}

/* --- blocks, bricks and a ground line --- */
.pf .stat{background-color:#4a3125;
background-image:radial-gradient(circle at 5px 5px,rgba(255,255,255,.2) 1.4px,transparent 2px),
radial-gradient(circle at calc(100% - 5px) 5px,rgba(255,255,255,.2) 1.4px,transparent 2px),
radial-gradient(circle at 5px calc(100% - 5px),rgba(255,255,255,.2) 1.4px,transparent 2px),
radial-gradient(circle at calc(100% - 5px) calc(100% - 5px),rgba(255,255,255,.2) 1.4px,transparent 2px);
box-shadow:inset -3px -3px 0 rgba(0,0,0,.34),inset 3px 3px 0 rgba(255,255,255,.11)}
.pf .mapb{box-shadow:inset -2px -2px 0 rgba(0,0,0,.3),inset 2px 2px 0 rgba(255,255,255,.1),2px 2px 0 rgba(0,0,0,.45)}
.pf .btn.pri{box-shadow:inset -2px -2px 0 rgba(0,0,0,.26),inset 2px 2px 0 rgba(255,255,255,.42),2px 2px 0 rgba(0,0,0,.5)}
.pf .askbtn{box-shadow:0 0 0 4px var(--ink),inset -2px -2px 0 rgba(0,0,0,.26),inset 2px 2px 0 rgba(255,255,255,.42),3px 3px 0 rgba(0,0,0,.55)}
.pf .line{border-top:0;height:5px;margin:11px 0;
background:repeating-linear-gradient(90deg,#6a4432 0 11px,#2c1b13 11px 13px)}
.pf .top{padding-bottom:5px}
.pf .top:before{content:"";position:absolute;left:0;right:0;bottom:0;height:5px;z-index:3;
background:linear-gradient(180deg,#57a83f 0 2px,#8b4a2b 2px 5px)}
.pf .pill.on{box-shadow:inset -2px -2px 0 rgba(0,0,0,.25)}
.pf .hpbar{box-shadow:inset 0 2px 0 rgba(0,0,0,.4)}

/* --- the critter: an original angry brick, drawn for this app --- */
.pf .critter{display:block;width:76px;height:64px;image-rendering:pixelated;
background:center bottom/contain no-repeat url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10' shape-rendering='crispEdges'><path fill='%236d2f18' d='M1 0h10v1H1z M0 1h1v7H0z M11 1h1v7H11z M1 7h10v1H1z'/><path fill='%23b0532f' d='M1 1h10v6H1z'/><path fill='%237f3a1f' d='M1 4h10v1H1z'/><path fill='%234a1f10' d='M2 1h3v1H2z M7 1h3v1H7z M3 5h6v1H3z'/><path fill='%23f6e8d3' d='M2 2h3v2H2z M7 2h3v2H7z M4 5h1v1H4z M7 5h1v1H7z'/><path fill='%231b1008' d='M3 3h1v1H3z M8 3h1v1H8z'/><path fill='%233a2118' d='M1 8h3v2H1z M8 8h3v2H8z'/></svg>");
animation:waddle .55s ease-in-out infinite alternate}
.pf .critter[data-squash="1"]{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10' shape-rendering='crispEdges'><path fill='%236d2f18' d='M0 6h12v4H0z'/><path fill='%23b0532f' d='M1 7h10v2H1z'/><path fill='%231b1008' d='M2 7h1v1H2z M4 7h1v1H4z M7 7h1v1H7z M9 7h1v1H9z M3 8h1v1H3z M8 8h1v1H8z'/><path fill='%233a2118' d='M0 9h2v1H0z M10 9h2v1H10z'/></svg>");animation:splat .32s ease-out}
.pf .critter[data-bite="1"]{animation:lunge .36s ease-out 2}
@keyframes waddle{from{transform:translateY(0)}to{transform:translateY(-6px)}}
@keyframes splat{0%{transform:scaleY(1.5)}100%{transform:scaleY(1)}}
@keyframes lunge{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-15px) scale(1.25)}}
.pf .coinpop{display:flex;gap:17px;height:15px}
.pf .coinpop i{width:15px;height:15px;image-rendering:pixelated;opacity:0;
background:center/contain no-repeat url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'><path fill='%23f2b632' d='M3 0h2v1H3z M2 1h4v1H2z M1 2h6v4H1z M2 6h4v1H2z M3 7h2v1H3z'/><path fill='%23a8761a' d='M3 2h2v4H3z'/><path fill='%23ffe08a' d='M2 2h1v4H2z'/></svg>");animation:coinup .9s ease-out forwards}
.pf .coinpop i:nth-child(2){animation-delay:.1s}
.pf .coinpop i:nth-child(3){animation-delay:.2s}
@keyframes coinup{0%{transform:translateY(0);opacity:0}
22%{opacity:1}100%{transform:translateY(-64px);opacity:0}}
.pf .die{background-image:
radial-gradient(circle at 10px 10px,rgba(255,255,255,.22) 2px,transparent 2.7px),
radial-gradient(circle at calc(100% - 10px) 10px,rgba(255,255,255,.22) 2px,transparent 2.7px),
radial-gradient(circle at 10px calc(100% - 10px),rgba(255,255,255,.22) 2px,transparent 2.7px),
radial-gradient(circle at calc(100% - 10px) calc(100% - 10px),rgba(255,255,255,.22) 2px,transparent 2.7px)}

`,
  },
  candlelit: {
    name: "Jewish goblin",
    blurb: "Candlelit indigo, brass and pomegranate. Papercut scallops, a magen david, a scroll and a menorah in the headings, a row of teeth under the top bar, and pills that sit a little crooked — because goblins.",
    dot: "#e0a63c",
    vars: {
      ink: "#12152b", pan: "#1c2040", pan2: "#262b52", line: "#3b4278", line2: "#2e3460",
      tx: "#f6ecd8", mut: "#a9a0cc", steel: "#8079ad",
      brass: "#e0a63c", onbrass: "#221704", crim: "#c33c55", verd: "#71a45c", vio: "#9b7fd6",
      rad: "13px", radsm: "9px", pillrad: "999px", bd: "1px",
      font: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
      fontd: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif',
      trackd: ".015em", h3size: "13.5px",
      btnshadow: "none", cardshadow: "0 2px 18px rgba(0,0,0,.3)",
      statshadow: "inset 0 1px 0 rgba(255,255,255,.05)", askshadow: "0 4px 20px rgba(224,166,60,.38)",
      topbg: "linear-gradient(180deg,#1a1e3c,#151833f2)",
      hpbg: "#2a1a2a", hpfill: "linear-gradient(90deg,#8c2438,#c33c55 55%,#e0a63c)",
      pillon: "#3a2c18", bubcl: "#2a2447",
      danbg: "#3c1c28", danbd: "#6b3145", dantx: "#f0b3c1",
      gdbg: "#1d3524", gdbd: "#3c6141", gdtx: "#b3dcb5",
      scrim: "rgba(8,9,20,.88)",
      rkt: "#2b3a5e", rktx: "#a8c2f0", rke: "#2c4433", rkex: "#a9dab0",
      rkm: "#463619", rkmx: "#efc781", rkl: "#3d2b52", rklx: "#d3adf2",
      diebg: "linear-gradient(180deg,#2c3160,#212549)", diebd: "#e0a63c", dierad: "20px",
      dieshadow: "0 0 30px rgba(224,166,60,.34),inset 0 1px 0 rgba(255,255,255,.1)",
      diceScrim: "rgba(8,9,20,.82)",
      bgimg: "radial-gradient(900px 460px at 50% -180px,rgba(224,166,60,.20),transparent 72%)",
    },
    extra: `
.pf .card{border-top:2px solid rgba(224,166,60,.45)}
.pf .card h3:after{content:"";display:block;height:7px;margin-top:7px;opacity:.6;
background-image:radial-gradient(circle at 6px 7px,var(--brass) 4.5px,transparent 5.5px);
background-size:13px 13px;background-repeat:repeat-x}
.pf .pill{transform:rotate(-.8deg)}
.pf .pill:nth-of-type(even){transform:rotate(.9deg)}
.pf .pill:hover{transform:rotate(0deg)}
.pf .body-serif,.pf .sm,.pf .xs{letter-spacing:.005em}
.pf .stat{background:linear-gradient(180deg,#2a2f59,#232750)}
.pf .hpnum{text-shadow:0 0 22px rgba(224,166,60,.35)}
.pf .btn.pri{box-shadow:0 0 16px rgba(224,166,60,.3)}

/* --- papercut + goblin iconography (original drawings) --- */
.pf .card h3[data-icon]:before,.pf .hpnum:before,.pf .askbtn:before{
content:"";display:inline-block;background-repeat:no-repeat;background-position:center;
background-size:contain;flex:none}
.pf .card h3[data-icon]:before{width:16px;height:16px;margin-right:8px;vertical-align:-3px}
.pf .hpnum:before{width:28px;height:28px;margin-right:11px;vertical-align:-1px}
.pf .askbtn:before{width:17px;height:17px;margin-right:8px;vertical-align:-4px}
.pf h3[data-icon="coin"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='7' fill='%23e0a63c'/><circle cx='8' cy='8' r='4.6' fill='none' stroke='%23221704' stroke-width='1.1'/><path d='M8 4.4v7.2' stroke='%23221704' stroke-width='1.1'/></svg>")}
.pf h3[data-icon="heart"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 3.2c3 0 5.1 2.3 5.1 5.3S11 15 8 15 2.9 11.5 2.9 8.5 5 3.2 8 3.2z' fill='%23c33c55'/><path d='M8 3.2V1.2M6.3 2.1L8 3.5l1.7-1.4' fill='none' stroke='%23e0a63c' stroke-width='1.2' stroke-linecap='round'/><circle cx='6.3' cy='8.2' r='.85' fill='%23f6c8d1'/><circle cx='9.4' cy='9.6' r='.85' fill='%23f6c8d1'/></svg>")}
.pf h3[data-icon="star"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.5l5.7 9.9H2.3z' fill='none' stroke='%23e0a63c' stroke-width='1.35' stroke-linejoin='round'/><path d='M8 14.5L2.3 4.6h11.4z' fill='none' stroke='%23e0a63c' stroke-width='1.35' stroke-linejoin='round'/></svg>")}
.pf h3[data-icon="flag"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M3.4 1.4v13.2' stroke='%23a9a0cc' stroke-width='1.4' stroke-linecap='round'/><path d='M4.6 2.4h8.2l-1.9 2.6 1.9 2.6H4.6z' fill='%23c33c55'/></svg>")}
.pf h3[data-icon="shield"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.1l5.9 2v4.8c0 4-2.9 6.4-5.9 7-3-.6-5.9-3-5.9-7V3.1z' fill='%233b4278' stroke='%23e0a63c' stroke-width='1'/><path d='M8 5.2c1.1 1.2 1.7 2.1 1.7 3.1a1.7 1.7 0 1 1-3.4 0c0-1 .6-1.9 1.7-3.1z' fill='%23e0a63c'/></svg>")}
.pf h3[data-icon="fire"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><g fill='%23e0a63c'><path d='M3.2 7.2c0-1.4.9-2.1.9-3.3.8.9 1.1 2 1.1 3.3a1 1 0 0 1-2 0z'/><path d='M7 6.2c0-1.5 1-2.4 1-3.7.9 1 1.2 2.2 1.2 3.7a1.1 1.1 0 0 1-2.2 0z'/><path d='M10.9 7.2c0-1.4.9-2.1.9-3.3.8.9 1.1 2 1.1 3.3a1 1 0 0 1-2 0z'/></g><path d='M4.1 8.4v3.4M8 7.4v4.4M11.9 8.4v3.4M2.4 12.4h11.2' stroke='%23a9a0cc' stroke-width='1.2' stroke-linecap='round'/></svg>")}
.pf h3[data-icon="book"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M2.4 2.2h8.4a2.4 2.4 0 0 1 2.4 2.4v9.2H4.8a2.4 2.4 0 0 1-2.4-2.4z' fill='%233b4278' stroke='%23e0a63c' stroke-width='1'/><path d='M5.2 5.4h5M5.2 7.6h5M5.2 9.8h3.2' stroke='%23a9a0cc' stroke-width='1' stroke-linecap='round'/></svg>")}
.pf h3[data-icon="gem"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4.4 2.6h7.2l3 4-6.6 7.2L1.4 6.6z' fill='%237fd4d0' stroke='%23e0a63c' stroke-width='.9' stroke-linejoin='round'/><path d='M4.4 2.6L8 13.8l3.6-11.2M1.4 6.6h13.2' fill='none' stroke='%23234f52' stroke-width='.8' opacity='.6'/></svg>")}
.pf h3[data-icon="bomb"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 5.4c3 0 5.2 2.1 5.2 4.8S11 15 8 15s-5.2-2.1-5.2-4.8S5 5.4 8 5.4z' fill='%232e3460' stroke='%23e0a63c' stroke-width='.9'/><path d='M6.6 5.5V4.2h2.8v1.3' fill='%238079ad'/><path d='M9.6 4.1c1.4-.6 2.3-1.3 2.4-2.6' fill='none' stroke='%23a9a0cc' stroke-width='1' stroke-linecap='round'/><circle cx='12.4' cy='1.3' r='1.2' fill='%23e0a63c'/><path d='M5.4 9.1l1.3 1.4-1 1.5' fill='none' stroke='%23c33c55' stroke-width='.9'/></svg>")}
.pf h3[data-icon="box"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M2.4 6.4h11.2v7.8H2.4z' fill='%233b4278' stroke='%23e0a63c' stroke-width='.9'/><path d='M1.6 6.6l.5-2.9 12-.9.4 3z' fill='%232e3460' stroke='%23e0a63c' stroke-width='.9' stroke-linejoin='round'/><path d='M8 6.6v7.6' stroke='%23e0a63c' stroke-width='.9' opacity='.65'/><circle cx='10.6' cy='9.8' r='1' fill='%23e0a63c'/></svg>")}
.pf h3[data-icon="scroll"]:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M4.2 2.6h7.6v10.8H4.2z' fill='%23f6ecd8'/><path d='M6.2 5.4h3.6M6.2 7.4h3.6M6.2 9.4h2.4' stroke='%238079ad' stroke-width='.9' stroke-linecap='round'/><g fill='%23e0a63c'><path d='M2.6 1.6h2.6v12.8H2.6z' rx='1'/><path d='M10.8 1.6h2.6v12.8h-2.6z'/></g><circle cx='3.9' cy='1.2' r='1.1' fill='%23e0a63c'/><circle cx='12.1' cy='1.2' r='1.1' fill='%23e0a63c'/><circle cx='3.9' cy='14.8' r='1.1' fill='%23e0a63c'/><circle cx='12.1' cy='14.8' r='1.1' fill='%23e0a63c'/></svg>")}
.pf .hpnum:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 3.2c3 0 5.1 2.3 5.1 5.3S11 15 8 15 2.9 11.5 2.9 8.5 5 3.2 8 3.2z' fill='%23c33c55'/><path d='M8 3.2V1.2M6.3 2.1L8 3.5l1.7-1.4' fill='none' stroke='%23e0a63c' stroke-width='1.2' stroke-linecap='round'/><circle cx='6.3' cy='8.2' r='.85' fill='%23f6c8d1'/><circle cx='9.4' cy='9.6' r='.85' fill='%23f6c8d1'/></svg>")}
.pf .askbtn:before{background-image:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M2.2 9.2c0-1.7 2.1-3 4.7-3h2.6c2.6 0 4.3 1.1 4.3 2.6 0 1.8-2.3 3.2-5.2 3.2H6.4c-2.4 0-4.2-1.2-4.2-2.8z' fill='%23e0a63c'/><path d='M14.2 8.2c.9-.5 1.4-1.1 1.5-2' fill='none' stroke='%23e0a63c' stroke-width='.9'/><path d='M7.4 6.2c0-1.4.9-2.3.9-3.5.9.9 1.2 2.1 1.2 3.5z' fill='%23f6ecd8'/></svg>")}

/* a row of teeth along the bottom of the bar, because goblins */
.pf .top{position:relative}
.pf .top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:6px;pointer-events:none;
background-image:linear-gradient(45deg,var(--ink) 50%,transparent 50%),
linear-gradient(-45deg,var(--ink) 50%,transparent 50%);
background-size:11px 6px;background-repeat:repeat-x}
.pf .stat:nth-of-type(3n){transform:rotate(-.35deg)}
.pf .stat:nth-of-type(4n){transform:rotate(.3deg)}
.pf .modal h3,.pf .modal .mtitle{letter-spacing:.02em}

/* --- the dreidel (an original drawing) ---
   Rolls come up on a spinning top instead of a cube: the letter shows while
   it spins, the result when it topples over. */
/* 25px of bottom padding lands the number on the body face rather than
   halfway down the point. */
.pf .die{width:136px;height:168px;padding-bottom:25px;font-size:46px;color:#f6ecd8;
background:center/contain no-repeat url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 124'><rect x='43' y='2' width='14' height='20' rx='4' fill='%23e0a63c'/><rect x='36' y='18' width='28' height='7' rx='3' fill='%23c88c28'/><rect x='14' y='24' width='72' height='58' rx='9' fill='%232c3160' stroke='%23e0a63c' stroke-width='3'/><path d='M15 80h70l-33 38a3 3 0 0 1-4 0z' fill='%23262b52' stroke='%23e0a63c' stroke-width='3' stroke-linejoin='round'/><path d='M20 30h60' stroke='rgba(255,255,255,.16)' stroke-width='2' stroke-linecap='round'/></svg>");
border:none;border-radius:0;box-shadow:none;
filter:drop-shadow(0 0 20px rgba(224,166,60,.34))}
/* A spin read edge-on: the face squeezes to nothing and opens out again. */
/* The theme's serif has no Hebrew, so name faces that do rather than leaving
   the letters to whatever the browser reaches for. */
.pf .die[data-phase="rolling"]{animation:dreidelspin .62s linear;
font-family:"Arial Hebrew","Adobe Hebrew","Noto Sans Hebrew","Times New Roman",serif}
@keyframes dreidelspin{
0%{transform:translateY(-130px) rotate(-12deg) scaleX(1)}
18%{transform:translateY(0) rotate(5deg) scaleX(.14)}
36%{transform:translateY(0) rotate(-5deg) scaleX(1)}
54%{transform:translateY(0) rotate(5deg) scaleX(.14)}
72%{transform:translateY(0) rotate(-4deg) scaleX(1)}
88%{transform:translateY(0) rotate(3deg) scaleX(.3)}
100%{transform:translateY(0) rotate(0deg) scaleX(1)}}
/* It doesn't stop dead; it wobbles down onto a face. */
.pf .die[data-phase="land"],.pf .die[data-phase="crit"]{animation:dreidelsettle .5s ease-out}
@keyframes dreidelsettle{0%{transform:rotate(-11deg)}30%{transform:rotate(8deg)}
55%{transform:rotate(-5deg)}78%{transform:rotate(3deg)}100%{transform:rotate(0deg)}}
.pf .die[data-phase="crit"]{filter:drop-shadow(0 0 26px rgba(113,164,92,.7))}
.pf .die[data-phase="fumble"]{filter:drop-shadow(0 0 24px rgba(195,60,85,.7))}

/* gimel: the pot pays out. */
.pf .coinpop{display:flex;gap:18px;height:17px;margin-top:4px}
.pf .coinpop i{width:17px;height:17px;opacity:0;background:center/contain no-repeat
url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><circle cx='8' cy='8' r='7.2' fill='%23e0a63c'/><circle cx='8' cy='8' r='5.4' fill='none' stroke='%23221704' stroke-width='.8' opacity='.5'/><path d='M8 4.2l3.3 5.7H4.7z' fill='none' stroke='%23221704' stroke-width='1' stroke-linejoin='round'/><path d='M8 11.8L4.7 6.1h6.6z' fill='none' stroke='%23221704' stroke-width='1' stroke-linejoin='round'/></svg>");
animation:gelt .95s ease-out forwards}
.pf .coinpop i:nth-child(2){animation-delay:.11s}
.pf .coinpop i:nth-child(3){animation-delay:.22s}
@keyframes gelt{0%{transform:translateY(0) rotate(0);opacity:0}
20%{opacity:1}100%{transform:translateY(-70px) rotate(220deg);opacity:0}}
@media (prefers-reduced-motion:reduce){.pf .coinpop i{animation:none !important}}
`,
  },
  slate: {
    name: "Slate",
    blurb: "Near-black glass, one cold accent, hairline rules. Quiet enough for a dim room, and it looks like it came from somewhere further along.",
    dot: "#5fd8ff",
    vars: {
      ink: "#07090e", pan: "#0d1118", pan2: "#141a24", line: "#222c3a", line2: "#19212c",
      tx: "#e8eef7", mut: "#8595aa", steel: "#5a6b82",
      brass: "#5fd8ff", onbrass: "#04141d", crim: "#ff5f6e", verd: "#3ddc97", vio: "#a689ff",
      rad: "14px", radsm: "10px", pillrad: "999px", bd: "1px",
      font: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      fontd: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
      trackd: ".02em", h3size: "10.5px",
      btnshadow: "none",
      cardshadow: "inset 0 1px 0 rgba(255,255,255,.045),0 10px 34px rgba(0,0,0,.5)",
      statshadow: "inset 0 1px 0 rgba(255,255,255,.05)",
      askshadow: "0 0 0 1px rgba(95,216,255,.35),0 6px 26px rgba(95,216,255,.26)",
      topbg: "linear-gradient(180deg,rgba(10,13,19,.94),rgba(10,13,19,.74))",
      hpbg: "#1d1014", hpfill: "linear-gradient(90deg,#7a2530,#ff5f6e)",
      pillon: "rgba(95,216,255,.12)", bubcl: "#16202c",
      danbg: "#2a1418", danbd: "#57262d", dantx: "#ffb4bb",
      gdbg: "#0f2a24", gdbd: "#235145", gdtx: "#8ee9c4",
      scrim: "rgba(5,7,11,.94)",
      rkt: "#17303f", rktx: "#8fd3f2", rke: "#15302a", rkex: "#8ce0be",
      rkm: "#2e2a17", rkmx: "#e6d68e", rkl: "#2a2140", rklx: "#c0a9f5",
      diebg: "linear-gradient(180deg,#18212e,#0d141d)", diebd: "#5fd8ff", dierad: "12px",
      dieshadow: "0 0 0 1px rgba(95,216,255,.18),0 0 46px rgba(95,216,255,.22),inset 0 1px 0 rgba(255,255,255,.08)",
      diceScrim: "rgba(5,7,11,.9)",
      bgimg: "linear-gradient(rgba(95,216,255,.028) 1px,transparent 1px)," +
        "linear-gradient(90deg,rgba(95,216,255,.028) 1px,transparent 1px)," +
        "radial-gradient(1100px 520px at 50% -230px,rgba(95,216,255,.13),transparent 70%)",
    },
    extra: `
/* A 44px survey grid under everything, faint enough to read as texture. */
.pf{background-size:44px 44px,44px 44px,100% 100%}

/* Headings behave like instrument labels: small, tracked, with a hairline
   running out to the edge of the card. */
.pf .card h3{display:flex;align-items:center;gap:10px;margin-bottom:11px;
text-transform:uppercase;letter-spacing:.19em;font-weight:700}
.pf .card h3:after{content:"";flex:1;height:1px;
background:linear-gradient(90deg,rgba(95,216,255,.4),transparent)}

/* Glass panels lit from one source above, hairline edges, no heavy chrome. */
.pf .card{background:linear-gradient(180deg,rgba(22,29,40,.88),rgba(13,17,24,.88));
backdrop-filter:blur(7px)}
.pf .top{border-bottom:none;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.pf .top:after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;pointer-events:none;
background:linear-gradient(90deg,transparent,rgba(95,216,255,.65),transparent)}
.pf .log{background:linear-gradient(180deg,rgba(16,21,29,.96),rgba(10,13,19,.98));
backdrop-filter:blur(10px);border-top-color:rgba(95,216,255,.22)}

/* The live tab is a lit segment rather than a raised button. */
.pf .tab{text-transform:uppercase;letter-spacing:.1em;font-size:11.5px}
.pf .tab.on{background:rgba(95,216,255,.1);border-color:rgba(95,216,255,.32);color:var(--brass)}

/* Numbers are the whole point of the sheet, so they get the light. */
.pf .stat{position:relative;overflow:hidden;
background:linear-gradient(180deg,rgba(25,33,45,.9),rgba(15,20,28,.9))}
.pf .stat:after{content:"";position:absolute;left:0;right:0;top:0;height:1px;
background:linear-gradient(90deg,transparent,rgba(95,216,255,.32),transparent)}
.pf .stat .l{text-transform:uppercase;letter-spacing:.11em;font-size:9.5px}
.pf .hpnum{text-shadow:0 0 30px rgba(95,216,255,.22)}

/* The accent only appears where something is live. */
.pf .btn{background:rgba(255,255,255,.03)}
.pf .btn:hover,.pf .mapb:hover{border-color:var(--brass);box-shadow:0 0 0 1px rgba(95,216,255,.22)}
.pf .btn.pri{background:linear-gradient(180deg,#74e2ff,#3ac6ef);border-color:#74e2ff;
box-shadow:0 6px 22px rgba(95,216,255,.3)}
.pf .pill.on{box-shadow:0 0 0 1px rgba(95,216,255,.22)}
.pf .dot.done{box-shadow:0 0 10px rgba(61,220,151,.55)}
/* The default cut-out ring reads as a hard black outline against ink this
   dark, so the floating button gets a halo instead. */
.pf .askbtn{box-shadow:0 0 0 1px rgba(95,216,255,.45),0 10px 30px rgba(0,0,0,.75),0 0 36px rgba(95,216,255,.22)}

/* The die sits inside two tracking rings that widen while it's still moving. */
.pf .die{position:relative}
.pf .die:before,.pf .die:after{content:"";position:absolute;border-radius:26px;
border:1px solid rgba(95,216,255,.2);pointer-events:none}
.pf .die:before{inset:-12px}
.pf .die:after{inset:-24px;border-color:rgba(95,216,255,.1)}
.pf .die[data-phase="rolling"]:before{animation:ping .62s ease-out infinite}
.pf .die[data-phase="rolling"]:after{animation:ping .62s ease-out .14s infinite}
@keyframes ping{from{opacity:.55;transform:scale(.94)}to{opacity:.08;transform:scale(1.06)}}
@media (prefers-reduced-motion:reduce){.pf .die:before,.pf .die:after{animation:none !important}}
`,
  },
};

function themeCss(key) {
  const t = THEMES[key] || THEMES.slate;
  const vars = Object.entries(t.vars).map(([k, v]) => "--" + k + ":" + v).join(";");
  return ".pf{" + vars + "}" + BASE_CSS + t.extra;
}

const d = (n) => Math.floor(Math.random() * n) + 1;
const rollDice = (expr) => {
  const mm = /^(\d+)d(\d+)$/.exec(expr.trim());
  if (!mm) return { total: 0, rolls: [] };
  const rolls = []; let t = 0;
  for (let i = 0; i < +mm[1]; i++) { const r = d(+mm[2]); rolls.push(r); t += r; }
  return { total: t, rolls };
};
const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- homebrew ----------
   A second set of tables that sits behind the printed ones. Entries here are
   real game data: a homebrew weapon rolls through the same proficiency, potency
   and specialization math as a longsword. The registry is a plain module object
   so every picker reads it during render; App owns the copy that gets saved. */
const HB = { weapons: [], armors: [], shields: [], gear: [] };
const HB_EMPTY = () => ({ weapons: [], armors: [], shields: [], gear: [] });

const num = (v, d) => (v == null || v === "" || isNaN(+v) ? d : +v);
const cleanWeapon = (o) => ({
  n: String(o.n || o.name || "").trim(),
  c: ["unarmed", "simple", "martial", "advanced"].includes(o.c) ? o.c : "martial",
  d: /^\d*d\d+$/.test(String(o.d || "")) ? String(o.d) : "1d6",
  t: String(o.t || "B").slice(0, 12),
  tr: Array.isArray(o.tr) ? o.tr.map((x) => String(x)) : [],
  b: num(o.b, 1), p: num(o.p, 0), g: String(o.g || "homebrew"), r: !!o.r, hb: true,
});
const cleanArmor = (o) => ({
  n: String(o.n || o.name || "").trim(),
  c: ["unarmored", "light", "medium", "heavy"].includes(o.c) ? o.c : "medium",
  ac: num(o.ac, 0), dx: num(o.dx, 3), ck: num(o.ck, 0), sp: num(o.sp, 0),
  st: num(o.st, 0), b: num(o.b, 1), g: String(o.g || "homebrew"), hb: true,
});
const cleanShield = (o) => ({
  n: String(o.n || o.name || "").trim(),
  ac: num(o.ac, 2), hard: num(o.hard, 5), hp: num(o.hp, 20), bt: num(o.bt, 10),
  b: num(o.b, 1), hb: true,
});
const cleanGear = (o) => ({
  n: String(o.n || o.name || "").trim(), b: num(o.b, 0.1), p: num(o.p, 0),
  note: String(o.note || ""), hb: true,
});

const hbSanitize = (raw) => {
  const r = raw || {};
  const keep = (arr, fn) => (Array.isArray(arr) ? arr.map(fn).filter((x) => x.n) : []);
  return {
    weapons: keep(r.weapons, cleanWeapon), armors: keep(r.armors, cleanArmor),
    shields: keep(r.shields, cleanShield), gear: keep(r.gear, cleanGear),
  };
};
const hbLoadRegistry = (hb) => {
  const x = hbSanitize(hb);
  HB.weapons = x.weapons; HB.armors = x.armors; HB.shields = x.shields; HB.gear = x.gear;
  return x;
};
const hbCount = (hb) => (hb ? hb.weapons.length + hb.armors.length + hb.shields.length + hb.gear.length : 0);
// name wins over slot: re-adding "Chainsaw Sword" edits it rather than duplicating
const hbMerge = (a, b) => {
  const out = (a || []).slice();
  (b || []).forEach((e) => {
    const i = out.findIndex((x) => String(x.n).toLowerCase() === String(e.n).toLowerCase());
    if (i >= 0) out[i] = e; else out.push(e);
  });
  return out;
};
const hbUnion = (a, b) => ({
  weapons: hbMerge(a.weapons, b.weapons), armors: hbMerge(a.armors, b.armors),
  shields: hbMerge(a.shields, b.shields), gear: hbMerge(a.gear, b.gear),
});

/* A library entry that shares a printed entry's name REPLACES it in place
   rather than sitting beside it, so correcting the longsword's die corrects
   the longsword instead of creating a second one. */
const lc = (x) => String(x == null ? "" : x).toLowerCase();
const overlay = (core, extra, nameOf) => {
  if (!extra.length) return core;
  const by = new Map(extra.map((e) => [lc(e.n), e]));
  const seen = new Set(core.map((e) => lc(nameOf ? nameOf(e) : e.n)));
  const patched = core.map((e) => by.get(lc(nameOf ? nameOf(e) : e.n)) || e);
  return patched.concat(extra.filter((e) => !seen.has(lc(e.n))));
};

const CORE_NAMES = {
  weapons: new Set(WEAPONS.map((w) => lc(w.n))),
  armors: new Set(ARMORS.map((a) => lc(a.n))),
  shields: new Set(SHIELDS.map((x) => lc(x.n))),
  gear: new Set(GEAR.map(([n]) => lc(n))),
};
const isCoreName = (kind, n) => CORE_NAMES[kind].has(lc(n));

const allWeapons = () => overlay(WEAPONS, HB.weapons);
const allArmors = () => overlay(ARMORS, HB.armors);
const allShields = () => overlay(SHIELDS, HB.shields);
const allGear = () => {
  if (!HB.gear.length) return GEAR;
  const asRows = HB.gear.map((g) => ({ n: g.n, row: [g.n, g.b, g.p] }));
  const by = new Map(asRows.map((x) => [lc(x.n), x.row]));
  const seen = new Set(GEAR.map(([n]) => lc(n)));
  return GEAR.map(([n, b, pr]) => by.get(lc(n)) || [n, b, pr])
    .concat(asRows.filter((x) => !seen.has(lc(x.n))).map((x) => x.row));
};

/* ---------- talking to Claude ----------
   Inside a Claude artifact the platform attaches auth to this call and bills it
   to whoever is using the app, so no key is involved. Running anywhere else
   there are two ways through: a proxy URL baked in at build time (the key stays
   on a server, which is what you want if other people use your copy), or a key
   the player pastes in, kept in this browser only. */
const KEY_LS = "pf2e:anthropic_key";
const PROXY = (typeof window !== "undefined" && window.PF2E_API_PROXY) || "";
const STANDALONE = typeof window !== "undefined" && !!window.PF2E_STANDALONE;

const apiKey = {
  get() { try { return localStorage.getItem(KEY_LS) || ""; } catch { return ""; } },
  set(v) { try { v ? localStorage.setItem(KEY_LS, v) : localStorage.removeItem(KEY_LS); } catch { /* private mode */ } },
};
// inside the artifact nothing is needed; standalone needs a proxy or a key
const apiReady = () => !STANDALONE || !!PROXY || !!apiKey.get();

async function callClaude(body) {
  const key = STANDALONE ? apiKey.get() : "";
  const headers = { "Content-Type": "application/json" };
  if (key && !PROXY) {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    headers["anthropic-dangerous-direct-browser-access"] = "true";
  }
  return fetch(PROXY || "https://api.anthropic.com/v1/messages", {
    method: "POST", headers, body: JSON.stringify(body),
  });
}

// ================= storage =================
/* One key per character instead of one blob for everything, so two devices
   editing two different characters can never overwrite each other. Each record
   carries a rev counter: before writing we check the stored rev against the one
   we last read, and a higher number means another device got there first. */
const LEGACY_KEY = "pf2e_sheet_v1";
const IDX_KEY = "pf2e:index";
const HB_KEY = "pf2e:homebrew";
const charKey = (id) => "pf2e:char:" + id;

const sget = async (k) => {
  try { const r = await window.storage.get(k); return r && r.value ? JSON.parse(r.value) : null; }
  catch { return null; }
};
const sset = async (k, v) => {
  try { return !!(await window.storage.set(k, JSON.stringify(v))); } catch { return false; }
};
const sdel = async (k) => { try { await window.storage.delete(k); } catch { /* already gone */ } };

const store = {
  // -> { chars, meta, revs } or null
  async load() {
    const idx = await sget(IDX_KEY);
    if (!idx) return store.migrate();
    const ids = idx.ids || [];
    const recs = await Promise.all(ids.map((id) => sget(charKey(id))));
    const chars = []; const revs = {};
    recs.forEach((r, i) => {
      if (!r || !r.char) return;
      chars.push(r.char); revs[r.char.id] = r.rev || 1;
    });
    return { chars, meta: idx, revs };
  },

  // one-time split of the old single-blob key into per-character records
  async migrate() {
    const old = await sget(LEGACY_KEY);
    if (!old || !old.chars || !old.chars.length) return null;
    const revs = {};
    for (const ch of old.chars) {
      await sset(charKey(ch.id), { char: ch, rev: 1, updatedAt: Date.now() });
      revs[ch.id] = 1;
    }
    await sset(IDX_KEY, {
      ids: old.chars.map((x) => x.id), activeId: old.activeId,
      theme: old.theme, animate: old.animate, v: 4,
    });
    return { chars: old.chars, meta: old, revs };
  },

  // knownRev is the rev we last read or wrote for this character
  async saveChar(ch, knownRev) {
    const cur = await sget(charKey(ch.id));
    if (cur && (cur.rev || 1) > (knownRev || 0)) return { ok: false, conflict: true, remote: cur };
    const rev = (knownRev || 0) + 1;
    const ok = await sset(charKey(ch.id), { char: ch, rev, updatedAt: Date.now() });
    return { ok, rev };
  },

  async saveIndex(meta) { return sset(IDX_KEY, { ...meta, v: 4 }); },

  async loadHb() {
    const r = await sget(HB_KEY);
    return r && r.hb ? { hb: hbSanitize(r.hb), rev: r.rev || 1 } : null;
  },
  /* Homebrew is additive, so a race doesn't need a prompt: if another device
     wrote first, fold both libraries together and keep going. */
  async saveHb(hb, knownRev) {
    const cur = await sget(HB_KEY);
    const curRev = cur ? cur.rev || 1 : 0;
    const merged = cur && curRev > (knownRev || 0) ? hbUnion(hbSanitize(cur.hb), hb) : hb;
    const rev = Math.max(curRev, knownRev || 0) + 1;
    const ok = await sset(HB_KEY, { hb: merged, rev, updatedAt: Date.now() });
    return { ok, rev, hb: merged, mergedWithRemote: merged !== hb };
  },
  async removeChar(id) { await sdel(charKey(id)); },
};

const IMPORTED_CHARS = [
 {
  "id": "c_goomberg",
  "name": "Danny \"Grout\" Goomberg",
  "player": "",
  "level": 6,
  "xp": 0,
  "ancestry": "kobold",
  "heritage": "Mightyfall Kobold",
  "ancFree": [
   "int"
  ],
  "ancFlawFree": "",
  "background": "custom",
  "bgPick": "",
  "bgFree": [
   "int",
   "str"
  ],
  "cls": "gunslinger",
  "subclass": "Way of the Vanguard",
  "keyAbility": "dex",
  "l1Free": [
   "str",
   "dex",
   "int",
   "wis"
  ],
  "boosts": {
   "5": [
    "str",
    "dex",
    "int",
    "wis"
   ],
   "10": [],
   "15": [],
   "20": []
  },
  "trainedSkills": [
   "acrobatics",
   "athletics",
   "crafting",
   "diplomacy",
   "intimidation",
   "occultism",
   "society",
   "survival"
  ],
  "skillIncreases": {},
  "lores": [
   {
    "name": "Engineering",
    "rank": 1
   }
  ],
  "feats": [
   {
    "id": "fcjz0n5",
    "name": "Scamper",
    "type": "ancestry",
    "level": 1,
    "note": "Move through a larger creature's space."
   },
   {
    "id": "f87ea3w",
    "name": "Quick Draw",
    "type": "class",
    "level": 1,
    "note": "Draw a weapon and Strike with it in one action."
   },
   {
    "id": "fe4ttdh",
    "name": "Psychic Dedication",
    "type": "class",
    "level": 2,
    "note": "Occult dedication: cantrips and a small psychic spell pool."
   },
   {
    "id": "fjii28d",
    "name": "Risky Reload",
    "type": "class",
    "level": 3,
    "note": "Reload and Strike in one action, at the risk of jamming."
   },
   {
    "id": "fpnxtm8",
    "name": "Basic Psychic Spellcasting",
    "type": "class",
    "level": 4,
    "note": "Adds low-rank spell slots to the dedication."
   },
   {
    "id": "fhzjwzz",
    "name": "Phalanx Breaker",
    "type": "class",
    "level": 5,
    "note": "2 actions: ranged Strike that shoves the target 10 ft. back, 20 on a crit; extra bludgeoning if it hits an obstacle."
   },
   {
    "id": "fdym17q",
    "name": "Psi Development",
    "type": "class",
    "level": 6,
    "note": "Another psychic cantrip or amp from the archetype."
   },
   {
    "id": "f12rhol",
    "name": "Risky Surgery",
    "type": "skill",
    "level": 1,
    "note": "Treat Wounds with a knife: extra damage first, better healing on success."
   },
   {
    "id": "fjo0tx9",
    "name": "Quick Squeeze",
    "type": "skill",
    "level": 2,
    "note": "Squeeze through tight spaces much faster."
   },
   {
    "id": "fhsfuxu",
    "name": "Prescient Planner",
    "type": "skill",
    "level": 3,
    "note": "Retroactively pull a useful piece of gear out of your pack."
   },
   {
    "id": "famqvf4",
    "name": "Crafter's Appraisal",
    "type": "skill",
    "level": 4,
    "note": "Use Crafting to identify magic items."
   },
   {
    "id": "ftd6doo",
    "name": "Winglets",
    "type": "skill",
    "level": 5,
    "note": "Kobold wings: better long jumps and falls."
   },
   {
    "id": "ffzfi3u",
    "name": "Exhort the Faithful",
    "type": "skill",
    "level": 6,
    "note": "Religion in place of Diplomacy on co-religionists."
   },
   {
    "id": "fnpybnl",
    "name": "Gunslinger's Way — Vanguard",
    "type": "class",
    "level": 1,
    "note": "Way of the Vanguard: your slinger's reload and precision deed."
   },
   {
    "id": "fmqul12",
    "name": "Cover Fire",
    "type": "class",
    "level": 1,
    "note": "1 action: the target either ducks for AC and takes a penalty to ranged attacks, or holds still and you get +1 to hit."
   },
   {
    "id": "fz8mcyw",
    "name": "Clear a Path",
    "type": "class",
    "level": 1,
    "note": "1 action: Shove with a two-handed firearm — no free hand needed — then reload. Uses your current multiple attack penalty."
   },
   {
    "id": "fmd6bp9",
    "name": "Living Fortification",
    "type": "class",
    "level": 1,
    "note": "Reaction on initiative: draw a firearm or crossbow and brace, +1 AC (+2 with parry) until the end of your first turn."
   },
   {
    "id": "fhgntco",
    "name": "Slinger's Precision",
    "type": "class",
    "level": 1,
    "note": "Vanguard precision damage on your firearm Strikes."
   },
   {
    "id": "f3iaret",
    "name": "Darkvision",
    "type": "ancestry",
    "level": 1,
    "note": "See in darkness."
   }
  ],
  "profOverride": {
   "perception": 2,
   "fortitude": 2,
   "reflex": 2,
   "will": 2,
   "simple": 3,
   "martial": 3,
   "unarmed": 2,
   "classDC": 1,
   "spell": 1,
   "skill:medicine": 2,
   "skill:religion": 2
  },
  "weapons": [
   {
    "id": "w1",
    "base": "Dueling Pistol",
    "name": "Dueling Pistol",
    "cat": "martial",
    "die": "1d6",
    "dmgType": "P",
    "traits": [
     "concealable",
     "concussive",
     "fatal d10",
     "range 60 ft.",
     "reload 1",
     "uncommon"
    ],
    "ranged": true,
    "potency": 0,
    "striking": 0,
    "extraDice": "1d4",
    "extraNote": "precision"
   },
   {
    "id": "w2",
    "base": "",
    "name": "Goomberg Gun",
    "cat": "martial",
    "die": "1d10",
    "dmgType": "B",
    "traits": [
     "range 150 ft.",
     "10-ft. burst",
     "30 ft. minimum",
     "aim",
     "launch"
    ],
    "ranged": true,
    "potency": 0,
    "striking": 0,
    "extraDice": "1d4",
    "extraNote": "precision"
   }
  ],
  "items": [
   {
    "id": "i1",
    "name": "Net Launcher",
    "bulk": 1,
    "price": 8,
    "qty": 1
   },
   {
    "id": "i2",
    "name": "Air Bladder",
    "bulk": 0.1,
    "price": 0.1,
    "qty": 1
   },
   {
    "id": "i3",
    "name": "Camouflage Suit",
    "bulk": 0.1,
    "price": 0,
    "qty": 1
   }
  ],
  "armor": "Elven Chain",
  "shield": "No shield",
  "armorPotency": 0,
  "armorResilient": 0,
  "shieldRaised": false,
  "shieldHP": 0,
  "coins": {
   "pp": 0,
   "gp": 100015,
   "sp": 0,
   "cp": 0
  },
  "spellAbility": "int",
  "spellTradition": "occult",
  "spellsKnown": [
   {
    "name": "Inkshot",
    "rank": 1,
    "note": "2 actions, occult"
   },
   {
    "name": "Phantasmal Treasure",
    "rank": 2,
    "note": "2 actions, occult"
   },
   {
    "name": "Figment",
    "rank": 0,
    "note": "Focus spell (archetype), 2 actions"
   },
   {
    "name": "Shield",
    "rank": 0,
    "note": "Focus spell (archetype), 1 action"
   }
  ],
  "slotsUsed": {},
  "focusCur": 1,
  "focusMax": 1,
  "hpBonus": 4,
  "acAdjust": -1,
  "archetypeCasting": true,
  "customSlots": {
   "1": 1,
   "2": 1
  },
  "bgName": "Medicinal Clocksmith",
  "hp": null,
  "tempHp": 0,
  "dying": 0,
  "wounded": 0,
  "hero": 1,
  "conditions": {},
  "favorites": [
   "f87ea3w",
   "fhzjwzz",
   "fmqul12",
   "fz8mcyw",
   "fmd6bp9"
  ],
  "notes": "Imported from the Pathfinder character sheet PDF.\nSenses: darkvision. Languages: none selected.\nGoomberg Gun: 10-foot burst, 30 ft. minimum distance, DC 19 Reflex, 4d10 bludgeoning on the burst; Aim (2 actions), Launch (1 action), Load (2 actions ×2, DC 20 Athletics).",
  "createdAt": 1789303841327
 },
  {
    "id": "c_leviathan",
    "name": "Leviathan Hammer",
    "player": "",
    "level": 4,
    "xp": 0,
    "ancestry": "goblin",
    "heritage": "Razortooth Goblin",
    "ancFree": [
      "int"
    ],
    "ancFlawFree": "",
    "background": "custom",
    "bgName": "Toymaker",
    "bgPick": "",
    "bgFree": [
      "int",
      "str"
    ],
    "cls": "rogue",
    "subclass": "Thief",
    "keyAbility": "dex",
    "l1Free": [
      "str",
      "dex",
      "int",
      "wis"
    ],
    "boosts": {
      "5": [],
      "10": [],
      "15": [],
      "20": []
    },
    "trainedSkills": [
      "acrobatics",
      "athletics",
      "crafting",
      "deception",
      "diplomacy",
      "nature",
      "occultism",
      "performance",
      "society",
      "stealth",
      "survival",
      "thievery"
    ],
    "skillIncreases": {
      "2": "athletics",
      "3": "stealth",
      "4": "thievery"
    },
    "profOverride": {
      "martial": 1
    },
    "lores": [
      {
        "name": "Mercantile",
        "rank": 1
      }
    ],
    "feats": [
      {
        "id": "flh01",
        "name": "Fang Sharpener",
        "type": "ancestry",
        "level": 1,
        "note": ""
      },
      {
        "id": "flh02",
        "name": "Specialty Crafting",
        "type": "skill",
        "level": 1,
        "note": "+1 to Craft your chosen specialty, +2 once you're an expert."
      },
      {
        "id": "flh03",
        "name": "Dirty Trick",
        "type": "skill",
        "level": 1,
        "note": "Thievery against the target's Reflex DC to leave them clumsy 1. Fall prone on a critical failure."
      },
      {
        "id": "flh04",
        "name": "Unbalancing Blow",
        "type": "class",
        "level": 2,
        "note": ""
      },
      {
        "id": "flh05",
        "name": "Tumble Behind",
        "type": "class",
        "level": 1,
        "note": ""
      },
      {
        "id": "flh06",
        "name": "Lie to Me",
        "type": "skill",
        "level": 2,
        "note": "Use Deception to spot a lie being told to you."
      },
      {
        "id": "flh07",
        "name": "Prescient Planner",
        "type": "general",
        "level": 3,
        "note": "Retroactively pull a useful piece of gear out of your pack."
      },
      {
        "id": "flh08",
        "name": "Slippery Prey",
        "type": "skill",
        "level": 3,
        "note": ""
      },
      {
        "id": "flh09",
        "name": "Scoundrel's Surprise",
        "type": "class",
        "level": 4,
        "note": "Drop a disguise with a flourish: anyone it fooled is off-guard against your next attack this turn."
      },
      {
        "id": "flh10",
        "name": "Crafter's Appraisal",
        "type": "skill",
        "level": 4,
        "note": "Use Crafting to identify magic items."
      }
    ],
    "weapons": [
      {
        "id": "wlh1",
        "base": "Combat Grapnel",
        "name": "Combat Grapnel",
        "cat": "martial",
        "die": "1d6",
        "dmgType": "P",
        "traits": [
          "finesse",
          "grapple",
          "tethered",
          "thrown 20 ft.",
          "range 20 ft."
        ],
        "ranged": false,
        "potency": 0,
        "striking": 0
      },
      {
        "id": "wlh2",
        "base": "Stiletto Pen",
        "name": "Stiletto Pen",
        "cat": "simple",
        "die": "1d4",
        "dmgType": "P",
        "traits": [
          "agile",
          "concealable",
          "finesse",
          "thrown 10 ft.",
          "range 10 ft."
        ],
        "ranged": false,
        "potency": 0,
        "striking": 0
      },
      {
        "id": "wlh3",
        "base": "Lizardfolk Fangs",
        "name": "Lizardfolk Fangs",
        "cat": "unarmed",
        "die": "1d8",
        "dmgType": "P",
        "traits": [
          "unarmed"
        ],
        "ranged": false,
        "potency": 0,
        "striking": 0
      }
    ],
    "items": [
      {
        "id": "ilh1",
        "name": "Charlatan's Gloves",
        "bulk": 0.1,
        "price": 0,
        "qty": 1
      },
      {
        "id": "ilh2",
        "name": "Masquerade Scarf",
        "bulk": 0.1,
        "price": 0,
        "qty": 1
      },
      {
        "id": "ilh3",
        "name": "Handwraps of Mighty Blows (+1 striking)",
        "bulk": 0,
        "price": 0,
        "qty": 1
      },
      {
        "id": "ilh4",
        "name": "Spacious Pouch I",
        "bulk": 1,
        "price": 0,
        "qty": 1
      },
      {
        "id": "ilh5",
        "name": "Keymaking Tools",
        "bulk": 0.1,
        "price": 0,
        "qty": 1
      }
    ],
    "armor": "Leather Armor",
    "shield": "No shield",
    "armorPotency": 0,
    "armorResilient": 0,
    "shieldRaised": false,
    "shieldHP": 0,
    "coins": {
      "pp": 0,
      "gp": 2014,
      "sp": 0,
      "cp": 0
    },
    "spellAbility": null,
    "spellTradition": null,
    "spellsKnown": [],
    "slotsUsed": {},
    "focusCur": 0,
    "focusMax": 0,
    "hpBonus": 0,
    "acAdjust": 0,
    "archetypeCasting": false,
    "customSlots": null,
    "hp": null,
    "tempHp": 0,
    "dying": 0,
    "wounded": 0,
    "hero": 1,
    "conditions": {},
    "effects": [
      {
        "id": "fxlh1",
        "name": "+1 item bonus to Thievery",
        "type": "item",
        "rounds": null,
        "note": "the item column on the PDF",
        "b": {
          "skill:thievery": 1
        }
      }
    ],
    "favorites": [
      "flh03",
      "flh09"
    ],
    "notes": "Imported from the Pathfinder character sheet PDF, then audited against it field by field. Every number on page one \u2014 AC 20, 38 HP, Perception +8, Fort +6, Reflex +11, Will +8, class DC 19, all sixteen skills and Mercantile Lore +9 \u2014 comes out of this sheet's own math at the same value.\nFeats sit at the levels the PDF's level grid puts them: Tumble Behind at 1, Unbalancing Blow at 2, Scoundrel's Surprise at 4. Prescient Planner is in the level 3 general feat slot; Dirty Trick fills the rogue's own level 1 skill feat, since Specialty Crafting came free with Toymaker.\nExpert Athletics, Stealth and Thievery are the rogue's skill increases from levels 2, 3 and 4. The PDF doesn't record which level bought which, so they're in that order \u2014 reshuffle them on the Build tab if your notes disagree.\nClass features from the PDF, which aren't feats and so aren't listed on the Feats tab: Rogue's Racket (Thief), Sneak Attack, Surprise Attack.\nMartial weapons are set to trained as a proficiency override, because the Combat Grapnel is martial and the rogue's own list isn't \u2014 that's how the PDF has it.\nThe Handwraps of Mighty Blows are in your inventory but not applied: the PDF's own numbers for Lizardfolk Fangs don't include them either. Set the fangs to +1 potency and striking on the Gear tab to turn them on.\nSenses: darkvision. Languages: none selected. 2,014 gp, 3 Bulk carried.\nThe PDF reads the Combat Grapnel and Stiletto Pen as 1d6+3 and 1d4+3, using Dexterity for damage. Finesse only changes the attack roll, so this sheet uses Strength (+2). Add a +1 damage bonus to each weapon if your table plays it the other way.\nCombat Grapnel, Stiletto Pen and Lizardfolk Fangs aren't in the built-in weapon tables, so they carry their own stats. Ask Claude to add them as homebrew if you want them pickable for other characters.\nTwelve trained skills is one more than 7 + Intelligence gives a level 4 rogue, and the Toymaker background is entered as a custom one so it trains nothing on its own. Left as the PDF has it.",
    "createdAt": 0
  }
];

// ================= small pieces =================
const fxTag = (base, n) => (n ? (base ? base + " \u00b7 " : "") + sgn(n) + " temp" : base);

function Stat({ v, l, s, onClick }) {
  return (
    <button className="stat" onClick={onClick} style={{ width: "100%" }}>
      <div className="v">{v}</div><div className="l">{l}</div>{s ? <div className="s">{s}</div> : null}
    </button>
  );
}
function Rk({ r }) {
  const c = ["", "t", "e", "m", "l"][r] || "";
  return <span className={"rk " + c}>{RANKABBR[r]}</span>;
}
function Field({ label, children }) {
  return <label style={{ display: "block", marginBottom: 9 }}>
    <div className="xs mut" style={{ marginBottom: 3, fontWeight: 600 }}>{label}</div>{children}
  </label>;
}
const FX_PRESETS = [
  { name: "Bless", type: "status", rounds: 10, b: { atk: 1 }, note: "in the aura" },
  { name: "Inspire Courage", type: "status", rounds: 1, b: { atk: 1, dmg: 1 } },
  { name: "Heroism", type: "status", rounds: null, b: { atk: 1, per: 1, saves: 1, skill: 1 } },
  { name: "Aid", type: "circumstance", rounds: 1, b: { atk: 1 } },
  { name: "Guidance", type: "status", rounds: 1, b: { atk: 1, skill: 1, per: 1 } },
  { name: "Longstrider", type: "status", rounds: null, b: { speed: 10 } },
  { name: "Mage Armor", type: "item", rounds: null, b: { ac: 1 } },
  { name: "Frightened 1 (untracked)", type: "status", rounds: 1, b: { atk: -1, ac: -1, saves: -1, skill: -1, per: -1 } },
];

const FX_TARGET_OPTS = [
  ["ac", "AC"], ["atk", "Attack rolls"], ["dmg", "Damage"], ["saves", "All saves"],
  ["fort", "Fortitude"], ["ref", "Reflex"], ["will", "Will"], ["per", "Perception"],
  ["skill", "All skills"], ["speed", "Speed (feet)"],
  ["classDC", "Class DC"], ["spellDC", "Spell DC"], ["spellAtk", "Spell attacks"],
];

const HB_SECTIONS = [
  ["weapons", "Weapons", (e) => e.c + " \u00b7 " + e.d + " " + e.t + (e.tr && e.tr.length ? " \u00b7 " + e.tr.join(", ") : "")],
  ["armors", "Armor", (e) => e.c + " \u00b7 +" + e.ac + " AC \u00b7 Dex cap " + e.dx + (e.ck ? " \u00b7 " + e.ck + " checks" : "")],
  ["shields", "Shields", (e) => "+" + e.ac + " AC \u00b7 hardness " + e.hard + " \u00b7 " + e.hp + " HP"],
  ["gear", "Gear", (e) => (e.b ? e.b + " Bulk" : "negligible") + (e.p ? " \u00b7 " + e.p + " gp" : "") + (e.note ? " \u00b7 " + e.note : "")],
];

const DICE = [4, 6, 8, 10, 12, 20, 100];
const DICE_PRESETS = [
  ["Flat check", { 20: 1 }, 0, "sum"],
  ["Recovery", { 20: 1 }, 0, "sum"],
  ["2d6", { 6: 2 }, 0, "sum"],
  ["Fortune d20", { 20: 2 }, 0, "high"],
  ["Misfortune d20", { 20: 2 }, 0, "low"],
  ["Percentile", { 100: 1 }, 0, "sum"],
];

function DiceTray({ onRoll, onClose }) {
  const [pool, setPool] = useState({});
  const [mod, setMod] = useState(0);
  const [mode, setMode] = useState("sum");
  const [label, setLabel] = useState("");

  const count = DICE.reduce((t, f) => t + (pool[f] || 0), 0);
  const bump = (f, by) => setPool((p) => ({ ...p, [f]: Math.max(0, Math.min(20, (p[f] || 0) + by)) }));

  /* iOS never fires contextmenu from a long press, so a right-click handler
     alone left phones with no way to undo an overshoot. */
  const hold = useRef({ timer: null, fired: false });
  const dieHandlers = (f) => ({
    onTouchStart: () => {
      hold.current.fired = false;
      hold.current.timer = setTimeout(() => {
        hold.current.fired = true;
        bump(f, -1);
        if (navigator.vibrate) navigator.vibrate(12);
      }, 450);
    },
    onTouchEnd: () => clearTimeout(hold.current.timer),
    onTouchMove: () => { clearTimeout(hold.current.timer); hold.current.fired = false; },
    onClick: () => {
      if (hold.current.fired) { hold.current.fired = false; return; }
      bump(f, 1);
    },
    onContextMenu: (e) => { e.preventDefault(); bump(f, -1); },
  });
  const expr = DICE.filter((f) => pool[f]).map((f) => pool[f] + "d" + f).join(" + ") || "nothing yet";

  const go = (pl, md, mo, name) => {
    onRoll(pl, md, mo, name || (DICE.filter((f) => pl[f]).map((f) => pl[f] + "d" + f).join(" + ")
      + (md ? " " + sgn(md) : "")));
    onClose();
  };

  return (
    <Modal title="Roll dice" onClose={onClose}>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {DICE_PRESETS.map(([n, pl, md, mo]) => (
          <button key={n} className="pill" style={{ margin: "0 5px 6px 0" }} onClick={() => go(pl, md, mo, n)}>{n}</button>
        ))}
      </div>
      <div className="line" />

      <div className="grid g4">
        {DICE.map((f) => (
          <button key={f} className={"stat" + (pool[f] ? " on" : "")} style={{ padding: "8px 4px" }}
            {...dieHandlers(f)}>
            <div className="v" style={{ fontSize: 18 }}>d{f}</div>
            <div className="l">{pool[f] ? pool[f] + " queued" : "tap to add"}</div>
          </button>
        ))}
      </div>
      <div className="mut xs" style={{ marginTop: 6 }}>Tap to add one, press and hold to take one back.</div>

      <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={() => setMod((m) => m - 1)}>−</button>
        <strong style={{ minWidth: 46, textAlign: "center" }}>{sgn(mod)}</strong>
        <button className="btn sm" onClick={() => setMod((m) => m + 1)}>+</button>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ flex: 1, minWidth: 150 }}>
          <option value="sum">add them all up</option>
          <option value="high">keep the highest (fortune)</option>
          <option value="low">keep the lowest (misfortune)</option>
        </select>
      </div>
      <input placeholder="What's it for? (optional)" value={label} style={{ width: "100%", marginTop: 8 }}
        onChange={(e) => setLabel(e.target.value)} />

      <div className="between" style={{ marginTop: 10 }}>
        <div className="mut sm">{expr}{mod ? " " + sgn(mod) : ""}</div>
        {count > 0 && <button className="btn sm" onClick={() => { setPool({}); setMod(0); }}>Clear</button>}
      </div>
      <button className="btn pri" style={{ width: "100%", marginTop: 8 }} disabled={!count}
        onClick={() => go(pool, mod, mode, label)}>
        Roll {count ? expr + (mod ? " " + sgn(mod) : "") : ""}
      </button>
    </Modal>
  );
}

function HomebrewModal({ hb, setHb, onClose }) {
  const [paste, setPaste] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const total = hbCount(hb);

  const drop = (key, n) => setHb({ ...hb, [key]: hb[key].filter((x) => x.n !== n) });
  const counts = HB_SECTIONS.reduce((t, [k]) => t + hb[k].filter((e) => isCoreName(k, e.n)).length, 0);

  return (
    <Modal title="Homebrew library" onClose={onClose}>
      <div className="mut sm" style={{ marginTop: 0 }}>
        Anything here behaves like printed content: a homebrew weapon runs through the same proficiency, potency and
        specialization math as a longsword, and shows up in every character's pickers marked with a ★.
      </div>

      {total === 0 && (
        <div className="empty" style={{ marginTop: 10 }}>
          Nothing yet. The quickest way in is Ask Claude, either to invent something ("my GM gave me a dwarven
          repeating crossbow, martial, 1d8 piercing, reload 1") or to correct something that's already wrong ("the
          kukri should be d6, not d4"). Corrections to printed entries land here too, as overrides you can undo.
        </div>
      )}

      {HB_SECTIONS.map(([key, label, line]) => (
        hb[key].length > 0 ? (
          <div key={key} style={{ marginTop: 12 }}>
            <div className="xs mut" style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
            {hb[key].map((e) => (
              <div className="between" key={e.n} style={{ padding: "7px 0", borderBottom: "1px solid #262d3a" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {e.n}{isCoreName(key, e.n) ? <span className="mut xs"> · edited from the printed entry</span> : null}
                  </div>
                  <div className="mut xs">{line(e)}</div>
                </div>
                <button className="btn sm dan" onClick={() => drop(key, e.n)}>
                  {isCoreName(key, e.n) ? "Restore" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        ) : null
      ))}

      <div className="line" />
      <div className="row" style={{ flexWrap: "wrap" }}>
        <button className="btn sm" disabled={!total} onClick={() => {
          navigator.clipboard.writeText(JSON.stringify({ homebrew: hb }));
          setCopied(true); setTimeout(() => setCopied(false), 1800);
        }}>{copied ? "Copied" : "Copy library"}</button>
        <span className="mut xs" style={{ alignSelf: "center" }}>Share it with the rest of the table.</span>
      </div>
      <div className="xs mut" style={{ marginTop: 10, marginBottom: 4, fontWeight: 600 }}>Paste someone else's library</div>
      <textarea rows={2} value={paste} placeholder="Paste it here" onChange={(e) => { setPaste(e.target.value); setErr(""); }} />
      {err && <div className="xs" style={{ color: "var(--crim)" }}>{err}</div>}
      <button className="btn sm" style={{ marginTop: 6 }} onClick={() => {
        try {
          const j = JSON.parse(paste);
          const incoming = hbSanitize(j.homebrew || j);
          if (!hbCount(incoming)) throw 0;
          setHb(hbUnion(hb, incoming));
          setPaste("");
        } catch { setErr("That doesn't look like a homebrew library."); }
      }}>Merge in</button>
      {total > 0 && (
        <div className="mut xs" style={{ marginTop: 10 }}>
          {counts > 0 ? "Entries marked as edited replace the printed ones by name — Restore puts the book's version back. " : ""}
          Removing an entry won't break a character carrying it: weapons keep their own copy of the stats once added.
          Armor is the exception, since it's a name reference — drop a suit someone is wearing and they fall back to
          unarmored.
        </div>
      )}
    </Modal>
  );
}

function EffectsModal({ c, setChar, onClose }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("atk");
  const [val, setVal] = useState("1");
  const [type, setType] = useState("status");
  const [rounds, setRounds] = useState("");

  const add = (e) => {
    setChar((cur) => ({ effects: [...(cur.effects || []), { ...e, id: uid() }] }));
    onClose();
  };

  return (
    <Modal title="Add a temporary effect" onClose={onClose}>
      <div className="mut sm" style={{ marginTop: 0 }}>
        Nothing here touches your saved numbers. While it runs your sheet shows the buffed value; when it ends or
        counts out, everything snaps back on its own.
      </div>
      <div className="line" />
      <div className="xs mut" style={{ fontWeight: 600, marginBottom: 6 }}>Common ones</div>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {FX_PRESETS.map((e) => (
          <button key={e.name} className="pill" style={{ margin: "0 5px 6px 0" }}
            onClick={() => add({ ...e, b: { ...e.b } })}
            title={fxLabel(e)}>{e.name}</button>
        ))}
      </div>
      <div className="line" />
      <div className="xs mut" style={{ fontWeight: 600, marginBottom: 6 }}>Or build one</div>
      <input placeholder="What is it? (Potion of Flying, GM's weird curse…)" value={name}
        onChange={(ev) => setName(ev.target.value)} style={{ width: "100%" }} />
      <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <input inputMode="numeric" value={val} onChange={(ev) => setVal(ev.target.value.replace(/[^-\d]/g, ""))}
          style={{ width: 64 }} aria-label="Bonus" />
        <select value={target} onChange={(ev) => setTarget(ev.target.value)} style={{ flex: 1, minWidth: 150 }}>
          <optgroup label="Common">
            {FX_TARGET_OPTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </optgroup>
          <optgroup label="One skill">
            {SKILLS.map(([k, n]) => <option key={k} value={"skill:" + k}>{n}</option>)}
          </optgroup>
        </select>
      </div>
      <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
        <select value={type} onChange={(ev) => setType(ev.target.value)} style={{ flex: 1, minWidth: 130 }}>
          {FX_TYPES.map((t) => <option key={t} value={t}>{t} bonus</option>)}
        </select>
        <input inputMode="numeric" placeholder="Rounds (blank = open)" value={rounds}
          onChange={(ev) => setRounds(ev.target.value.replace(/\D/g, ""))} style={{ flex: 1, minWidth: 130 }} />
      </div>
      <div className="mut xs" style={{ marginTop: 6 }}>
        Bonus type matters: two status bonuses don't add together, PF2 takes the better one. Untyped is the escape
        hatch for anything that really should stack.
      </div>
      <button className="btn pri" style={{ width: "100%", marginTop: 10 }}
        disabled={!(+val)}
        onClick={() => add({
          name: name.trim() || fxTargetName(target) + " " + sgn(+val || 0),
          type, rounds: rounds ? Math.max(1, +rounds) : null,
          note: "", b: { [target]: +val || 0 },
        })}>
        Add effect
      </button>
    </Modal>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheetin" style={wide ? { maxWidth: 860 } : null} onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 16 }}>{title}</strong>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ================= app =================
export default function App() {
  const [chars, setChars] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [tab, setTab] = useState("play");
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("ok");
  const [log, setLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const logRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [theme, setTheme] = useState("slate");

  /* The Ask Claude button and the sync pill float above the roll log. The log
     is only as tall as the rolls in it, so publish the measured height instead
     of guessing at a fraction of the viewport — a guess leaves them stranded
     in the middle of the screen when the log is short. */
  useEffect(() => {
    const root = document.documentElement;
    const clear = () => root.style.setProperty("--logh", "0px");
    const el = logRef.current;
    if (!showLog || !el) { clear(); return; }
    const measure = () => root.style.setProperty("--logh", el.offsetHeight + "px");
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); clear(); };
  }, [showLog, log.length]);
  const [ask, setAsk] = useState(false);
  const [animate, setAnimate] = useState(true);
  const [autoApply, setAutoApply] = useState(false);
  const [hb, setHbState] = useState(HB_EMPTY);
  const [roll, setRoll] = useState(null);
  const timer = useRef(null);
  const revs = useRef({});          // id -> rev we last read or wrote
  const saved = useRef({});         // id -> the exact object we last persisted
  const dirty = useRef(new Set());  // ids with local edits not yet stored
  const remote = useRef({});        // id -> {char, rev} a newer copy from elsewhere
  const prevIds = useRef([]);
  const charsRef = useRef([]);
  const hbRef = useRef(null);
  const hbRev = useRef(0);
  const hbSaved = useRef(null);
  const [conflict, setConflict] = useState(null);
  charsRef.current = chars;
  hbRef.current = hb;

  // the registry has to change synchronously — ops later in the same batch read it
  const commitHb = useCallback((next) => { setHbState(hbLoadRegistry(next)); }, []);

  useEffect(() => {
    (async () => {
      const dd = await store.load();
      if (dd) {
        revs.current = dd.revs || {};
        dd.chars.forEach((ch) => { saved.current[ch.id] = ch; });
        prevIds.current = dd.chars.map((x) => x.id);
        const m = dd.meta || {};
        if (dd.chars.length) { setChars(dd.chars); setActiveId(m.activeId || dd.chars[0].id); }
        if (m.theme && THEMES[m.theme]) setTheme(m.theme);
        if (m.animate === false) setAnimate(false);
        if (m.autoApply) setAutoApply(true);
      }
      const h = await store.loadHb();
      if (h) {
        hbLoadRegistry(h.hb); setHbState(h.hb);
        hbRev.current = h.rev; hbSaved.current = h.hb;
      }
      setLoaded(true);
    })();
  }, []);

  // save only the characters that actually changed
  useEffect(() => {
    if (!loaded) return;
    const changed = chars.filter((ch) => saved.current[ch.id] !== ch);
    if (!changed.length) return;
    changed.forEach((ch) => dirty.current.add(ch.id));
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      let failed = false; const hit = [];
      for (const ch of changed) {
        const r = await store.saveChar(ch, revs.current[ch.id] || 0);
        if (r.conflict) {
          remote.current[ch.id] = { char: r.remote.char, rev: r.remote.rev || 1 };
          hit.push(ch.id);
          continue;
        }
        if (!r.ok) { failed = true; continue; }
        revs.current[ch.id] = r.rev;
        saved.current[ch.id] = ch;
        dirty.current.delete(ch.id);
      }
      if (hit.length) setConflict({ ids: hit });
      setSaveState(failed ? "err" : "ok");
    }, 700);
    return () => clearTimeout(timer.current);
  }, [chars, loaded]);

  // the index (which characters exist, plus settings) saves separately
  const idsKey = chars.map((x) => x.id).join(",");
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(async () => {
      const ids = charsRef.current.map((x) => x.id);
      for (const id of prevIds.current) {
        if (ids.includes(id)) continue;
        await store.removeChar(id);
        delete revs.current[id]; delete saved.current[id]; delete remote.current[id];
        dirty.current.delete(id);
      }
      prevIds.current = ids;
      await store.saveIndex({ ids, activeId, theme, animate, autoApply });
    }, 700);
    return () => clearTimeout(t);
  }, [idsKey, activeId, theme, animate, autoApply, loaded]);

  useEffect(() => {
    if (!loaded || hb === hbSaved.current) return;
    const t = setTimeout(async () => {
      const r = await store.saveHb(hb, hbRev.current);
      if (!r.ok) return;
      hbRev.current = r.rev; hbSaved.current = r.hb;
      if (r.hb !== hb) { hbLoadRegistry(r.hb); setHbState(r.hb); }
    }, 700);
    return () => clearTimeout(t);
  }, [hb, loaded]);

  // pull anything another device wrote while this tab sat in the background
  const refresh = useCallback(async () => {
    const dd = await store.load();
    if (!dd) return;
    const cur = charsRef.current;
    const hit = [];
    const out = dd.chars.map((rc) => {
      const mine = cur.find((x) => x.id === rc.id);
      const rev = dd.revs[rc.id] || 0;
      if (rev <= (revs.current[rc.id] || 0)) return mine || rc;
      if (mine && dirty.current.has(rc.id)) {       // both sides moved — ask
        remote.current[rc.id] = { char: rc, rev };
        hit.push(rc.id);
        return mine;
      }
      revs.current[rc.id] = rev; saved.current[rc.id] = rc;
      return rc;                                     // clean here — just take theirs
    });
    cur.forEach((x) => { if (!out.some((y) => y.id === x.id) && dirty.current.has(x.id)) out.push(x); });
    setChars(out);
    /* A device that joins a sync code with nothing of its own receives the
       characters but has none selected, and sits on the welcome screen looking
       like sync did nothing. Open one. */
    setActiveId((curId) => (curId && out.some((x) => x.id === curId) ? curId : (out[0] ? out[0].id : null)));
    if (hit.length) setConflict({ ids: hit });

    const h = await store.loadHb();
    if (h && h.rev > hbRev.current) {
      const next = hbUnion(h.hb, hbRef.current || HB_EMPTY());
      hbRev.current = h.rev; hbSaved.current = null;   // union gets written back
      setHbState(hbLoadRegistry(next));
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const onWake = () => { if (document.visibilityState !== "hidden") refresh(); };
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [loaded, refresh]);

  const c = chars.find((x) => x.id === activeId) || null;
  const setChar = useCallback((fn) => {
    setChars((cs) => cs.map((x) => (x.id === activeId ? { ...x, ...fn(x) } : x)));
  }, [activeId]);

  const D = { ANCESTRIES, BACKGROUNDS, CLASSES, SKILLS, ARMORS: allArmors(), SHIELDS: allShields(), WEAPONS: allWeapons() };
  const dv = useMemo(() => (c ? derive(c, D) : null), [c, hb]);

  const pushLog = (entry) => setLog((l) => [{ ...entry, t: Date.now(), id: uid() }, ...l].slice(0, 60));
  const check = (label, mod, dc) => {
    const nat = d(20); const total = nat + mod;
    pushLog({ label, nat, mod, total, crit: nat === 20, fumble: nat === 1, dc });
    if (animate) setRoll({
      id: uid(), label, face: nat, cycleMax: 20,
      math: "d20 " + nat + " " + sgn(mod) + (dc ? "  vs DC " + dc : ""), big: total,
      glow: nat === 20 ? "crit" : nat === 1 ? "fumble" : null,
      verdict: nat === 20 ? "NATURAL 20" : nat === 1 ? "NATURAL 1" : null,
    });
    setShowLog(true);
  };
  /* Anything not tied to a button on the sheet: flat checks, a GM's "give me
     2d6", recovery rolls, fortune and misfortune. */
  const rollPool = (pool, mod, mode, label) => {
    const rolled = [];
    DICE.forEach((f) => { for (let i = 0; i < (pool[f] || 0); i++) rolled.push({ f, v: d(f) }); });
    if (!rolled.length) return;
    let kept = rolled.slice();
    if (mode !== "sum" && rolled.length > 1) {
      const pick = rolled.reduce((a, b) => ((mode === "high" ? b.v > a.v : b.v < a.v) ? b : a));
      kept = [pick];
    }
    const sum = kept.reduce((t, x) => t + x.v, 0);
    const total = sum + mod;
    const nat20 = kept.length === 1 && kept[0].f === 20 && kept[0].v === 20;
    const nat1 = kept.length === 1 && kept[0].f === 20 && kept[0].v === 1;
    const detail = rolled.map((x) => "d" + x.f + " " + x.v).join(", ") +
      (mode === "high" ? " → keep highest" : mode === "low" ? " → keep lowest" : "") +
      (mod ? " " + sgn(mod) : "");
    pushLog({ label, total, detail, nat: kept.length === 1 ? kept[0].v : null, crit: nat20, fumble: nat1 });
    if (animate) setRoll({
      id: uid(), label, face: kept.length === 1 ? kept[0].v : total,
      cycleMax: Math.max(6, kept.length === 1 ? kept[0].f : total),
      math: detail, big: mod || kept.length > 1 ? total : null,
      glow: nat20 ? "crit" : nat1 ? "fumble" : null,
      verdict: nat20 ? "NATURAL 20" : nat1 ? "NATURAL 1" : null,
    });
    setShowLog(true);
  };

  /* Takes the whole attack rather than loose numbers, because a critical hit
     needs the weapon's traits: fatal has already swapped the die inside
     critDmg so it doubles with everything else, deadly is added after. */
  const damage = (a, crit) => {
    const main = rollDice(crit && a.critDmg ? a.critDmg : a.dmg);
    const extra = a.extraDice ? rollDice(a.extraDice) : { total: 0, rolls: [] };
    let total = (main.total + extra.total + a.dmgMod) * (crit ? 2 : 1);
    const dead = crit && a.deadlyDmg ? rollDice(a.deadlyDmg) : { total: 0, rolls: [] };
    total += dead.total;
    const bits =
      main.rolls.join("+") +
      (extra.rolls.length ? " +" + extra.rolls.join("+") : "") +
      (a.dmgMod ? " " + sgn(a.dmgMod) : "") +
      (crit ? " ×2" : "") +
      (dead.rolls.length ? "  deadly +" + dead.rolls.join("+") : "");
    pushLog({ label: a.name + (crit ? " (crit)" : " damage"), dmg: true, total, detail: bits });
    if (animate) setRoll({
      id: uid(), label: a.name + (crit ? " — critical damage" : " damage"), face: total,
      cycleMax: Math.max(6, total), math: bits, big: null,
      glow: crit ? "crit" : null, verdict: crit ? "CRITICAL HIT" : null,
    });
    setShowLog(true);
  };

  const addChar = () => {
    const nc = newChar("");
    setChars((cs) => [...cs, nc]); setActiveId(nc.id); setTab("build");
  };

  const resolve = (take) => {
    const ids = (conflict && conflict.ids) || [];
    const rem = remote.current;
    if (take === "theirs") {
      ids.forEach((id) => {
        const r = rem[id]; if (!r) return;
        revs.current[id] = r.rev; saved.current[id] = r.char; dirty.current.delete(id);
      });
      setChars(charsRef.current.map((x) => (ids.includes(x.id) && rem[x.id] ? rem[x.id].char : x)));
    } else {
      // keep the local copy: adopt their rev so our next write lands on top
      ids.forEach((id) => { if (rem[id]) revs.current[id] = rem[id].rev; });
      setChars(charsRef.current.map((x) => (ids.includes(x.id) ? { ...x } : x)));
    }
    ids.forEach((id) => delete rem[id]);
    setConflict(null);
  };

  /* Adding from the library copies the character into your own storage, and
     that copy is yours from then on — later corrections to the bundled version
     don't reach it. So the library stays on offer even once you have a copy,
     and a second add lands beside the first rather than being hidden. */
  const addFromLibrary = (ic) => {
    const dup = chars.some((x) => x.id === ic.id);
    const copy = dup ? { ...ic, id: "c" + uid(), createdAt: Date.now() } : ic;
    setChars([...chars, copy]); setActiveId(copy.id); setModal(null); setTab("play");
  };

  if (!loaded) return <div className="pf"><style>{themeCss(theme)}</style><div className="empty">Loading your characters…</div></div>;

  if (!c) {
    const restorable = IMPORTED_CHARS;
    return (
      <div className="pf"><style>{themeCss(theme)}</style>
        <div className="wrap" style={{ paddingTop: 40, maxWidth: 520 }}>
          <h1 style={{ fontSize: 26, letterSpacing: "-.02em", margin: "0 0 6px" }}>Pathfinder 2e sheet</h1>
          <p className="mut sm" style={{ marginTop: 0 }}>
            Build a character, level it up step by step, and run it at the table. Everything saves to your
            Claude account, so the same character opens on your laptop and your phone.
          </p>
          <p className="mut sm">
            New to Pathfinder? Starting a character opens a guided setup: one question per screen, with what each
            answer actually changes explained as you go. No rulebook needed.
          </p>

          {chars.length > 0 && (
            <div className="card">
              <h3 data-icon="scroll">Pick up where you left off</h3>
              {chars.map((x) => (
                <button key={x.id} className="btn" style={{ width: "100%", textAlign: "left", padding: "10px 12px", marginTop: 6 }}
                  onClick={() => { setActiveId(x.id); setTab("play"); }}>
                  <div style={{ fontWeight: 700 }}>{charName(x)}</div>
                  <div className="mut xs">{charLine(x)}</div>
                </button>
              ))}
            </div>
          )}

          {restorable.length > 0 && (
            <div className="card">
              <h3 data-icon="box">From your library</h3>
              <div className="mut xs" style={{ marginBottom: 2 }}>
                Built into the app itself, so it's here on any device even before anything has saved. Adding one makes
                your own editable copy — which then stops tracking this version, so if the built-in one has been
                corrected since, add it again and delete the old copy.
              </div>
              {restorable.map((ic) => {
                const have = chars.some((x) => x.id === ic.id);
                return (
                  <button key={ic.id} className="btn" style={{ width: "100%", textAlign: "left", padding: "10px 12px", marginTop: 6 }}
                    onClick={() => addFromLibrary(ic)}>
                    <div style={{ fontWeight: 700 }}>{charName(ic)}{have ? " — add a fresh copy" : ""}</div>
                    <div className="mut xs">{charLine(ic)}</div>
                  </button>
                );
              })}
            </div>
          )}

          <button className="btn pri" style={{ width: "100%", padding: 12, marginTop: 12 }} onClick={addChar}>
            Create a character — walk me through it
          </button>
          <div style={{ marginTop: 16 }}><ThemePicker theme={theme} setTheme={setTheme} /></div>
          <ImportBox label="Paste a character or a backup"
            onImport={(arr, hbIn) => {
              const have = new Set(chars.map((x) => x.id));
              const add = arr.map((x) => (have.has(x.id) ? { ...x, id: "c" + uid() } : x));
              setChars([...chars, ...add]); setActiveId(add[0] && add[0].id); setTab("play");
              if (hbIn && hbCount(hbIn)) commitHb(hbUnion(hb, hbIn));
            }} />
        </div>
      </div>
    );
  }

  /* A half-built character has nothing worth showing on the other tabs, and a
     first-timer shouldn't have to work out which one to be on. */
  const setupMode = !!c.setup;
  const TABS = setupMode ? [["build", "Building " + (c.name || "your character")]] :
    [["play", "Play"], ["build", "Build"], ["feats", "Feats"], ["gear", "Gear"],
    ...(dv.casts ? [["spells", "Spells"]] : []), ["notes", "Notes"]];
  const view = setupMode ? "build" : tab;

  return (
    <div className="pf"><style>{themeCss(theme)}</style>
      <div className="top">
        <div className="topin">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nm">{charName(c)}</div>
            <div className="sub">{charLine(c)}</div>
          </div>
          <button className="btn sm" onClick={() => setModal("theme")} aria-label="Change theme">
            <span className="swatch" style={{ background: (THEMES[theme] || {}).dot }} />
          </button>
          <button className="btn sm" onClick={() => setModal("chars")}>Characters</button>
          <button className="btn sm" onClick={() => setModal("dice")}>Dice</button>
          <button className="btn sm" onClick={() => setShowLog((s) => !s)}>Rolls</button>
        </div>
        <div className="tabs">
          {TABS.map(([k, l]) => (
            <button key={k} data-tab={k} className={"tab" + (view === k ? " on" : "")} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="wrap">
        {conflict && (
          <div className="card" style={{ borderColor: "var(--gold, #7a5a1e)" }}>
            <div className="sm" style={{ fontWeight: 700, marginBottom: 2 }}>Changed on another device</div>
            <div className="mut xs" style={{ marginBottom: 8 }}>
              {conflict.ids.map((id) => (chars.find((x) => x.id === id) || {}).name).filter(Boolean).join(", ") || "A character"}
              {" "}was edited somewhere else while you had unsaved changes here. Pick which copy to keep.
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className="btn sm pri" onClick={() => resolve("mine")}>Keep this device's version</button>
              <button className="btn sm" onClick={() => resolve("theirs")}>Use the other one</button>
            </div>
          </div>
        )}
        {view === "play" && <Play c={c} dv={dv} setChar={setChar} check={check} damage={damage} setModal={setModal} />}
        {view === "build" && <Build c={c} dv={dv} setChar={setChar} setModal={setModal} setTab={setTab} />}
        {view === "feats" && <Feats c={c} dv={dv} setChar={setChar} />}
        {view === "gear" && <Gear c={c} dv={dv} setChar={setChar} setModal={setModal} />}
        {view === "spells" && <Spells c={c} dv={dv} setChar={setChar} check={check} />}
        {view === "notes" && <Notes c={c} setChar={setChar} chars={chars} setChars={setChars} setActiveId={setActiveId} saveState={saveState} hb={hb} setHb={commitHb} />}
      </div>

      {showLog && (
        <div className="log" ref={logRef}>
          <div className="between" style={{ marginBottom: 4 }}>
            <strong className="sm">Roll log</strong>
            <div className="row">
              <button className="btn sm" onClick={() => setLog([])}>Clear</button>
              <button className="btn sm" onClick={() => setShowLog(false)}>Hide</button>
            </div>
          </div>
          {log.length === 0 && <div className="empty">Tap any modifier on the Play tab to roll it.</div>}
          {log.map((l) => (
            <div className="logline" key={l.id}>
              <span className={l.crit ? "crit" : l.fumble ? "fumble" : ""}>
                {l.label}{l.dmg ? "" : <span className="mut xs"> d20 {l.nat} {sgn(l.mod)}</span>}
                {l.detail ? <span className="mut xs"> {l.detail}</span> : null}
              </span>
              <strong className={"big " + (l.crit ? "crit" : l.fumble ? "fumble" : "")}>{l.total}</strong>
            </div>
          ))}
        </div>
      )}

      {modal === "chars" && (
        <Modal title="Characters" onClose={() => setModal(null)}>
          {chars.map((x) => (
            <div className="between" key={x.id} style={{ padding: "8px 0", borderBottom: "1px solid #262d3a" }}>
              <button style={{ textAlign: "left", flex: 1 }} onClick={() => { setActiveId(x.id); setModal(null); setTab("play"); }}>
                <div style={{ fontWeight: 700 }}>{charName(x)}</div>
                <div className="mut xs">{charLine(x)}</div>
              </button>
              <button className="btn sm dan" onClick={() => {
                if (!confirm("Delete " + charName(x) + "? This can't be undone.")) return;
                const rest = chars.filter((y) => y.id !== x.id);
                setChars(rest); if (activeId === x.id) setActiveId(rest[0] ? rest[0].id : null);
              }}>Delete</button>
            </div>
          ))}
          <button className="btn pri" style={{ width: "100%", marginTop: 12 }} onClick={() => { addChar(); setModal(null); }}>
            Create a character
          </button>
          {IMPORTED_CHARS.map((ic) => {
            const have = chars.some((x) => x.id === ic.id);
            return (
              <button key={ic.id} className="btn" style={{ width: "100%", marginTop: 8 }} onClick={() => addFromLibrary(ic)}>
                {have ? "Add a fresh copy of " + ic.name : "Add " + ic.name + " — imported from your PDF"}
              </button>
            );
          })}
          {IMPORTED_CHARS.some((ic) => chars.some((x) => x.id === ic.id)) && (
            <div className="mut xs" style={{ marginTop: 6 }}>
              A fresh copy comes with whatever has been fixed in the built-in version since you added yours. It arrives
              alongside the one you have, so you can compare the two before deleting either.
            </div>
          )}
        </Modal>
      )}
      {modal === "theme" && (
        <Modal title="Theme" onClose={() => setModal(null)}>
          <ThemePicker theme={theme} setTheme={setTheme} />
          <div className="between" style={{ marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <div className="sm" style={{ fontWeight: 600 }}>Animate dice rolls</div>
              <div className="mut xs">A tumbling die on every check. The Mario theme throws in a critter who gets flattened on a natural 20.</div>
            </div>
            <button className={"btn sm" + (animate ? " pri" : "")} onClick={() => setAnimate((a) => !a)}>
              {animate ? "On" : "Off"}
            </button>
          </div>
        </Modal>
      )}
      {modal === "conditions" && <ConditionsModal c={c} setChar={setChar} onClose={() => setModal(null)} />}
      {modal === "effects" && <EffectsModal c={c} setChar={setChar} onClose={() => setModal(null)} />}
      {modal === "homebrew" && <HomebrewModal hb={hb} setHb={commitHb} onClose={() => setModal(null)} />}
      {modal === "dice" && <DiceTray onRoll={rollPool} onClose={() => setModal(null)} />}
      {modal === "addweapon" && <WeaponModal c={c} setChar={setChar} onClose={() => setModal(null)} />}

      <button className="askbtn" onClick={() => setAsk(true)}>
        Ask Claude
      </button>
      {ask && <AskPanel c={c} dv={dv} setChar={setChar} auto={autoApply} setAuto={setAutoApply}
        hb={hb} setHb={commitHb} onClose={() => setAsk(false)} />}
      {roll && <DiceOverlay roll={roll} onDone={() => setRoll(null)} theme={theme} />}
    </div>
  );
}

function ThemePicker({ theme, setTheme }) {
  return (
    <div>
      {Object.entries(THEMES).map(([k, t]) => (
        <button key={k} onClick={() => setTheme(k)}
          style={{
            display: "block", width: "100%", textAlign: "left", padding: "11px 12px", marginBottom: 8,
            border: "var(--bd) solid " + (theme === k ? "var(--brass)" : "var(--line)"),
            borderRadius: "var(--rad)", background: theme === k ? "var(--pillon)" : "var(--pan2)",
          }}>
          <div className="row">
            <span className="swatch" style={{ background: t.dot }} />
            <strong style={{ fontFamily: "var(--fontd)" }}>{t.name}</strong>
            {theme === k && <span className="badge" style={{ marginLeft: "auto" }}>in use</span>}
          </div>
          <div className="mut xs" style={{ marginTop: 4 }}>{t.blurb}</div>
        </button>
      ))}
    </div>
  );
}

// ================= PLAY =================
function Play({ c, dv, setChar, check, damage, setModal }) {
  const [amt, setAmt] = useState("");
  const hp = c.hp == null ? dv.hpMax : c.hp;
  const applyHp = (delta) => {
    const n = parseInt(amt || "0", 10) || 0;
    if (!n) return;
    let cur = hp, temp = c.tempHp || 0, dying = c.dying || 0, wounded = c.wounded || 0;
    if (delta < 0) {
      let dmg = n;
      const absorbed = Math.min(temp, dmg); temp -= absorbed; dmg -= absorbed;
      cur -= dmg;
      /* Dropping to 0 starts you dying at 1 + wounded. Taking a hit while
         already down pushes it one further. */
      if (cur <= 0) { cur = 0; dying = dying === 0 ? 1 + wounded : dying + 1; }
    } else {
      if (dying > 0) { dying = 0; wounded = wounded + 1; }
      cur = Math.min(dv.hpMax, cur + n);
    }
    setChar(() => ({ hp: cur, tempHp: temp, dying, wounded }));
    setAmt("");
  };
  const pct = clamp(Math.round((hp / Math.max(1, dv.hpMax)) * 100), 0, 100);
  const conds = Object.entries(c.conditions || {}).filter(([, v]) => v);
  const fx = c.effects || [];

  return (
    <>
      <div className="card">
        <div className="between" style={{ alignItems: "flex-end", marginBottom: 8 }}>
          <div>
            <span className="hpnum">{hp}</span>
            <span className="mut" style={{ fontSize: 18 }}> / {dv.hpMax}</span>
            {c.tempHp ? <span className="pill on" style={{ marginLeft: 8 }}>+{c.tempHp} temp</span> : null}
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => setChar(() => ({ hp: dv.hpMax, tempHp: 0, dying: 0 }))}>Full</button>
          </div>
        </div>
        <div className="hpbar"><div className="hpfill" style={{ width: pct + "%" }} /></div>
        <div className="row" style={{ marginTop: 10 }}>
          <input inputMode="numeric" placeholder="Amount" value={amt} onChange={(e) => setAmt(e.target.value.replace(/\D/g, ""))} style={{ flex: 1 }} />
          <button className="btn dan" onClick={() => applyHp(-1)}>Damage</button>
          <button className="btn gd" onClick={() => applyHp(1)}>Heal</button>
        </div>
        <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
          {[1, 5, 10, 15, 20].map((n) => (
            <button key={n} className="btn sm" onClick={() => setAmt(String(n))}>{n}</button>
          ))}
          <input inputMode="numeric" placeholder="Temp HP" value={c.tempHp || ""} onChange={(e) => setChar(() => ({ tempHp: +e.target.value.replace(/\D/g, "") || 0 }))} style={{ width: 96, marginLeft: "auto" }} />
        </div>
        {(c.dying > 0 || c.wounded > 0) && (
          <>
            <div className="line" />
            <div className="between">
              <Counter label={"Dying (dies at " + dv.dyingMax + ")"} v={c.dying || 0} set={(v) => setChar(() => ({ dying: clamp(v, 0, 6) }))} />
              <Counter label="Wounded" v={c.wounded || 0} set={(v) => setChar(() => ({ wounded: clamp(v, 0, 4) }))} />
            </div>
            {c.dying > 0 && (
              <button className="btn" style={{ width: "100%", marginTop: 8 }}
                onClick={() => check("Recovery (DC " + (10 + (c.dying || 0)) + ")", 0, 10 + (c.dying || 0))}>
                Roll recovery check — DC {10 + (c.dying || 0)}
              </button>
            )}
          </>
        )}
        {c.dying === 0 && (
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={() => setChar(() => ({ dying: 1 + (c.wounded || 0) }))}>Knocked out</button>
            <Counter label="Hero points" v={c.hero || 0} set={(v) => setChar(() => ({ hero: clamp(v, 0, 3) }))} />
          </div>
        )}
      </div>

      <div className="grid g4">
        <Stat v={dv.ac} l="AC" s={fxTag(dv.armor.n === "Unarmored" ? "unarmored" : dv.armor.n, dv.fx("ac"))} onClick={() => { }} />
        <Stat v={sgn(dv.saves.fortitude)} l="Fortitude" s={fxTag(RANKS[dv.ranks.fortitude], dv.fx("fort"))} onClick={() => check("Fortitude", dv.saves.fortitude)} />
        <Stat v={sgn(dv.saves.reflex)} l="Reflex" s={fxTag(RANKS[dv.ranks.reflex], dv.fx("ref"))} onClick={() => check("Reflex", dv.saves.reflex)} />
        <Stat v={sgn(dv.saves.will)} l="Will" s={fxTag(RANKS[dv.ranks.will], dv.fx("will"))} onClick={() => check("Will", dv.saves.will)} />
      </div>
      <div className="grid g4" style={{ marginTop: 8 }}>
        <Stat v={sgn(dv.perception)} l="Perception" s={fxTag(RANKS[dv.ranks.perception], dv.fx("per"))} onClick={() => check("Perception", dv.perception)} />
        {(() => {
          /* Rolling initiative with Stealth after sneaking up on someone is
             routine, so initiative follows whichever skill is picked. */
          const k = c.initSkill && dv.skills[c.initSkill] ? c.initSkill : null;
          const name = k ? dv.skills[k].name : "Perception";
          const v = k ? dv.skills[k].mod : dv.perception;
          return <Stat v={sgn(v)} l="Initiative" s={fxTag(name, k ? dv.fx("skill:" + k) : dv.fx("per"))}
            onClick={() => check("Initiative (" + name + ")", v)} />;
        })()}
        <Stat v={dv.speed + " ft"} l="Speed" s={fxTag(dv.pen.slowed ? "slowed " + dv.pen.slowed : null, dv.fx("speed"))} />
        <Stat v={dv.classDC != null ? dv.classDC : "—"} l="Class DC" s={fxTag(dv.classDC != null ? RANKS[dv.ranks.classDC] : "n/a", dv.fx("classDC"))} />
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 data-icon="star" style={{ margin: 0 }}>Temporary effects</h3>
          <div className="row">
            {(fx.length > 0 || (c.conditions || {}).frightened) && (
              <button className="btn sm" onClick={() => setChar((cur) => ({
                effects: tickEffects(cur.effects),
                /* Frightened drops by 1 at the end of every turn — the one
                   condition that genuinely needs doing every round. */
                conditions: { ...(cur.conditions || {}), frightened: Math.max(0, (+(cur.conditions || {}).frightened || 0) - 1) },
              }))}>Next round</button>
            )}
            <button className="btn sm" onClick={() => setModal("effects")}>Add</button>
          </div>
        </div>
        {fx.length === 0
          ? <div className="mut sm">Nothing running. A buff added here folds into every number on this page and comes straight back off when it ends.</div>
          : fx.map((e) => (
            <div className="atk" key={e.id}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{e.name}</div>
                <div className="mut xs">{fxLabel(e)}{e.note ? " \u00b7 " + e.note : ""}</div>
              </div>
              <div className="row">
                <span className="pill on">{e.rounds == null ? "open" : e.rounds + " rd"}</span>
                <button className="btn sm dan" onClick={() => setChar((cur) => ({ effects: (cur.effects || []).filter((x) => x.id !== e.id) }))}>End</button>
              </div>
            </div>
          ))}
      </div>

      <div className="card">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 data-icon="bomb" style={{ margin: 0 }}>Conditions</h3>
          <div className="row">
            <button className="btn sm" onClick={() => setChar(() => ({ shieldRaised: !c.shieldRaised }))}
              style={c.shieldRaised ? { borderColor: "var(--brass)", color: "var(--brass)" } : null}>
              {c.shieldRaised ? "Shield raised" : "Raise shield"}
            </button>
            <button className="btn sm" onClick={() => setModal("conditions")}>Edit</button>
          </div>
        </div>
        {conds.length === 0
          ? <div className="mut sm">None. Anything you add here is applied to your numbers automatically.</div>
          : <div className="row" style={{ flexWrap: "wrap" }}>
            {conds.map(([k, v]) => {
              const def = CONDITIONS.find((x) => x.k === k) || { n: k };
              /* Conditions with a value step down a point at a time — you
                 recover from frightened 3 one stage at a time, you don't
                 shrug it off. Flags clear outright. */
              return <button key={k} className="pill on"
                title={def.val ? "Step it down" : "Clear it"}
                onClick={() => setChar(() => ({ conditions: { ...c.conditions, [k]: def.val ? Math.max(0, (+v || 1) - 1) : 0 } }))}>
                {def.n}{def.val ? " " + v : ""} {def.val && +v > 1 ? "−" : "×"}
              </button>;
            })}
          </div>}
      </div>

      <div className="cols">
        <div>
          <div className="card">
            <div className="between" style={{ marginBottom: 4 }}>
              <h3 data-icon="fire" style={{ margin: 0 }}>Strikes</h3>
              <button className="btn sm" onClick={() => setModal("addweapon")}>Add</button>
            </div>
            {dv.attacks.length === 0 && <div className="empty">No weapons yet. Add one and it shows up here with its numbers worked out.</div>}
            {dv.attacks.map((a) => (
              <div className="atk" key={a.id}>
                <div>
                  <div style={{ fontWeight: 700 }}>{a.name}</div>
                  <div className="mut xs">
                    {a.dmg}{a.dmgMod ? sgn(a.dmgMod) : ""} {a.dmgType}
                    {a.extraDice ? " +" + a.extraDice + (a.extraNote ? " " + a.extraNote : "") : ""}
                    {a.critNote ? " · " + a.critNote : ""}
                    {a.twoHanded ? " · two hands" : ""} · {RANKS[a.rank]}
                    {a.potency ? " · +" + a.potency : ""}{a.striking ? " · striking" : ""}
                    {a.traits.length ? " · " + a.traits.join(", ") : ""}
                  </div>
                  <div className="row" style={{ marginTop: 5 }}>
                    <button className="btn sm" onClick={() => damage(a, false)}>Damage</button>
                    <button className="btn sm" onClick={() => damage(a, true)}>Crit</button>
                    <button className="btn sm dan" onClick={() => setChar(() => ({ weapons: c.weapons.filter((w) => w.id !== a.id) }))}>×</button>
                  </div>
                </div>
                <div className="maps">
                  {[["", a.atk], ["−" + (a.agile ? 4 : 5), a.map1], ["−" + (a.agile ? 8 : 10), a.map2]].map(([lb, v], i) => (
                    <button key={i} className="mapb" onClick={() => check(a.name + (lb ? " " + lb : ""), v)}>
                      {sgn(v)}<small>{lb || "1st"}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {(c.favorites || []).length > 0 && (
            <div className="card">
              <h3 data-icon="flag">Quick reference</h3>
              {(c.feats || []).filter((f) => (c.favorites || []).includes(f.id)).map((f) => (
                <div className="ftrow" key={f.id}>
                  <div className="between">
                    <strong className="sm">{f.name}</strong>
                    <a className="link" href={aon(f.name)} target="_blank" rel="noreferrer">Full text</a>
                  </div>
                  {f.note ? <div className="mut xs">{f.note}</div> : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="between" style={{ marginBottom: 6 }}>
              <h3 data-icon="book" style={{ margin: 0 }}>Skills</h3>
              <label className="mut xs" style={{ display: "flex", alignItems: "center", gap: 6, width: "auto" }}>
                Initiative
                <select value={c.initSkill || ""} onChange={(e) => setChar(() => ({ initSkill: e.target.value }))}
                  style={{ width: 132 }} aria-label="Roll initiative with">
                  <option value="">Perception</option>
                  {SKILLS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                </select>
              </label>
            </div>
            {SKILLS.map(([k]) => {
              const s = dv.skills[k];
              return (
                <div className="skrow" key={k}>
                  <div className="row"><Rk r={s.rank} /><span className="sm">{s.name}</span>
                    {s.armorPen ? <span className="xs mut">({s.armorPen} armor)</span> : null}</div>
                  <button className="mo" onClick={() => check(s.name, s.mod)}>{sgn(s.mod)}</button>
                </div>
              );
            })}
            {(c.lores || []).map((l, i) => (
              <div className="skrow" key={"l" + i}>
                <div className="row"><Rk r={l.rank || 1} /><span className="sm">{l.name} Lore</span></div>
                <button className="mo" onClick={() => check(l.name + " Lore", dv.pb(l.rank || 1) + dv.m.int)}>
                  {sgn(dv.pb(l.rank || 1) + dv.m.int)}
                </button>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 data-icon="gem">Ability scores</h3>
            <div className="grid g6">
              {ABIL.map((a) => (
                <div className="stat" key={a}>
                  <div className="v">{sgn(dv.m[a])}</div>
                  <div className="l">{a.toUpperCase()}</div>
                  <div className="s">{dv.ab[a]}</div>
                </div>
              ))}
            </div>
          </div>

          {dv.casts && (
            <div className="card">
              <h3 data-icon="star">Magic</h3>
              <div className="grid g3">
                <Stat v={dv.spellDC} l="Spell DC" s={RANKS[dv.ranks.spell]} />
                <Stat v={sgn(dv.spellAtk)} l="Spell attack" onClick={() => check("Spell attack", dv.spellAtk)} />
                <Stat v={(c.focusCur || 0) + "/" + (c.focusMax || 0)} l="Focus" onClick={() => setChar(() => ({ focusCur: clamp((c.focusCur || 0) - 1, 0, c.focusMax || 0) }))} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Counter({ label, v, set }) {
  return (
    <div className="row">
      <span className="xs mut">{label}</span>
      <button className="btn sm" onClick={() => set(v - 1)}>−</button>
      <strong style={{ minWidth: 16, textAlign: "center" }}>{v}</strong>
      <button className="btn sm" onClick={() => set(v + 1)}>+</button>
    </div>
  );
}

function ConditionsModal({ c, setChar, onClose }) {
  const co = c.conditions || {};
  const set = (k, v) => setChar(() => ({ conditions: { ...co, [k]: v } }));
  return (
    <Modal title="Conditions" onClose={onClose}>
      <p className="mut sm" style={{ marginTop: 0 }}>Penalties apply to your numbers as soon as you set them. Status penalties don't stack — the worst one applies.</p>
      {CONDITIONS.map((cd) => (
        <div className="between" key={cd.k} style={{ padding: "8px 0", borderBottom: "1px solid #262d3a" }}>
          <div style={{ flex: 1 }}>
            <div className="sm" style={{ fontWeight: 600 }}>{cd.n}</div>
            <div className="mut xs">{cd.d}</div>
          </div>
          {cd.val
            ? <Counter label="" v={+co[cd.k] || 0} set={(v) => set(cd.k, clamp(v, 0, 6))} />
            : <button className={"btn sm" + (co[cd.k] ? " pri" : "")} onClick={() => set(cd.k, co[cd.k] ? 0 : 1)}>
              {co[cd.k] ? "On" : "Off"}</button>}
        </div>
      ))}
    </Modal>
  );
}

function WeaponModal({ c, setChar, onClose }) {
  const [q, setQ] = useState("");
  const list = allWeapons().filter((w) => w.n.toLowerCase().includes(q.toLowerCase()));
  const add = (w) => {
    setChar(() => ({
      weapons: [...(c.weapons || []), { id: uid(), base: w.n, name: w.n, cat: w.c, die: w.d, dmgType: w.t, traits: w.tr, ranged: w.r, potency: 0, striking: 0 }],
    }));
    onClose();
  };
  return (
    <Modal title="Add a weapon" onClose={onClose}>
      <input placeholder="Search weapons" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      <div style={{ marginTop: 8 }}>
        {list.map((w) => (
          <button key={w.n} className="between" style={{ width: "100%", padding: "9px 0", borderBottom: "1px solid #262d3a", textAlign: "left" }} onClick={() => add(w)}>
            <div>
              <div style={{ fontWeight: 600 }}>{w.n}{w.hb ? <span className="mut xs"> ★ homebrew</span> : null}</div>
              <div className="mut xs">{w.c} · {w.d} {w.t}{w.tr.length ? " · " + w.tr.join(", ") : ""}</div>
            </div>
            <span className="btn sm">Add</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

// ================= BUILD =================
/* ================= GUIDED BUILDER =================
   One decision per screen, in the order that makes the next screen make sense:
   class first, because it decides what the numbers are for. Everything it
   writes is the same data the Build tab edits, so a player can bail out at any
   point and finish by hand — and come back to the guide later if they want it. */
const GSTEPS = [
  ["start", "How this works"],
  ["class", "Class"],
  ["ancestry", "Ancestry"],
  ["background", "Background"],
  ["abilities", "Ability scores"],
  ["skills", "Skills"],
  ["feats", "Level 1 feats"],
  ["finish", "Name and finish"],
];

function Opt({ on, onClick, title, why, tags }) {
  return (
    <button className={"opt" + (on ? " on" : "")} onClick={onClick}>
      <div className="t"><span>{title}</span>{on ? <span className="tick">Chosen ✓</span> : null}</div>
      {why ? <div className="why">{why}</div> : null}
      {tags && tags.filter(Boolean).length ? (
        <div className="tags">{tags.filter(Boolean).map((t, i) => <span className="badge" key={i}>{t}</span>)}</div>
      ) : null}
    </button>
  );
}

function Guide({ c, dv, setChar, setTab }) {
  const step = clamp(c.setup || 1, 1, GSTEPS.length);
  const [key, title] = GSTEPS[step - 1];
  const cls = CLASSES[c.cls];
  const anc = ANCESTRIES[c.ancestry];
  const bgd = BACKGROUNDS[c.background];
  const [allClasses, setAllClasses] = useState(false);
  const [bgq, setBgq] = useState("");

  const go = (n) => {
    setChar(() => ({ setup: clamp(n, 1, GSTEPS.length) }));
    /* Each step is a fresh screenful; without this you land halfway down it.
       Guarded because not every host implements it. */
    try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* no-op */ }
  };
  const finish = () => { setChar(() => ({ setup: 0 })); setTab("play"); };
  const leave = () => { setChar(() => ({ setup: 0 })); };

  const keyAb = cls ? (cls.key.includes(c.keyAbility) ? c.keyAbility : cls.key[0]) : "str";
  const skillSlots = cls ? (cls.skills || 2) + Math.max(0, dv.m.int) : 0;
  const trained = c.trainedSkills || [];

  const boostGaps = () => {
    if (!anc || !bgd || !cls) return ["everything above"];
    const out = [];
    const nAnc = (anc.b || []).filter((b) => b === "free").length;
    if ((c.ancFree || []).filter(Boolean).length < nAnc) out.push("ancestry");
    const opts = (bgd.b || []).filter((b) => b !== "free");
    const bf = c.bgFree || [];
    if (opts.length === 2 ? !bf[0] : !(bf[0] && bf[1])) out.push("background");
    const l1 = (c.l1Free || []).filter(Boolean);
    if (l1.length < 4 || new Set(l1).size < 4) out.push("level 1");
    return out;
  };

  /* A few classes list a "subclass" that isn't actually decided at level 1 —
     the fighter's weapon group, for one. One option means nothing to choose. */
  const subChoice = cls && cls.sub && (cls.sub.opts || []).length > 1 ? cls.sub : null;

  let blocker = null;
  if (key === "class") blocker = !c.cls ? "Pick a class to carry on." :
    (subChoice && !c.subclass ? "One more choice: your " + subChoice.label.toLowerCase() + "." : null);
  if (key === "ancestry") blocker = !c.ancestry ? "Pick an ancestry to carry on." : null;
  if (key === "background") blocker = !c.background ? "Pick a background to carry on." : null;
  if (key === "abilities") {
    const g = boostGaps();
    blocker = g.length ? "Still to fill in: " + g.join(", ") + "." : null;
  }
  if (key === "skills") blocker = trained.length < skillSlots
    ? "Choose " + (skillSlots - trained.length) + " more skill" + (skillSlots - trained.length === 1 ? "" : "s") + "."
    : null;
  if (key === "finish") blocker = !(c.name || "").trim() ? "Give your character a name." : null;

  const chooseClass = (nk) => {
    const n = CLASSES[nk];
    setChar((x) => ({
      cls: nk, subclass: "", keyAbility: n.key[0],
      spellAbility: n.key[0],
      spellTradition: n.tradition && n.tradition !== "varies" ? n.tradition : "",
      trainedSkills: [],
      feats: (x.feats || []).filter((f) => f.type !== "class"),
    }));
  };
  const chooseAnc = (nk) => setChar((x) => ({
    ancestry: nk, heritage: "", ancFree: [],
    feats: (x.feats || []).filter((f) => f.type !== "ancestry"),
  }));
  /* A background hands you a skill feat for free. The old builder printed its
     name and left you to add it by hand; this writes it in and swaps it out if
     you change your mind. */
  const chooseBg = (nk) => {
    const b = BACKGROUNDS[nk];
    setChar((x) => {
      const feats = (x.feats || []).filter((f) => f.src !== "background");
      if (b.feat) feats.push({ id: uid(), name: b.feat, type: "skill", level: 1, src: "background", note: "Free feat from your " + b.n + " background" });
      return { background: nk, bgFree: [], bgPick: "", bgName: "", feats };
    });
  };
  const takeFeat = (type, name) => setChar((x) => {
    const rest = (x.feats || []).filter((f) => !(f.type === type && f.level === 1 && f.src !== "background"));
    const already = (x.feats || []).some((f) => f.type === type && f.level === 1 && f.name === name);
    return { feats: already ? rest : [...rest, { id: uid(), name, type, level: 1, note: "" }] };
  });
  const featAt1 = (type) => ((c.feats || []).find((f) => f.type === type && f.level === 1 && f.src !== "background") || {}).name || "";

  const classList = Object.entries(CLASSES).filter(([k]) => allClasses || (CLASSINFO[k] || {}).first || k === c.cls);
  const bgList = Object.entries(BACKGROUNDS)
    .filter(([k, b]) => k !== "custom" && (!bgq || b.n.toLowerCase().includes(bgq.toLowerCase()) ||
      ((SKILLMAP[b.sk] || {}).name || "").toLowerCase().includes(bgq.toLowerCase())))
    .sort((a, b) => (b[1].b.includes(keyAb) ? 1 : 0) - (a[1].b.includes(keyAb) ? 1 : 0) || a[1].n.localeCompare(b[1].n));

  return (
    <>
      <div className="card">
        <div className="between" style={{ marginBottom: 7 }}>
          <span className="steplabel">Step {step} of {GSTEPS.length} · {title}</span>
          <button className="btn sm" onClick={leave}>Skip the guide</button>
        </div>
        <div className="bar"><div className="barfill" style={{ width: Math.round((step / GSTEPS.length) * 100) + "%" }} /></div>
      </div>

      {key === "start" && (
        <div className="card">
          <h3 data-icon="gem">You're making a 1st-level character</h3>
          <p className="sm" style={{ marginTop: 0 }}>
            Nothing has been chosen yet. I'll ask one question per screen and explain what each answer changes.
            It takes about ten minutes, and none of it is permanent — the Build tab lets you edit every piece afterwards.
          </p>
          <div className="note">
            A Pathfinder character is four decisions and then some arithmetic. The app does all of the arithmetic.
          </div>
          <ol className="numlist">
            <li><strong>Class</strong> — what you do on your turn. The biggest decision by a distance, so it goes first.</li>
            <li><strong>Ancestry</strong> — what you are. Hit points, speed, size, senses.</li>
            <li><strong>Background</strong> — what you did before this. A couple of skills and a free feat.</li>
            <li><strong>Ability scores</strong> — the six numbers everything else is built on. There's a one-tap recommendation if you'd rather not think about it.</li>
            <li><strong>Skills</strong> — what you're trained in outside a fight.</li>
            <li><strong>Feats</strong> — your two level 1 picks.</li>
            <li><strong>Name</strong> — and then you're playing.</li>
          </ol>
          <div className="note">
            Stuck on any screen? The <strong>Ask Claude</strong> button at the bottom right knows the whole sheet and
            can answer questions in plain language, or make the choice for you if you describe the character you want.
          </div>
        </div>
      )}

      {key === "class" && (
        <>
          <div className="card">
            <h3 data-icon="star">What do you want to do in a fight?</h3>
            <p className="sm" style={{ marginTop: 0 }}>
              Your class decides your hit points, your armour, what you're good at, and what your turns actually look
              like. It's the one choice worth taking a minute over. Everything else adapts around it.
            </p>
            <div className="note">
              These {allClasses ? Object.keys(CLASSES).length + " classes are the full list" : "are the classes that are kindest to a first-time player"} —
              simple turns, forgiving numbers. {allClasses ? "" : "The rest are one tap away."}
            </div>
            {classList.map(([k, cl]) => {
              const info = CLASSINFO[k] || {};
              return (
                <Opt key={k} on={c.cls === k} onClick={() => chooseClass(k)} title={cl.n} why={info.d}
                  tags={[
                    cl.hp + " HP per level",
                    "Key: " + cl.key.map((a) => a.toUpperCase()).join(" or "),
                    cl.casting ? "Spellcaster" : "No spells",
                    (cl.skills || 2) + " skills",
                    CXLABEL[info.cx || 2],
                  ]} />
              );
            })}
            <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={() => setAllClasses((v) => !v)}>
              {allClasses ? "Show just the beginner-friendly ones" : "Show all " + Object.keys(CLASSES).length + " classes"}
            </button>
          </div>

          {cls && (
            <div className="card">
              <h3 data-icon="gem">{cls.n} — a couple of details</h3>
              {subChoice && (
                <Field label={subChoice.label}>
                  <div className="mut xs" style={{ marginBottom: 5 }}>
                    Every {cls.n.toLowerCase()} picks one of these at level 1. It shapes your class features as you
                    level. If none of them mean anything to you yet, pick the one that sounds best — the Archives link
                    below has the full text.
                  </div>
                  <div className="row" style={{ flexWrap: "wrap" }}>
                    {(subChoice.opts || []).map((o) => (
                      <button key={o} className={"pill" + (c.subclass === o ? " on" : "")}
                        onClick={() => setChar(() => ({ subclass: o }))}>{o}</button>
                    ))}
                  </div>
                </Field>
              )}
              {cls.sub && !subChoice && (
                <div className="mut sm" style={{ marginBottom: 7 }}>
                  {cls.sub.label}: {(cls.sub.opts || [])[0]}. Nothing to decide today.
                </div>
              )}
              {cls.key.length > 1 && (
                <Field label="Key ability">
                  <div className="mut xs" style={{ marginBottom: 5 }}>
                    Your key ability gets a free boost and drives your class DC. {cls.n}s can build around more than one.
                  </div>
                  {cls.key.map((a) => (
                    <Opt key={a} on={keyAb === a} title={ABILNAME[a]} why={ABILINFO[a]}
                      onClick={() => setChar(() => ({ keyAbility: a, spellAbility: cls.casting ? a : c.spellAbility }))} />
                  ))}
                </Field>
              )}
              {cls.key.length === 1 && (
                <div className="sm">
                  Key ability: <strong>{ABILNAME[cls.key[0]]}</strong>. <span className="mut">{ABILINFO[cls.key[0]]}</span>
                </div>
              )}
              <div className="line" />
              <a className="link" href={aon(cls.n + " class")} target="_blank" rel="noreferrer">Read the {cls.n} on Archives of Nethys</a>
            </div>
          )}
        </>
      )}

      {key === "ancestry" && (
        <>
          <div className="card">
            <h3 data-icon="gem">What are you?</h3>
            <p className="sm" style={{ marginTop: 0 }}>
              Ancestry sets your starting hit points, your speed, your size and your senses, and gives you some ability
              boosts. It matters less mechanically than your class, so if one of them simply appeals to you, take it.
            </p>
            {Object.entries(ANCESTRIES).map(([k, a]) => (
              <Opt key={k} on={c.ancestry === k} onClick={() => chooseAnc(k)} title={a.n} why={ANCINFO[k]}
                tags={[
                  a.hp + " starting HP",
                  a.spd + " ft speed",
                  a.size,
                  a.vision !== "Normal" ? a.vision : null,
                  "+" + (a.b || []).map((x) => (x === "free" ? "free" : x.toUpperCase())).join(" +"),
                  a.f ? "−" + a.f.toUpperCase() : null,
                ]} />
            ))}
          </div>

          {anc && (
            <div className="card">
              <h3 data-icon="gem">Heritage</h3>
              <p className="sm" style={{ marginTop: 0 }}>
                A heritage is a variation within your ancestry — a {anc.n.toLowerCase()} raised somewhere particular, or
                born a little different. It's usually one small ability. Pick whichever fits your idea, or leave it and
                decide with your GM.
              </p>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {(anc.her || []).map((h) => (
                  <button key={h} className={"pill" + (c.heritage === h ? " on" : "")}
                    onClick={() => setChar(() => ({ heritage: c.heritage === h ? "" : h }))}>{h}</button>
                ))}
              </div>
              <Field label="Or type your own">
                <input value={c.heritage} placeholder="Anything not listed here"
                  onChange={(e) => setChar(() => ({ heritage: e.target.value }))} />
              </Field>
              {c.heritage && (
                <a className="link" href={aon(c.heritage)} target="_blank" rel="noreferrer">What does {c.heritage} do?</a>
              )}
            </div>
          )}
        </>
      )}

      {key === "background" && (
        <div className="card">
          <h3 data-icon="book">What were you doing before this?</h3>
          <p className="sm" style={{ marginTop: 0 }}>
            Your background is your old life. It gives you two ability boosts, trains you in one skill and one Lore, and
            hands you a free skill feat. Purely mechanically it's the smallest of the three choices, so pick the story
            you like — though the ones marked below line up with your {ABILNAME[keyAb]}.
          </p>
          <input placeholder="Search backgrounds" value={bgq} onChange={(e) => setBgq(e.target.value)} />
          <div style={{ marginTop: 9 }}>
            {bgList.map(([k, b]) => (
              <Opt key={k} on={c.background === k} onClick={() => chooseBg(k)} title={b.n}
                why={"Trained in " + (SKILLMAP[b.sk] || {}).name + " and " + b.lore + " Lore. Free feat: " + b.feat + "."}
                tags={[
                  "+" + b.b.map((x) => x.toUpperCase()).join(" or ") + ", +1 free",
                  b.b.includes(keyAb) ? "Boosts your " + keyAb.toUpperCase() : null,
                ]} />
            ))}
            {!bgList.length && <div className="empty">Nothing matches that search.</div>}
          </div>
          <div className="line" />
          <Opt on={c.background === "custom"} onClick={() => chooseBg("custom")} title="Write my own"
            why="Two free boosts and a Lore you name. You and your GM decide the trained skill and feat." />
          {c.background === "custom" && (
            <Field label="Background name">
              <input value={c.bgName || ""} placeholder="e.g. Retired lighthouse keeper"
                onChange={(e) => setChar(() => ({ bgName: e.target.value }))} />
            </Field>
          )}
        </div>
      )}

      {key === "abilities" && (
        <>
          <div className="card">
            <h3 data-icon="star">The six numbers</h3>
            <p className="sm" style={{ marginTop: 0 }}>
              Everyone starts with 10 in all six. You then get four batches of boosts: one from your ancestry, one from
              your background, one free from your class, and four more to place however you like. A boost adds 2 —
              or 1 once a score has reached 18.
            </p>
            <div className="note">
              The only rule that trips people up: <strong>within one batch, every boost must go to a different
              ability.</strong> Across batches you can stack them, which is how a key ability reaches 18.
            </div>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <button className="btn pri" onClick={() => setChar(() => recommendAbilities(c))}>
                Fill in a recommended {cls ? cls.n.toLowerCase() : ""} spread
              </button>
              <button className="btn" onClick={() => setChar(() => ({ ancFree: [], bgFree: [], bgPick: "", l1Free: [] }))}>Clear</button>
            </div>
            <div className="mut xs" style={{ marginTop: 6 }}>
              The recommendation puts your key ability at 18 and spends the rest on Constitution and the abilities your
              class leans on. It's a safe starting point, not the only good one.
            </div>
          </div>

          <div className="card">
            <h3 data-icon="star">Place your boosts</h3>
            {anc && (anc.b || []).filter((b) => b === "free").length > 0 && (
              <BoostRow label={"From your ancestry (" + anc.n + ")"}
                n={(anc.b || []).filter((b) => b === "free").length} vals={c.ancFree}
                fixed={(anc.b || []).filter((b) => b !== "free")} flaw={anc.f}
                hint={"Fixed boosts are shown on the right and are already counted." + (anc.f ? " The flaw takes 2 off " + ABILNAME[anc.f] + "." : "")}
                onChange={(v) => setChar(() => ({ ancFree: v }))} />
            )}
            {bgd && (
              <div style={{ marginBottom: 10 }}>
                <div className="sm" style={{ fontWeight: 600 }}>From your background ({bgd.n})</div>
                <div className="mut xs">One from the two the background offers, plus one of your choosing.</div>
                <div className="row" style={{ marginTop: 5, flexWrap: "wrap" }}>
                  {bgd.b.filter((b) => b !== "free").length === 2 ? (
                    <select style={{ width: 128 }} value={c.bgPick || bgd.b[0]}
                      onChange={(e) => setChar(() => ({ bgPick: e.target.value }))}>
                      {bgd.b.map((b) => <option key={b} value={b}>{ABILNAME[b]}</option>)}
                    </select>
                  ) : (
                    <select style={{ width: 104 }} value={(c.bgFree || [])[1] || ""}
                      onChange={(e) => { const nv = [...(c.bgFree || [])]; nv[1] = e.target.value; setChar(() => ({ bgFree: nv })); }}>
                      <option value="">—</option>
                      {ABIL.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                    </select>
                  )}
                  <select style={{ width: 104 }} value={(c.bgFree || [])[0] || ""}
                    onChange={(e) => { const nv = [...(c.bgFree || [])]; nv[0] = e.target.value; setChar(() => ({ bgFree: nv })); }}>
                    <option value="">Free —</option>
                    {ABIL.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
            )}
            {cls && (
              <div style={{ marginBottom: 10 }}>
                <div className="sm" style={{ fontWeight: 600 }}>From your class</div>
                <div className="mut xs">A free boost to {ABILNAME[keyAb]}, your key ability. Already counted below.</div>
              </div>
            )}
            <BoostRow label="Four free boosts" n={4} vals={c.l1Free}
              hint="Yours to place anywhere — four different abilities."
              onChange={(v) => setChar(() => ({ l1Free: v }))} />
            <div className="mut xs">Four more arrive at levels 5, 10, 15 and 20. Not your problem today.</div>
          </div>

          <div className="card">
            <h3 data-icon="star">Where that leaves you</h3>
            <div className="grid g6" style={{ marginBottom: 9 }}>
              {ABIL.map((a) => (
                <div className="stat" key={a}>
                  <div className="v">{dv.ab[a]}</div><div className="l">{a.toUpperCase()}</div><div className="s">{sgn(dv.m[a])}</div>
                </div>
              ))}
            </div>
            <div className="mut xs" style={{ marginBottom: 7 }}>
              The small number is the modifier — that's what gets added to rolls. 10 is +0, 18 is +4.
            </div>
            {ABIL.map((a) => (
              <div className="skrow" key={a}>
                <span className="sm" style={{ flex: 1 }}>
                  <strong>{ABILNAME[a]}</strong> <span className="mut">{ABILINFO[a]}</span>
                </span>
                <span className="mo">{sgn(dv.m[a])}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {key === "skills" && (
        <div className="card">
          <h3 data-icon="book">What are you good at?</h3>
          <p className="sm" style={{ marginTop: 0 }}>
            Being trained in a skill adds your level plus 2 to those rolls, which is an enormous difference from being
            untrained. {cls ? cls.n + "s" : "You"} get {cls ? cls.skills : 0}
            {dv.m.int > 0 ? " plus " + dv.m.int + " for your Intelligence" : ""} — {skillSlots} to choose
            {bgd && bgd.sk ? ", on top of " + (SKILLMAP[bgd.sk] || {}).name + " from your background" : ""}.
          </p>
          <div className="between" style={{ marginBottom: 9 }}>
            <strong className="sm">{trained.length} of {skillSlots} chosen</strong>
            {(CLASSINFO[c.cls] || {}).sk && (
              <button className="btn sm pri" onClick={() => {
                const taken = (k) => k === (bgd || {}).sk;
                const sug = ((CLASSINFO[c.cls] || {}).sk || []).filter((k) => !taken(k));
                /* Suggestions first, then broadly useful ones until the slots
                   are full — an incomplete answer to "just pick for me" isn't
                   an answer. All of it is one tap away from being changed. */
                const fill = SKILLFILL.filter((k) => !taken(k) && !sug.includes(k));
                setChar(() => ({ trainedSkills: [...sug, ...fill].slice(0, skillSlots) }));
              }}>Pick these for me</button>
            )}
          </div>
          {trained.length >= skillSlots && (
            <div className="note">That's all of them. To swap one out, tap a chosen skill to release it.</div>
          )}
          {SKILLS.map(([k, n, ab]) => {
            const fromBg = bgd && bgd.sk === k;
            const on = trained.includes(k);
            const full = !on && !fromBg && trained.length >= skillSlots;
            const suggested = ((CLASSINFO[c.cls] || {}).sk || []).includes(k);
            return (
              <button key={k} className={"opt" + (on || fromBg ? " on" : "")}
                style={full ? { opacity: .45 } : null}
                onClick={() => {
                  if (fromBg || full) return;
                  setChar(() => ({ trainedSkills: on ? trained.filter((x) => x !== k) : [...trained, k] }));
                }}>
                <div className="t">
                  <span>{n}</span>
                  <span className="badge">{ab.toUpperCase()}</span>
                  {fromBg ? <span className="tick">From background</span> : on ? <span className="tick">Trained ✓</span> : null}
                </div>
                <div className="why">{SKILLINFO[k]}{suggested && !on && !fromBg ? " · Usual pick for a " + cls.n.toLowerCase() : ""}</div>
              </button>
            );
          })}
          <div className="line" />
          <div className="mut xs">
            Lore skills — narrow subjects like Sailing or Heraldry — live on the Build tab. Your background already gave
            you one{bgd && bgd.lore ? ": " + bgd.lore + " Lore" : ""}.
          </div>
        </div>
      )}

      {key === "feats" && (
        <>
          <div className="card">
            <h3 data-icon="flag">Your two level 1 feats</h3>
            <p className="sm" style={{ marginTop: 0 }}>
              Feats are the small special things your character can do. At level 1 you pick one from your class and one
              from your ancestry{bgd && bgd.feat ? ", and your background already gave you " + bgd.feat : ""}. These are
              the most flavourful part of the sheet and also the easiest to change later, so don't agonise.
            </p>
            <div className="note">
              I only have feat names here, not their full text. Tap any name to read what it actually does on the
              Archives of Nethys, then come back and choose.
            </div>
          </div>

          <div className="card">
            <h3 data-icon="flag">{cls ? cls.n : "Class"} feat</h3>
            {cls && (cls.feat || []).filter(([, l]) => l <= 1).map(([n]) => (
              <div className="between" key={n} style={{ gap: 7, marginBottom: 7 }}>
                <button className={"opt" + (featAt1("class") === n ? " on" : "")} style={{ marginBottom: 0 }}
                  onClick={() => takeFeat("class", n)}>
                  <div className="t"><span>{n}</span>{featAt1("class") === n ? <span className="tick">Taken ✓</span> : null}</div>
                </button>
                <a className="btn sm" href={aon(n)} target="_blank" rel="noreferrer">Text</a>
              </div>
            ))}
          </div>

          <div className="card">
            <h3 data-icon="flag">{anc ? anc.n : "Ancestry"} feat</h3>
            {anc && (anc.feats || []).map((n) => (
              <div className="between" key={n} style={{ gap: 7, marginBottom: 7 }}>
                <button className={"opt" + (featAt1("ancestry") === n ? " on" : "")} style={{ marginBottom: 0 }}
                  onClick={() => takeFeat("ancestry", n)}>
                  <div className="t"><span>{n}</span>{featAt1("ancestry") === n ? <span className="tick">Taken ✓</span> : null}</div>
                </button>
                <a className="btn sm" href={aon(n)} target="_blank" rel="noreferrer">Text</a>
              </div>
            ))}
            {anc && !(anc.feats || []).length && <div className="empty">No feats listed for this ancestry — add one by hand on the Feats tab.</div>}
          </div>

          <div className="card">
            <div className="mut sm">Happy to leave these for now? Carry on — the Feats tab has the full list whenever you want it.</div>
          </div>
        </>
      )}

      {key === "finish" && (
        <>
          <div className="card">
            <h3 data-icon="gem">Nearly there</h3>
            <Field label="Character name"><input value={c.name} placeholder="What do people call you?"
              onChange={(e) => setChar(() => ({ name: e.target.value }))} /></Field>
            <Field label="Your name (optional)"><input value={c.player || ""} placeholder="Player"
              onChange={(e) => setChar(() => ({ player: e.target.value }))} /></Field>
          </div>

          <div className="card">
            <h3 data-icon="scroll">{c.name || "Your character"}</h3>
            <div className="sm" style={{ marginBottom: 9 }}>
              Level 1 {c.heritage ? c.heritage + " " : ""}{anc ? anc.n : ""} {cls ? cls.n : ""}
              {c.subclass ? " · " + c.subclass : ""}
              {bgd ? " · " + (c.background === "custom" && c.bgName ? c.bgName : bgd.n) : ""}
            </div>
            <div className="grid g4">
              <div className="stat"><div className="v">{dv.hpMax}</div><div className="l">HP</div></div>
              <div className="stat"><div className="v">{dv.ac}</div><div className="l">AC</div></div>
              <div className="stat"><div className="v">{sgn(dv.perception)}</div><div className="l">PERCEPTION</div></div>
              <div className="stat"><div className="v">{dv.speed}</div><div className="l">SPEED</div></div>
            </div>
            <div className="grid g3" style={{ marginTop: 8 }}>
              <div className="stat"><div className="v">{sgn(dv.saves.fortitude)}</div><div className="l">FORT</div></div>
              <div className="stat"><div className="v">{sgn(dv.saves.reflex)}</div><div className="l">REFLEX</div></div>
              <div className="stat"><div className="v">{sgn(dv.saves.will)}</div><div className="l">WILL</div></div>
            </div>
            <div className="mut xs" style={{ marginTop: 8 }}>
              Your AC is low until you buy armour — that's the next thing to do, not a mistake.
            </div>
          </div>

          <div className="card">
            <h3 data-icon="box">What's left</h3>
            <div className="chk">
              <div className={"dot" + ((c.weapons || []).length ? " done" : "")} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Buy armour and a weapon</div>
                <div className="mut sm">You start with 15 gp. The Gear tab prices everything and works out your AC and attack bonuses as you equip it.</div>
                <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { finish(); setTab("gear"); }}>Open Gear</button>
              </div>
            </div>
            <div className="chk">
              <div className={"dot" + (featAt1("class") && featAt1("ancestry") ? " done" : "")} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Level 1 feats</div>
                <div className="mut sm">
                  {featAt1("class") || "No class feat yet"} · {featAt1("ancestry") || "no ancestry feat yet"}
                </div>
              </div>
            </div>
            {dv.casts && (
              <div className="chk">
                <div className={"dot" + ((c.spellsKnown || []).length ? " done" : "")} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>Choose your spells</div>
                  <div className="mut sm">The Spells tab tracks your slots and cantrips.</div>
                  <button className="btn sm" style={{ marginTop: 6 }} onClick={() => { finish(); setTab("spells"); }}>Open Spells</button>
                </div>
              </div>
            )}
            <div className="chk">
              <div className="dot" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>Play</div>
                <div className="mut sm">The Play tab is the one you'll use at the table — tap any number to roll it.</div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="card">
        {blocker && <div className="note" style={{ margin: "0 0 10px" }}>{blocker}</div>}
        <div className="gnav" style={{ marginTop: 0 }}>
          <button className="btn" disabled={step === 1} style={step === 1 ? { opacity: .4 } : null}
            onClick={() => go(step - 1)}>Back</button>
          {step < GSTEPS.length ? (
            <button className="btn pri" disabled={!!blocker} style={{ flex: 1, padding: 11, opacity: blocker ? .5 : 1 }}
              onClick={() => !blocker && go(step + 1)}>
              {step === 1 ? "Start" : "Next: " + GSTEPS[step][1]}
            </button>
          ) : (
            <button className="btn pri" disabled={!!blocker} style={{ flex: 1, padding: 11, opacity: blocker ? .5 : 1 }}
              onClick={() => !blocker && finish()}>Finish — open my sheet</button>
          )}
        </div>
      </div>
    </>
  );
}

// ================= BUILD =================
function Build({ c, dv, setChar, setModal, setTab }) {
  if (c.setup) return <Guide c={c} dv={dv} setChar={setChar} setTab={setTab} />;
  return <BuildSheet c={c} dv={dv} setChar={setChar} setModal={setModal} />;
}

function BuildSheet({ c, dv, setChar, setModal }) {
  const cls = CLASSES[c.cls] || CLASSES.fighter;
  const anc = ANCESTRIES[c.ancestry] || ANCESTRIES.human;
  const bgd = BACKGROUNDS[c.background] || BACKGROUNDS.acolyte;
  const [openLevel, setOpenLevel] = useState(c.level);

  const freeAncCount = (anc.b || []).filter((b) => b === "free").length;
  const skillSlots = (cls.skills || 2) + Math.max(0, dv.m.int);

  const done = (lv, k) => {
    if (k === "classFeat") return (c.feats || []).some((f) => f.type === "class" && f.level === lv);
    if (k === "skillFeat") return (c.feats || []).some((f) => f.type === "skill" && f.level === lv);
    if (k === "generalFeat") return (c.feats || []).some((f) => f.type === "general" && f.level === lv);
    if (k === "ancestryFeat") return (c.feats || []).some((f) => f.type === "ancestry" && f.level === lv);
    if (k === "skillIncrease") return !!(c.skillIncreases || {})[lv];
    if (k === "boosts") return ((c.boosts || {})[lv] || []).filter(Boolean).length >= 4;
    if (k === "skills") return (c.trainedSkills || []).length >= skillSlots;
    return true;
  };

  const unchosen = [!c.cls && "class", !c.ancestry && "ancestry", !c.background && "background"].filter(Boolean);

  return (
    <>
      <div className="card">
        <div className="between">
          <div style={{ flex: 1 }}>
            <div className="sm" style={{ fontWeight: 700 }}>
              {unchosen.length ? "No " + unchosen.join(", ") + " chosen yet" : "Everything on one screen"}
            </div>
            <div className="mut xs">
              {unchosen.length
                ? "Until those are set the numbers below are placeholders."
                : "Prefer one question at a time, with the rules explained? Take the guided route."}
            </div>
          </div>
          <button className="btn sm pri" onClick={() => setChar(() => ({ setup: 1 }))}>Walk me through it</button>
        </div>
      </div>

      <div className="card">
        <h3 data-icon="gem">Identity</h3>
        <div className="cols">
          <div>
            <Field label="Character name"><input value={c.name} onChange={(e) => setChar(() => ({ name: e.target.value }))} /></Field>
            <Field label="Ancestry">
              <select value={c.ancestry} onChange={(e) => setChar(() => ({ ancestry: e.target.value, heritage: "", ancFree: [] }))}>
                <option value="">Not chosen yet</option>
                {Object.entries(ANCESTRIES).map(([k, a]) => <option key={k} value={k}>{a.n}</option>)}
              </select>
            </Field>
            <Field label="Heritage">
              <input list={"her-" + c.ancestry} value={c.heritage} placeholder="Choose or type your own"
                onChange={(e) => setChar(() => ({ heritage: e.target.value }))} />
              <datalist id={"her-" + c.ancestry}>
                {(anc.her || []).map((h) => <option key={h} value={h} />)}
              </datalist>
            </Field>
            <Field label="Background">
              <select value={c.background} onChange={(e) => setChar(() => ({ background: e.target.value, bgFree: [], bgPick: "" }))}>
                <option value="">Not chosen yet</option>
                {Object.entries(BACKGROUNDS).map(([k, b]) => <option key={k} value={k}>{b.n}</option>)}
              </select>
            </Field>
            {c.background === "custom" && (
              <Field label="Background name">
                <input value={c.bgName || ""} placeholder="e.g. Medicinal Clocksmith"
                  onChange={(e) => setChar(() => ({ bgName: e.target.value }))} />
              </Field>
            )}
            <div className="mut xs">
              {bgd.sk ? "Trains " + (SKILLMAP[bgd.sk] || {}).name + " and " + bgd.lore + " Lore" : ""}
              {bgd.feat ? " · " + bgd.feat : ""}
            </div>
          </div>
          <div>
            <Field label="Class">
              <select value={c.cls} onChange={(e) => {
                const nk = e.target.value; const ncls = CLASSES[nk];
                if (!ncls) { setChar(() => ({ cls: "", subclass: "", keyAbility: "", trainedSkills: [] })); return; }
                setChar(() => ({ cls: nk, subclass: "", keyAbility: ncls.key[0], spellAbility: ncls.key[0], trainedSkills: [] }));
              }}>
                <option value="">Not chosen yet</option>
                {Object.entries(CLASSES).map(([k, cl]) => <option key={k} value={k}>{cl.n}</option>)}
              </select>
            </Field>
            <Field label={cls.sub ? cls.sub.label : "Subclass"}>
              <select value={c.subclass} onChange={(e) => setChar(() => ({ subclass: e.target.value }))}>
                <option value="">Choose</option>
                {((cls.sub || {}).opts || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Key ability">
              <select value={c.keyAbility} onChange={(e) => setChar(() => ({ keyAbility: e.target.value }))}>
                {(cls.key || ["str"]).map((k) => <option key={k} value={k}>{ABILNAME[k]}</option>)}
              </select>
            </Field>
            <Field label="Level">
              <div className="row">
                <button className="btn" onClick={() => setChar(() => ({ level: clamp(c.level - 1, 1, 20) }))}>−</button>
                <strong style={{ fontSize: 22, minWidth: 34, textAlign: "center" }}>{c.level}</strong>
                <button className="btn pri" style={{ flex: 1 }} onClick={() => {
                  const nl = clamp(c.level + 1, 1, 20);
                  /* A level's worth of HP arrives at full strength — without
                     this, every level-up reads as having taken damage. */
                  const gain = (cls.hp || 8) + dv.m.con;
                  setChar((cur) => ({ level: nl, hp: cur.hp == null ? null : cur.hp + gain }));
                  setOpenLevel(nl);
                }}>Level up to {clamp(c.level + 1, 1, 20)}</button>
              </div>
            </Field>
          </div>
        </div>
        <div className="line" />
        <a className="link" href={aon(cls.n + " class")} target="_blank" rel="noreferrer">Read the {cls.n} on Archives of Nethys</a>
      </div>

      <div className="card">
        <h3 data-icon="star">Ability boosts</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>Each boost raises a score by 2, or by 1 once it's 18 or higher. Pick different abilities within the same batch.</p>
        {freeAncCount > 0 && (
          <BoostRow label={"Ancestry (" + anc.n + ")"} n={freeAncCount} vals={c.ancFree} fixed={(anc.b || []).filter((b) => b !== "free")} flaw={anc.f}
            onChange={(v) => setChar(() => ({ ancFree: v }))} />
        )}
        <div style={{ marginBottom: 10 }}>
          <div className="sm" style={{ fontWeight: 600 }}>{"Background (" + bgd.n + ")"}</div>
          <div className="mut xs">One boost from the background, plus one free boost.</div>
          <div className="row" style={{ marginTop: 5, flexWrap: "wrap" }}>
            {bgd.b.filter((b) => b !== "free").length === 2 ? (
              <select style={{ width: 128 }} value={c.bgPick || bgd.b[0]}
                onChange={(e) => setChar(() => ({ bgPick: e.target.value }))}>
                {bgd.b.map((b) => <option key={b} value={b}>{ABILNAME[b]}</option>)}
              </select>
            ) : (
              <select style={{ width: 104 }} value={(c.bgFree || [])[1] || ""}
                onChange={(e) => { const nv = [...(c.bgFree || [])]; nv[1] = e.target.value; setChar(() => ({ bgFree: nv })); }}>
                <option value="">—</option>
                {ABIL.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
            )}
            <select style={{ width: 104 }} value={(c.bgFree || [])[0] || ""}
              onChange={(e) => { const nv = [...(c.bgFree || [])]; nv[0] = e.target.value; setChar(() => ({ bgFree: nv })); }}>
              <option value="">Free —</option>
              {ABIL.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
        <BoostRow label="Level 1 free boosts" n={4} vals={c.l1Free} onChange={(v) => setChar(() => ({ l1Free: v }))} />
        {[5, 10, 15, 20].filter((l) => c.level >= l).map((l) => (
          <BoostRow key={l} label={"Level " + l} n={4} vals={(c.boosts || {})[l] || []}
            onChange={(v) => setChar(() => ({ boosts: { ...c.boosts, [l]: v } }))} />
        ))}
        <div className="line" />
        <div className="grid g6">
          {ABIL.map((a) => (
            <div className="stat" key={a}>
              <div className="v">{dv.ab[a]}</div><div className="l">{a.toUpperCase()}</div><div className="s">{sgn(dv.m[a])}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 data-icon="book">Trained skills</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>
          {cls.n}s train {cls.skills} skills plus your Intelligence modifier — {skillSlots} total, on top of the one from your background.
          You've picked {(c.trainedSkills || []).length}.
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          {SKILLS.map(([k, n]) => {
            const on = (c.trainedSkills || []).includes(k);
            const fromBg = bgd.sk === k;
            return (
              <button key={k} className={"pill" + (on || fromBg ? " on" : "")}
                onClick={() => {
                  if (fromBg) return;
                  const cur = c.trainedSkills || [];
                  setChar(() => ({ trainedSkills: on ? cur.filter((x) => x !== k) : [...cur, k] }));
                }}>
                {n}{fromBg ? " ·bg" : ""}
              </button>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3 data-icon="book">Lore skills</h3>
        {(c.lores || []).map((l, i) => (
          <div className="row" key={i} style={{ marginBottom: 7 }}>
            <input value={l.name} placeholder="Lore subject" style={{ flex: 1 }}
              onChange={(e) => setChar(() => ({ lores: c.lores.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} />
            <select style={{ width: 118 }} value={l.rank || 1}
              onChange={(e) => setChar(() => ({ lores: c.lores.map((x, j) => j === i ? { ...x, rank: +e.target.value } : x) }))}>
              {RANKS.slice(1).map((r, ri) => <option key={r} value={ri + 1}>{r}</option>)}
            </select>
            <button className="btn sm dan" onClick={() => setChar(() => ({ lores: c.lores.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <button className="btn sm" onClick={() => setChar(() => ({ lores: [...(c.lores || []), { name: "", rank: 1 }] }))}>Add a Lore</button>
      </div>

      <div className="card">
        <h3 data-icon="box">Manual adjustments</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>For anything the app can't derive — homebrew bonuses, a standing circumstance bonus, or matching a sheet you're importing.</p>
        <div className="grid g2">
          <Field label={"Bonus HP (max is " + dv.hpMax + ")"}>
            <input inputMode="numeric" value={c.hpBonus || 0}
              onChange={(e) => setChar(() => ({ hpBonus: parseInt(e.target.value.replace(/[^-\d]/g, ""), 10) || 0 }))} />
          </Field>
          <Field label={"AC adjustment (AC is " + dv.ac + ")"}>
            <input inputMode="numeric" value={c.acAdjust || 0}
              onChange={(e) => setChar(() => ({ acAdjust: parseInt(e.target.value.replace(/[^-\d]/g, ""), 10) || 0 }))} />
          </Field>
        </div>
        {!dv.cls.casting && (
          <div className="between" style={{ marginTop: 4 }}>
            <div style={{ flex: 1 }}>
              <div className="sm" style={{ fontWeight: 600 }}>Archetype spellcasting</div>
              <div className="mut xs">Turns on the Spells tab for a caster dedication.</div>
            </div>
            <button className={"btn sm" + (c.archetypeCasting ? " pri" : "")}
              onClick={() => setChar(() => ({ archetypeCasting: !c.archetypeCasting }))}>
              {c.archetypeCasting ? "On" : "Off"}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="between">
          <h3 data-icon="flag" style={{ margin: 0 }}>Level by level</h3>
          <span className="mut xs">Tap a level to see what it gives you</span>
        </div>
        <div className="row" style={{ flexWrap: "wrap", margin: "9px 0" }}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((lv) => (
            <button key={lv} className={"pill" + (openLevel === lv ? " on" : "")}
              style={lv > c.level ? { opacity: .4 } : null} onClick={() => setOpenLevel(lv)}>{lv}</button>
          ))}
        </div>
        {openLevel > c.level && <div className="mut sm">You haven't reached level {openLevel} yet. Here's what's waiting.</div>}
        {levelPlan(openLevel, cls).map((step, i) => (
          <div className="chk" key={i}>
            <div className={"dot" + (openLevel <= c.level && done(openLevel, step.k) ? " done" : "")} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{step.label}</div>
              {step.detail && <div className="mut sm">{step.detail}</div>}
              {step.k === "skillIncrease" && openLevel <= c.level && (
                <select style={{ marginTop: 6 }} value={(c.skillIncreases || {})[openLevel] || ""}
                  onChange={(e) => setChar(() => ({ skillIncreases: { ...c.skillIncreases, [openLevel]: e.target.value } }))}>
                  <option value="">Choose a skill to improve</option>
                  {SKILLS.map(([k, n]) => <option key={k} value={k}>{n} → {RANKS[Math.min(4, (dv.skills[k].rank || 0) + ((c.skillIncreases || {})[openLevel] === k ? 0 : 1))]}</option>)}
                </select>
              )}
              {["classFeat", "skillFeat", "generalFeat", "ancestryFeat"].includes(step.k) && openLevel <= c.level && (
                <div className="mut xs" style={{ marginTop: 4 }}>
                  {(c.feats || []).filter((f) => f.level === openLevel && f.type === step.k.replace("Feat", "")).map((f) => f.name).join(", ") || "Pick one on the Feats tab"}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 data-icon="shield">Proficiencies</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>Filled in from the {cls.n} class table. Change any of them if your build says otherwise — an archetype, a free-archetype rule, or a table I got wrong.</p>
        {[["perception", "Perception"], ["fortitude", "Fortitude"], ["reflex", "Reflex"], ["will", "Will"],
        ["unarmed", "Unarmed"], ["simple", "Simple weapons"], ["martial", "Martial weapons"], ["advanced", "Advanced weapons"],
        ["unarmored", "Unarmored"], ["light", "Light armor"], ["medium", "Medium armor"], ["heavy", "Heavy armor"],
        ["classDC", "Class DC"], ...(cls.casting ? [["spell", "Spell attacks & DC"]] : [])].map(([k, label]) => (
          <div className="skrow" key={k}>
            <span className="sm">{label}</span>
            <select style={{ width: 130 }} value={dv.ranks[k]}
              onChange={(e) => setChar(() => ({ profOverride: { ...c.profOverride, [k]: +e.target.value } }))}>
              {RANKS.map((r, i) => <option key={i} value={i}>{r}</option>)}
            </select>
          </div>
        ))}
        {Object.keys(c.profOverride || {}).length > 0 && (
          <button className="btn sm" style={{ marginTop: 9 }} onClick={() => setChar(() => ({ profOverride: {} }))}>
            Reset to the class table
          </button>
        )}
      </div>
    </>
  );
}

function BoostRow({ label, n, vals, onChange, fixed, flaw, hint }) {
  const v = vals || [];
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="between">
        <span className="sm" style={{ fontWeight: 600 }}>{label}</span>
        <span className="mut xs">
          {fixed && fixed.length ? "+" + fixed.map((f) => f.toUpperCase()).join(" +") : ""}
          {flaw ? "  −" + flaw.toUpperCase() : ""}
        </span>
      </div>
      {hint && <div className="mut xs">{hint}</div>}
      <div className="mut xs">Each boost in a batch must go to a different ability.</div>
      <div className="row" style={{ marginTop: 5, flexWrap: "wrap" }}>
        {Array.from({ length: n }, (_, i) => {
          const taken = [...(fixed || []), ...v.filter((x, j) => j !== i)].filter(Boolean);
          return (
            <select key={i} style={{ width: 104 }} value={v[i] || ""}
              onChange={(e) => { const nv = [...v]; nv[i] = e.target.value; onChange(nv); }}>
              <option value="">—</option>
              {ABIL.map((a) => (
                <option key={a} value={a} disabled={taken.includes(a)}>
                  {a.toUpperCase()}{taken.includes(a) ? " (used)" : ""}
                </option>
              ))}
            </select>
          );
        })}
      </div>
    </div>
  );
}

// ================= FEATS =================
function Feats({ c, dv, setChar }) {
  const cls = CLASSES[c.cls] || CLASSES.fighter;
  const anc = ANCESTRIES[c.ancestry] || ANCESTRIES.human;
  const [type, setType] = useState("class");
  const [q, setQ] = useState("");
  const [custom, setCustom] = useState({ name: "", note: "", level: c.level });

  const pool = useMemo(() => {
    if (type === "class") return (cls.feat || []).map(([n, l]) => ({ name: n, level: l, note: "" }));
    if (type === "ancestry") return (anc.feats || []).map((n) => ({ name: n, level: 1, note: "" }));
    if (type === "skill") return SKILL_FEATS.map(([n, l, note, sk]) => ({ name: n, level: l, note, sk }));
    return GENERAL_FEATS.map(([n, l, note]) => ({ name: n, level: l, note }));
  }, [type, c.cls, c.ancestry]);

  const filtered = pool.filter((f) =>
    f.level <= c.level && (!q || f.name.toLowerCase().includes(q.toLowerCase()) || (f.note || "").toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const take = (f, lv) => setChar(() => ({
    feats: [...(c.feats || []), { id: uid(), name: f.name, type, level: lv, note: f.note || "" }],
  }));
  const has = (n) => (c.feats || []).some((f) => f.name === n);
  const fav = (id) => setChar(() => ({
    favorites: (c.favorites || []).includes(id) ? c.favorites.filter((x) => x !== id) : [...(c.favorites || []), id],
  }));

  return (
    <>
      <div className="card">
        <h3 data-icon="flag">Your feats</h3>
        {(c.feats || []).length === 0 && <div className="empty">Nothing taken yet. Browse below and tap Take.</div>}
        {["ancestry", "class", "skill", "general"].map((t) => {
          const list = (c.feats || []).filter((f) => f.type === t).sort((a, b) => a.level - b.level);
          if (!list.length) return null;
          return (
            <div key={t} style={{ marginBottom: 10 }}>
              <div className="xs mut" style={{ fontWeight: 700, marginBottom: 3 }}>{t[0].toUpperCase() + t.slice(1)}</div>
              {list.map((f) => (
                <div className="ftrow" key={f.id}>
                  <div className="between">
                    <div style={{ flex: 1 }}>
                      <strong className="sm">{f.name}</strong> <span className="badge">L{f.level}</span>
                      {f.note ? <div className="mut xs">{f.note}</div> : null}
                    </div>
                    <div className="row">
                      <button className={"btn sm" + ((c.favorites || []).includes(f.id) ? " pri" : "")} onClick={() => fav(f.id)}>★</button>
                      <a className="btn sm" href={aon(f.name)} target="_blank" rel="noreferrer">Text</a>
                      <button className="btn sm dan" onClick={() => setChar(() => ({ feats: c.feats.filter((x) => x.id !== f.id) }))}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="row" style={{ flexWrap: "wrap", marginBottom: 9 }}>
          {[["class", cls.n], ["ancestry", anc.n], ["skill", "Skill"], ["general", "General"]].map(([k, l]) => (
            <button key={k} className={"pill" + (type === k ? " on" : "")} onClick={() => setType(k)}>{l}</button>
          ))}
        </div>
        <input placeholder="Search feats" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 9 }}>
          {filtered.map((f) => (
            <div className="ftrow" key={f.name + f.level}>
              <div className="between">
                <div style={{ flex: 1 }}>
                  <strong className="sm">{f.name}</strong> <span className="badge">L{f.level}</span>
                  {f.sk && f.sk !== "any" ? <span className="badge" style={{ marginLeft: 4 }}>{f.sk}</span> : null}
                  {f.note ? <div className="mut xs">{f.note}</div> : null}
                </div>
                <div className="row">
                  <a className="btn sm" href={aon(f.name)} target="_blank" rel="noreferrer">Text</a>
                  <button className="btn sm pri" disabled={has(f.name)} style={has(f.name) ? { opacity: .4 } : null}
                    onClick={() => take(f, f.level)}>{has(f.name) ? "Taken" : "Take"}</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty">Nothing matches. Try the Archives link below, then add it by hand.</div>}
        </div>
        <div className="line" />
        <a className="link" href={"https://2e.aonprd.com/Feats.aspx"} target="_blank" rel="noreferrer">Browse every feat on Archives of Nethys</a>
      </div>

      <div className="card">
        <h3 data-icon="flag">Add a feat by hand</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>For anything from a book I haven't bundled — archetypes, newer releases, homebrew.</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <input placeholder="Feat name" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} style={{ flex: 2, minWidth: 150 }} />
          <input placeholder="What it does" value={custom.note} onChange={(e) => setCustom({ ...custom, note: e.target.value })} style={{ flex: 3, minWidth: 160 }} />
          <button className="btn pri" onClick={() => {
            if (!custom.name.trim()) return;
            setChar(() => ({ feats: [...(c.feats || []), { id: uid(), name: custom.name, note: custom.note, type, level: c.level }] }));
            setCustom({ name: "", note: "", level: c.level });
          }}>Add</button>
        </div>
      </div>
    </>
  );
}

// ================= GEAR =================
function Gear({ c, dv, setChar, setModal }) {
  const [q, setQ] = useState("");
  const items = c.items || [];
  const addItem = (n, bulk, price) => setChar(() => ({ items: [...items, { id: uid(), name: n, bulk, price, qty: 1 }] }));
  const over = dv.bulk > dv.bulkLimit;

  return (
    <>
      <div className="card">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 data-icon="shield" style={{ margin: 0 }}>Worn</h3>
          <button className="btn sm" onClick={() => setModal("homebrew")}>Homebrew</button>
        </div>
        <div className="cols">
          <div>
            <Field label="Armor">
              <select value={c.armor} onChange={(e) => setChar(() => ({ armor: e.target.value }))}>
                {allArmors().map((a) => <option key={a.n} value={a.n}>{a.n}{a.hb ? " ★" : ""} {a.ac ? "(+" + a.ac + " AC)" : ""}</option>)}
              </select>
            </Field>
            <div className="row">
              <Field label="Potency rune">
                <select value={c.armorPotency || 0} onChange={(e) => setChar(() => ({ armorPotency: +e.target.value }))}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n ? "+" + n : "None"}</option>)}
                </select>
              </Field>
              <Field label="Resilient rune">
                <select value={c.armorResilient || 0} onChange={(e) => setChar(() => ({ armorResilient: +e.target.value }))}>
                  {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n ? "+" + n + " saves" : "None"}</option>)}
                </select>
              </Field>
            </div>
          </div>
          <div>
            <Field label="Shield">
              <select value={c.shield} onChange={(e) => setChar(() => ({ shield: e.target.value }))}>
                {allShields().map((s) => <option key={s.n} value={s.n}>{s.n}{s.hb ? " ★" : ""}{s.ac ? " (+" + s.ac + " AC)" : ""}</option>)}
              </select>
            </Field>
            <div className="mut sm">
              AC {dv.ac} = 10 {dv.armor.ac ? sgn(dv.armor.ac) + " armor" : ""} {sgn(dv.pb(dv.ranks[dv.armor.c] || 0))} proficiency {sgn(Math.min(dv.m.dex, dv.armor.dx))} Dex
              {dv.armor.dx < dv.m.dex ? " (capped)" : ""}{c.armorPotency ? " +" + c.armorPotency + " rune" : ""}
              {c.shieldRaised ? " +" + dv.shield.ac + " shield" : ""}
            </div>
            {dv.checkPen ? <div className="mut sm" style={{ marginTop: 6 }}>Check penalty {dv.checkPen} — you need Strength {dv.armor.st} to ignore it.</div> : null}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="between">
          <h3 data-icon="fire" style={{ margin: 0 }}>Weapons</h3>
          <span className="mut xs">Blank die and type follow the table</span>
        </div>
        {(c.weapons || []).map((w) => (
          <div className="ftrow" key={w.id}>
            <div className="between">
              <input value={w.name} onChange={(e) => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, name: e.target.value } : x) }))} style={{ flex: 1, marginRight: 8 }} />
              <button className="btn sm dan" onClick={() => setChar(() => ({ weapons: c.weapons.filter((x) => x.id !== w.id) }))}>×</button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <select value={w.potency || 0} style={{ width: 92 }} onChange={(e) => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, potency: +e.target.value } : x) }))}>
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n ? "+" + n : "no rune"}</option>)}
              </select>
              <select value={w.striking || 0} style={{ width: 118 }} onChange={(e) => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, striking: +e.target.value } : x) }))}>
                {[[0, "no striking"], [1, "striking"], [2, "greater"], [3, "major"]].map(([n, l]) => <option key={n} value={n}>{l}</option>)}
              </select>
              {(() => {
                const a = (dv.attacks || []).find((x) => x.id === w.id) || {};
                const setOver = (k, v) => setChar(() => ({
                  weapons: c.weapons.map((x) => x.id === w.id
                    ? { ...x, over: { ...(x.over || {}), [k]: v || undefined } } : x),
                }));
                return (
                  <>
                    {a.twoHand ? (
                      <button className={"btn sm" + (w.twoHanded ? " pri" : "")}
                        onClick={() => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, twoHanded: !x.twoHanded } : x) }))}>
                        {w.twoHanded ? "Both hands · d" + a.twoHand : "One hand"}
                      </button>
                    ) : null}
                    {a.versatile ? (
                      <button className={"btn sm" + (w.versatileAs ? " pri" : "")}
                        onClick={() => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, versatileAs: x.versatileAs ? "" : a.versatile } : x) }))}>
                        {w.versatileAs ? w.versatileAs + " damage" : "Versatile " + a.versatile}
                      </button>
                    ) : null}
                    <input value={(w.over || {}).d || ""} placeholder={a.dmg || w.die} style={{ width: 68 }}
                      aria-label="Damage die override"
                      onChange={(e) => setOver("d", e.target.value.trim())} />
                    <input value={(w.over || {}).t || ""} placeholder={a.dmgType || w.dmgType} style={{ width: 48 }}
                      aria-label="Damage type override"
                      onChange={(e) => setOver("t", e.target.value.trim().slice(0, 12))} />
                    {a.edited
                      ? <button className="btn sm" onClick={() => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, over: {} } : x) }))}>Reset</button>
                      : <span className="mut xs">{a.dmg} {a.dmgType}</span>}
                  </>
                );
              })()}
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <input value={w.extraDice || ""} placeholder="Extra dice, e.g. 1d4" style={{ width: 130 }}
                onChange={(e) => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, extraDice: e.target.value } : x) }))} />
              <input value={w.extraNote || ""} placeholder="what it's from, e.g. precision" style={{ flex: 1 }}
                onChange={(e) => setChar(() => ({ weapons: c.weapons.map((x) => x.id === w.id ? { ...x, extraNote: e.target.value } : x) }))} />
            </div>
          </div>
        ))}
        {(c.weapons || []).length === 0 && <div className="empty">Add weapons from the Play tab.</div>}
      </div>

      <div className="card">
        <div className="between">
          <h3 data-icon="box" style={{ margin: 0 }}>Inventory</h3>
          <span className={over ? "pill on" : "pill"}>Bulk {Math.round(dv.bulk * 10) / 10} / {dv.bulkLimit}</span>
        </div>
        {over && <div className="mut sm" style={{ color: "var(--crim)" }}>You're encumbered: −10 ft. Speed and clumsy 1.</div>}
        {items.map((i) => (
          <div className="skrow" key={i.id}>
            <div style={{ flex: 1 }}>
              <div className="sm">{i.name}</div>
              <div className="mut xs">{i.bulk ? i.bulk + " Bulk" : "negligible"} {i.price ? "· " + i.price + " gp" : ""}</div>
            </div>
            <div className="row">
              <button className="btn sm" onClick={() => setChar(() => ({ items: items.map((x) => x.id === i.id ? { ...x, qty: Math.max(1, (x.qty || 1) - 1) } : x) }))}>−</button>
              <strong style={{ minWidth: 20, textAlign: "center" }}>{i.qty || 1}</strong>
              <button className="btn sm" onClick={() => setChar(() => ({ items: items.map((x) => x.id === i.id ? { ...x, qty: (x.qty || 1) + 1 } : x) }))}>+</button>
              <button className="btn sm dan" onClick={() => setChar(() => ({ items: items.filter((x) => x.id !== i.id) }))}>×</button>
            </div>
          </div>
        ))}
        <div className="line" />
        <input placeholder="Search gear to add" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row" style={{ flexWrap: "wrap", marginTop: 8 }}>
          {allGear().filter(([n]) => !q || n.toLowerCase().includes(q.toLowerCase())).slice(0, 18).map(([n, b, p]) => (
            <button key={n} className="pill" onClick={() => addItem(n, b, p)}>{n} +</button>
          ))}
        </div>
        {q && !allGear().some(([n]) => n.toLowerCase().includes(q.toLowerCase())) && (
          <button className="btn sm pri" style={{ marginTop: 8 }} onClick={() => { addItem(q, 0.1, 0); setQ(""); }}>Add "{q}" as a custom item</button>
        )}
      </div>

      <div className="card">
        <h3 data-icon="coin">Coins</h3>
        <div className="grid g4">
          {[["pp", "Platinum"], ["gp", "Gold"], ["sp", "Silver"], ["cp", "Copper"]].map(([k, l]) => (
            <Field key={k} label={l}>
              <input inputMode="numeric" value={(c.coins || {})[k] || 0}
                onChange={(e) => setChar(() => ({ coins: { ...c.coins, [k]: +e.target.value.replace(/\D/g, "") || 0 } }))} />
            </Field>
          ))}
        </div>
      </div>
    </>
  );
}

// ================= SPELLS =================
function Spells({ c, dv, setChar, check }) {
  const cls = dv.cls;
  const custom = c.customSlots && Object.keys(c.customSlots).length ? c.customSlots : null;
  /* Devotion spells and caster dedications don't come with a prepared
     caster's slots. They start empty; Edit slots fills them in. */
  const slotted = cls.casting === "prepared" || cls.casting === "spontaneous";
  const slots = custom || (slotted ? FULL_CASTER_SLOTS[c.level] : null) || {};
  const used = c.slotsUsed || {};
  const [editSlots, setEditSlots] = useState(false);
  const [q, setQ] = useState("");
  const tradLetter = TRADITION_LETTER[c.spellTradition || cls.tradition] || null;
  const known = c.spellsKnown || [];

  const maxRank = Math.max(...Object.keys(slots).map(Number), 1, ...(c.spellsKnown || []).map((s) => s.rank || 0));
  const list = SPELLS.filter((s) =>
    s[1] <= maxRank && (!tradLetter || s[2].includes(tradLetter)) &&
    (!q || s[0].toLowerCase().includes(q.toLowerCase()))
  ).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  return (
    <>
      <div className="card">
        <div className="between">
          <h3 data-icon="star" style={{ margin: 0 }}>Spell slots</h3>
          <div className="row">
            <button className="btn sm" disabled={(c.focusCur || 0) >= (c.focusMax || 0)}
              onClick={() => setChar(() => ({ focusCur: clamp((c.focusCur || 0) + 1, 0, c.focusMax || 0) }))}>Refocus</button>
            <button className="btn sm" onClick={() => setChar(() => ({ slotsUsed: {}, focusCur: c.focusMax || 1 }))}>Rest &amp; refresh</button>
          </div>
        </div>
        <div className="grid g3" style={{ marginTop: 9 }}>
          <Stat v={dv.spellDC} l="Spell DC" s={RANKS[dv.ranks.spell]} />
          <Stat v={sgn(dv.spellAtk)} l="Spell attack" onClick={() => check("Spell attack", dv.spellAtk)} />
          <Stat v={(c.focusCur || 0) + "/" + (c.focusMax || 0)} l="Focus points"
            onClick={() => setChar(() => ({ focusCur: clamp((c.focusCur || 0) - 1, 0, c.focusMax || 0) }))} />
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="xs mut">Focus pool</span>
          <button className="btn sm" onClick={() => setChar(() => ({ focusMax: clamp((c.focusMax || 1) - 1, 0, 3) }))}>−</button>
          <button className="btn sm" onClick={() => setChar(() => ({ focusMax: clamp((c.focusMax || 1) + 1, 0, 3) }))}>+</button>
          {cls.tradition === "varies" && (
            <select style={{ width: 140, marginLeft: "auto" }} value={c.spellTradition || ""}
              onChange={(e) => setChar(() => ({ spellTradition: e.target.value }))}>
              <option value="">Any tradition</option>
              {["arcane", "divine", "occult", "primal"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
          <select style={{ width: 128 }} value={c.spellAbility || ""} onChange={(e) => setChar(() => ({ spellAbility: e.target.value }))}>
            <option value="">Key ability</option>
            {ABIL.map((a) => <option key={a} value={a}>{ABILNAME[a]}</option>)}
          </select>
          <button className="btn sm" onClick={() => setEditSlots((s) => !s)}>{editSlots ? "Done" : "Edit slots"}</button>
        </div>
        {editSlots && (
          <div style={{ marginTop: 8 }}>
            <div className="mut xs">Set your own slots per rank — useful for a caster dedication or a partial caster.</div>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => (
              <div className="skrow" key={r}>
                <span className="sm">Rank {r}</span>
                <Counter label="" v={(custom || slots)[r] || 0} set={(v) => {
                  const next = { ...(custom || slots) };
                  if (v <= 0) delete next[r]; else next[r] = clamp(v, 0, 6);
                  setChar(() => ({ customSlots: next }));
                }} />
              </div>
            ))}
            {custom && <button className="btn sm" style={{ marginTop: 6 }} onClick={() => setChar(() => ({ customSlots: null }))}>Back to the standard table</button>}
          </div>
        )}
        <div className="line" />
        {Object.keys(slots).map((r) => {
          const total = slots[r], u = used[r] || 0;
          return (
            <div className="skrow" key={r}>
              <span className="sm">Rank {r}</span>
              <div className="row">
                {Array.from({ length: total }, (_, i) => (
                  <button key={i} onClick={() => setChar(() => ({ slotsUsed: { ...used, [r]: i < u ? i : i + 1 } }))}
                    style={{
                      width: 22, height: 22, borderRadius: 6, border: "1px solid var(--line)",
                      background: i < u ? "var(--vio)" : "var(--pan2)",
                    }} aria-label={"slot " + (i + 1)} />
                ))}
                <span className="mut xs">{total - u} left</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3 data-icon="scroll">Your spells</h3>
        {known.length === 0 && <div className="empty">Nothing added yet. Search below to build your list.</div>}
        {known.map((s, i) => (
          <div className="skrow" key={i}>
            <div style={{ flex: 1 }}>
              <span className="sm" style={{ fontWeight: 600 }}>{s.name}</span>
              <span className="badge" style={{ marginLeft: 6 }}>{s.rank === 0 ? "cantrip" : "rank " + s.rank}</span>
              {s.note ? <div className="mut xs">{s.note}</div> : null}
            </div>
            <div className="row">
              <a className="btn sm" href={aon(s.name + " spell")} target="_blank" rel="noreferrer">Text</a>
              <button className="btn sm dan" onClick={() => setChar(() => ({ spellsKnown: known.filter((_, j) => j !== i) }))}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 data-icon="book">Add spells</h3>
        <input placeholder="Search spells" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ marginTop: 9 }}>
          {list.slice(0, 40).map((s) => (
            <div className="skrow" key={s[0]}>
              <div style={{ flex: 1 }}>
                <span className="sm" style={{ fontWeight: 600 }}>{s[0]}</span>
                <span className="badge" style={{ marginLeft: 6 }}>{s[1] === 0 ? "cantrip" : "rank " + s[1]}</span>
                <div className="mut xs">{s[3]}</div>
              </div>
              <button className="btn sm pri" onClick={() => setChar(() => ({ spellsKnown: [...known, { name: s[0], rank: s[1], note: s[3] }] }))}>Add</button>
            </div>
          ))}
          {q && list.length === 0 && (
            <button className="btn sm pri" onClick={() => { setChar(() => ({ spellsKnown: [...known, { name: q, rank: 1, note: "" }] })); setQ(""); }}>
              Add "{q}" by hand
            </button>
          )}
        </div>
        <div className="line" />
        <a className="link" href="https://2e.aonprd.com/Spells.aspx" target="_blank" rel="noreferrer">Every spell on Archives of Nethys</a>
      </div>
    </>
  );
}

// ================= NOTES / DATA =================
function Notes({ c, setChar, chars, setChars, setActiveId, saveState, hb, setHb }) {
  const [copied, setCopied] = useState(false);
  return (
    <>
      <div className="card">
        <h3 data-icon="scroll">Notes</h3>
        <textarea rows={10} value={c.notes || ""} onChange={(e) => setChar(() => ({ notes: e.target.value }))}
          placeholder="Party members, quest leads, what the innkeeper said…" />
      </div>
      <div className="card">
        <h3 data-icon="box">Your data</h3>
        <p className="mut sm" style={{ marginTop: 0 }}>
          Characters save to your Claude account one at a time, so opening this on your phone shows the same sheet you
          left on your laptop, and editing two characters on two devices won't cost you either one. Sheets refresh
          whenever you come back to the tab. Saving is automatic — {saveState === "err" ? "the last save failed, so keep a backup below." : "currently working."}
        </p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="btn" onClick={() => {
            navigator.clipboard.writeText(JSON.stringify({ chars, homebrew: hb }));
            setCopied(true); setTimeout(() => setCopied(false), 1800);
          }}>{copied ? "Copied" : "Copy backup"}</button>
          <button className="btn" onClick={() => {
            const copy = { ...c, id: "c" + uid(), name: c.name + " (copy)" };
            setChars([...chars, copy]); setActiveId(copy.id);
          }}>Duplicate this character</button>
        </div>
        <ImportBox label="Add a character from a backup or an export"
          onImport={(arr, hbIn) => {
            const have = new Set(chars.map((x) => x.id));
            const add = arr.map((x) => (have.has(x.id) ? { ...x, id: "c" + uid() } : x));
            setChars([...chars, ...add]); setActiveId(add[0] && add[0].id);
            if (hbIn && hbCount(hbIn)) setHb(hbUnion(hb, hbIn));
          }} />
      </div>
    </>
  );
}

function ImportBox({ onImport, label }) {
  const [v, setV] = useState(""); const [err, setErr] = useState("");
  return (
    <div style={{ marginTop: 12 }}>
      <div className="xs mut" style={{ marginBottom: 4, fontWeight: 600 }}>{label || "Restore from a backup"}</div>
      <textarea rows={2} value={v} placeholder="Paste it here" onChange={(e) => { setV(e.target.value); setErr(""); }} />
      {err && <div className="xs" style={{ color: "var(--crim)" }}>{err}</div>}
      <button className="btn sm" style={{ marginTop: 6 }} onClick={() => {
        try {
          const p0 = JSON.parse(v);
          const wrapped = p0 && !Array.isArray(p0) && Array.isArray(p0.chars);
          const p = wrapped ? p0.chars : Array.isArray(p0) ? p0 : [p0];
          if (!p.length || !p[0] || !p[0].cls) throw 0;
          onImport(p, wrapped && p0.homebrew ? hbSanitize(p0.homebrew) : null); setV("");
        } catch { setErr("That doesn't look like a character. Paste the whole thing you copied."); }
      }}>Add</button>
    </div>
  );
}

// ================= ASK CLAUDE =================
const OP_HELP = [
  '{"op":"setLevel","value":N}',
  '{"op":"damage","amount":N}  {"op":"heal","amount":N}  {"op":"tempHp","amount":N}',
  '{"op":"condition","key":"frightened","value":N}   // 0 clears it',
  '{"op":"addFeat","name":"...","featType":"class|skill|general|ancestry","level":N,"note":"one short line"}',
  '{"op":"removeFeat","name":"..."}',
  '{"op":"addWeapon","base":"<exact base weapon name>","name":"what you call it","potency":0,"striking":0}',
  '{"op":"addItem","name":"...","bulk":0.1,"qty":1}',
  '{"op":"addSpell","name":"...","rank":N,"note":"one short line"}',
  '{"op":"trainSkill","key":"athletics"}',
  '{"op":"skillIncrease","level":N,"key":"stealth"}',
  '{"op":"setField","key":"name|subclass|heritage|armor|shield|player","value":"..."}',
  '{"op":"useSlot","rank":N}',
  '{"op":"spendFocus"}  {"op":"heroPoint","delta":-1}',
  '{"op":"effect","name":"Bless","type":"status|circumstance|item|untyped","rounds":10,"note":"short","b":{"atk":1}}',
  '   // a temporary buff or debuff. Omit "rounds" for something that lasts until it is dismissed.',
  '   // b keys: ac atk dmg saves fort ref will per skill skill:<skillkey> speed classDC spellDC spellAtk',
  '{"op":"endEffect","name":"Bless"}   {"op":"clearEffects"}   {"op":"nextRound"}  // nextRound ticks every counter down',
  '{"op":"restAll"}   // full HP, slots, focus, clears conditions and effects',
  '--- homebrew: adds to the game\'s own tables, usable by every character forever ---',
  '{"op":"homebrewWeapon","n":"Name","c":"simple|martial|advanced|unarmed","d":"1d8","t":"S","tr":["agile","deadly d6"],"b":1,"p":10,"g":"sword","r":false}',
  '{"op":"homebrewArmor","n":"Name","c":"light|medium|heavy|unarmored","ac":4,"dx":1,"ck":-2,"sp":-5,"st":16,"b":2}',
  '{"op":"homebrewShield","n":"Name","ac":2,"hard":5,"hp":20,"bt":10,"b":1}',
  '{"op":"homebrewGear","n":"Name","b":0.1,"p":5,"note":"what it does"}',
  '{"op":"editWeapon","n":"Longsword","d":"1d10"}   // PATCH an entry: only the fields you name change.',
  '   // Works on printed items too — that files an override under the same name, it does not add a duplicate.',
  '   // Same shape for editArmor, editShield, editGear. Use "newName" to rename one.',
  '{"op":"restoreOriginal","n":"Longsword"}   // drop an override, put the printed stats back',
  '{"op":"removeHomebrew","n":"Name"}',
  '--- fixing one character\'s copy, leaving the tables alone ---',
  '{"op":"editCarried","name":"Old Reliable","d":"1d8","t":"S","potency":1,"striking":1,"extraDice":"1d6","extraNote":"flaming"}',
  '{"op":"resetCarried","name":"Old Reliable"}   // back to whatever the table says',
  '{"op":"editItem","name":"Torch","qty":5,"bulk":0.1,"price":0.01}',
  '{"op":"note","text":"appended to the notes tab"}',
].join("\n");

function describeOp(o) {
  switch (o.op) {
    case "setLevel": return "Set level to " + o.value;
    case "damage": return "Take " + o.amount + " damage";
    case "heal": return "Heal " + o.amount;
    case "tempHp": return "Set temporary HP to " + o.amount;
    case "condition": return (+o.value ? "Apply " : "Clear ") + o.key + (+o.value > 1 ? " " + o.value : "");
    case "addFeat": return "Take " + o.name + " (" + (o.featType || "class") + " feat, level " + (o.level || "?") + ")";
    case "removeFeat": return "Remove " + o.name;
    case "addWeapon": return "Add weapon: " + (o.name || o.base);
    case "addItem": return "Add " + (o.qty > 1 ? o.qty + "× " : "") + o.name;
    case "addSpell": return "Add spell: " + o.name + (o.rank ? " (rank " + o.rank + ")" : "");
    case "trainSkill": return "Become trained in " + ((SKILLMAP[o.key] || {}).name || o.key);
    case "skillIncrease": return "Level " + o.level + " skill increase → " + ((SKILLMAP[o.key] || {}).name || o.key);
    case "setField": return "Set " + o.key + " to " + o.value;
    case "useSlot": return "Spend a rank " + o.rank + " slot";
    case "spendFocus": return "Spend a focus point";
    case "heroPoint": return (o.delta > 0 ? "Gain " : "Spend ") + "a hero point";
    case "effect": return "Effect: " + (o.name || "?") + " — " + fxLabel({ b: o.b || o.bonus, type: o.type }) +
      (o.rounds ? " for " + o.rounds + " round" + (+o.rounds === 1 ? "" : "s") : " until dismissed");
    case "endEffect": return "End the " + o.name + " effect";
    case "clearEffects": return "Clear every temporary effect";
    case "nextRound": return "Advance one round";
    case "homebrewWeapon": return "Add to the weapon tables: " + o.n + " (" + (o.c || "martial") + ", " + (o.d || "1d6") + " " + (o.t || "B") + ")";
    case "homebrewArmor": return "Add to the armor tables: " + o.n + " (+" + (o.ac || 0) + " AC, " + (o.c || "medium") + ")";
    case "homebrewShield": return "Add to the shield tables: " + o.n + " (+" + (o.ac || 2) + " AC)";
    case "homebrewGear": return "Add to the gear list: " + o.n;
    case "removeHomebrew": return "Remove " + (o.n || o.name) + " from the homebrew library";
    case "editWeapon": case "editArmor": case "editShield": case "editGear": {
      const bits = Object.entries(opPatch(o)).filter(([k]) => k !== "n")
        .map(([k, v]) => (HB_FIELD[k] || k) + " → " + (Array.isArray(v) ? v.join(", ") : v));
      return "Edit " + (o.n || o.name) + " in the tables" + (bits.length ? ": " + bits.join(", ") : "");
    }
    case "restoreOriginal": return "Put the printed stats back for " + (o.n || o.name);
    case "editCarried": {
      const bits = Object.entries(o).filter(([k]) => !["op", "name", "n"].includes(k))
        .map(([k, v]) => (HB_FIELD[k] || k) + " → " + (Array.isArray(v) ? v.join(", ") : v));
      return "Change your " + (o.name || o.n) + (bits.length ? ": " + bits.join(", ") : "");
    }
    case "resetCarried": return "Reset your " + (o.name || o.n) + " to the table's stats";
    case "editItem": return "Update " + (o.name || o.n) + " in your inventory";
    case "restAll": return "Full rest: HP, slots, focus, conditions and effects reset";
    case "note": return "Add to notes";
    default: return o.op;
  }
}

const FIELD_OK = ["name", "subclass", "heritage", "armor", "shield", "player"];

const HB_OPS = ["homebrewWeapon", "homebrewArmor", "homebrewShield", "homebrewGear",
  "editWeapon", "editArmor", "editShield", "editGear", "removeHomebrew", "restoreOriginal"];

const GEAR_OBJ = () => GEAR.map(([n, b, p]) => ({ n, b, p }));
const HB_FIELD = {
  d: "damage die", t: "damage type", c: "category", tr: "traits", r: "ranged",
  b: "bulk", p: "price", g: "group", ac: "AC", dx: "Dex cap", ck: "check penalty",
  sp: "speed penalty", st: "Strength", hard: "hardness", hp: "HP", bt: "break threshold",
  newName: "name", extraDice: "extra dice", extraNote: "extra damage note",
  atkBonus: "attack bonus", dmgBonus: "damage bonus", qty: "quantity", note: "note",
};
// strip the op wrapper and let "name" stand in for "n"
const opPatch = (o) => {
  const q = { ...o };
  delete q.op;
  if (q.name && !q.n) q.n = q.name;
  delete q.name;
  if (q.newName) { q.n = q.newName; delete q.newName; }
  return q;
};

/* Homebrew ops change the game tables, not the character, so they run against
   the library instead of going through applyOps. */
function applyHbOps(hb, ops) {
  const n = { weapons: [...hb.weapons], armors: [...hb.armors], shields: [...hb.shields], gear: [...hb.gear] };
  const put = (key, e) => {
    const i = n[key].findIndex((x) => String(x.n).toLowerCase() === e.n.toLowerCase());
    if (i >= 0) n[key][i] = e; else n[key].push(e);
  };
  for (const o of ops) {
    try {
      switch (o.op) {
        case "homebrewWeapon": { const e = cleanWeapon(o); if (e.n) put("weapons", e); break; }
        case "homebrewArmor": { const e = cleanArmor(o); if (e.n) put("armors", e); break; }
        case "homebrewShield": { const e = cleanShield(o); if (e.n) put("shields", e); break; }
        case "homebrewGear": { const e = cleanGear(o); if (e.n) put("gear", e); break; }

        /* Edits are patches, not replacements: look up whatever the entry is
           right now — homebrew first, then the printed table — and change only
           the fields that were named. Editing a printed entry files an override
           under the same name, which restoreOriginal peels back off. */
        case "editWeapon": case "editArmor": case "editShield": case "editGear": {
          const kind = { editWeapon: "weapons", editArmor: "armors", editShield: "shields", editGear: "gear" }[o.op];
          const core = { weapons: WEAPONS, armors: ARMORS, shields: SHIELDS, gear: GEAR_OBJ() }[kind];
          const clean = { weapons: cleanWeapon, armors: cleanArmor, shields: cleanShield, gear: cleanGear }[kind];
          const want = lc(o.n || o.name);
          const cur = n[kind].find((x) => lc(x.n) === want) || core.find((x) => lc(x.n) === want) || null;
          const e = clean({ ...(cur || {}), ...opPatch(o) });
          if (!e.n) break;
          if (cur && lc(cur.n) !== lc(e.n)) put(kind, clean(cur));  // renamed: keep the original too
          put(kind, e);
          break;
        }
        case "restoreOriginal": {
          const nm = lc(o.n || o.name);
          ["weapons", "armors", "shields", "gear"].forEach((k) => {
            n[k] = n[k].filter((x) => !(lc(x.n) === nm && isCoreName(k, x.n)));
          });
          break;
        }
        case "removeHomebrew": {
          const nm = String(o.n || o.name || "").toLowerCase();
          ["weapons", "armors", "shields", "gear"].forEach((k) => {
            n[k] = n[k].filter((x) => String(x.n).toLowerCase() !== nm);
          });
          break;
        }
        default: break;
      }
    } catch (e) { /* skip a malformed entry rather than lose the rest */ }
  }
  return n;
}

const tickEffects = (list) => (list || [])
  .map((e) => (e.rounds == null ? e : { ...e, rounds: e.rounds - 1 }))
  .filter((e) => e.rounds == null || e.rounds > 0);

function applyOps(c, dv, ops) {
  const n = { ...c, conditions: { ...(c.conditions || {}) }, feats: [...(c.feats || [])],
    weapons: [...(c.weapons || [])], items: [...(c.items || [])], spellsKnown: [...(c.spellsKnown || [])],
    trainedSkills: [...(c.trainedSkills || [])], skillIncreases: { ...(c.skillIncreases || {}) },
    effects: [...(c.effects || [])],
    slotsUsed: { ...(c.slotsUsed || {}) } };
  if (n.hp == null) n.hp = dv.hpMax;
  for (const o of ops) {
    try {
      switch (o.op) {
        case "setLevel": n.level = clamp(+o.value || 1, 1, 20); break;
        case "damage": {
          let dmg = +o.amount || 0;
          const abs = Math.min(n.tempHp || 0, dmg); n.tempHp = (n.tempHp || 0) - abs; dmg -= abs;
          n.hp = n.hp - dmg;
          if (n.hp <= 0) { n.hp = 0; if (!n.dying) n.dying = 1 + (n.wounded || 0); }
          break;
        }
        case "heal":
          if (n.dying) { n.dying = 0; n.wounded = (n.wounded || 0) + 1; }
          n.hp = Math.min(dv.hpMax, n.hp + (+o.amount || 0)); break;
        case "tempHp": n.tempHp = +o.amount || 0; break;
        case "condition": n.conditions[o.key] = +o.value || 0; break;
        case "addFeat": n.feats.push({ id: uid(), name: o.name, type: o.featType || "class", level: +o.level || n.level, note: o.note || "" }); break;
        case "removeFeat": n.feats = n.feats.filter((f) => f.name.toLowerCase() !== String(o.name).toLowerCase()); break;
        case "addWeapon": {
          const b = allWeapons().find((x) => x.n.toLowerCase() === String(o.base || o.name).toLowerCase()) || {};
          n.weapons.push({ id: uid(), base: b.n || o.base || o.name, name: o.name || b.n || o.base,
            cat: b.c || "simple", die: b.d || "1d6", dmgType: b.t || "B", traits: b.tr || [], ranged: b.r,
            potency: +o.potency || 0, striking: +o.striking || 0 });
          break;
        }
        case "addItem": n.items.push({ id: uid(), name: o.name, bulk: +o.bulk || 0, price: +o.price || 0, qty: +o.qty || 1 }); break;

        /* Changes one character's copy without touching the tables — the rune
           that came out wrong, the GM's one-off tweak to this sword only. */
        case "editCarried": {
          const want = String(o.name || o.n || "").toLowerCase();
          n.weapons = n.weapons.map((w) => {
            if (w.name.toLowerCase() !== want && String(w.base).toLowerCase() !== want) return w;
            const over = { ...(w.over || {}) };
            if (o.d) over.d = /^\d*d\d+$/.test(String(o.d)) ? String(o.d) : over.d;
            if (o.t) over.t = String(o.t).slice(0, 12);
            if (o.c) over.c = ["unarmed", "simple", "martial", "advanced"].includes(o.c) ? o.c : over.c;
            if (Array.isArray(o.tr)) over.tr = o.tr.map(String);
            if (o.r != null) over.r = !!o.r;
            const x = { ...w, over };
            if (o.newName) x.name = String(o.newName);
            if (o.potency != null) x.potency = Math.max(0, Math.min(3, +o.potency || 0));
            if (o.striking != null) x.striking = Math.max(0, Math.min(3, +o.striking || 0));
            if (o.atkBonus != null) x.atkBonus = +o.atkBonus || 0;
            if (o.dmgBonus != null) x.dmgBonus = +o.dmgBonus || 0;
            if (o.extraDice != null) x.extraDice = String(o.extraDice);
            if (o.extraNote != null) x.extraNote = String(o.extraNote);
            return x;
          });
          break;
        }
        case "resetCarried":
          n.weapons = n.weapons.map((w) => (w.name.toLowerCase() === String(o.name || "").toLowerCase() ? { ...w, over: {} } : w));
          break;
        case "editItem": {
          const want = String(o.name || o.n || "").toLowerCase();
          n.items = n.items.map((i) => {
            if (i.name.toLowerCase() !== want) return i;
            const x = { ...i };
            if (o.newName) x.name = String(o.newName);
            if (o.bulk != null) x.bulk = +o.bulk || 0;
            if (o.price != null) x.price = +o.price || 0;
            if (o.qty != null) x.qty = Math.max(1, +o.qty || 1);
            return x;
          });
          break;
        }
        case "addSpell": n.spellsKnown.push({ name: o.name, rank: +o.rank || 0, note: o.note || "" }); break;
        case "trainSkill": if (SKILLMAP[o.key] && !n.trainedSkills.includes(o.key)) n.trainedSkills.push(o.key); break;
        case "skillIncrease": n.skillIncreases[+o.level || n.level] = o.key; break;
        case "setField": if (FIELD_OK.includes(o.key)) n[o.key] = o.value; break;
        case "useSlot": n.slotsUsed[o.rank] = (n.slotsUsed[o.rank] || 0) + 1; break;
        case "spendFocus": n.focusCur = clamp((n.focusCur || 0) - 1, 0, n.focusMax || 0); break;
        case "heroPoint": n.hero = clamp((n.hero || 0) + (+o.delta || -1), 0, 3); break;
        case "effect": {
          const b = o.b || o.bonus || {};
          const clean = {};
          Object.entries(b).forEach(([k, v]) => { if (+v) clean[k] = +v; });
          n.effects.push({
            id: uid(), name: o.name || "Effect",
            type: FX_TYPES.includes(o.type) ? o.type : "status",
            rounds: o.rounds == null || o.rounds === "" ? null : Math.max(1, +o.rounds || 1),
            note: o.note || "", b: clean,
          });
          break;
        }
        case "endEffect":
          n.effects = n.effects.filter((e) => String(e.name).toLowerCase() !== String(o.name).toLowerCase());
          break;
        case "clearEffects": n.effects = []; break;
        case "nextRound": n.effects = tickEffects(n.effects); break;
        case "restAll": n.hp = dv.hpMax; n.tempHp = 0; n.dying = 0; n.slotsUsed = {}; n.focusCur = n.focusMax || 0; n.conditions = {}; n.effects = []; break;
        case "note": n.notes = (n.notes ? n.notes + "\n" : "") + o.text; break;
        default: break;
      }
    } catch (e) { /* skip a malformed op rather than lose the rest */ }
  }
  return n;
}

function extractJson(text) {
  let t = String(text || "").replace(/```json|```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function AskPanel({ c, dv, setChar, auto, setAuto, hb, setHb, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(null);
  const [undo, setUndo] = useState(null);
  const [err, setErr] = useState("");
  const endRef = useRef(null);
  const before = useRef(null);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyVal, setKeyVal] = useState(() => apiKey.get());
  const needsKey = STANDALONE && !PROXY;

  /* Applying stores the whole pre-change character and the whole pre-change
     library, so one tap puts everything back. Homebrew lands first and
     synchronously, because an addWeapon later in the same batch has to be able
     to find the stat block it just defined. */
  const apply = (ops) => {
    const hbOps = ops.filter((o) => HB_OPS.includes(o.op));
    const charOps = ops.filter((o) => !HB_OPS.includes(o.op));
    before.current = { hb, char: null };
    if (hbOps.length) setHb(applyHbOps(hb, hbOps));
    if (charOps.length) setChar((cur) => { before.current.char = cur; return applyOps(cur, dv, charOps); });
    setPending(null);
    setUndo({ ops, at: Date.now() });
  };
  const undoAll = () => {
    const b = before.current;
    if (b && b.char) setChar(() => b.char);
    if (b && b.hb) setHb(b.hb);
    before.current = null;
    setUndo(null);
  };

  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: "end" }); }, [msgs, busy, pending]);

  const snapshot = () => {
    const sk = {}; SKILLS.forEach(([k]) => { sk[dv.skills[k].name] = { rank: RANKS[dv.skills[k].rank], mod: dv.skills[k].mod }; });
    return {
      name: c.name, level: c.level,
      ancestry: (ANCESTRIES[c.ancestry] || {}).n, heritage: c.heritage,
      background: (BACKGROUNDS[c.background] || {}).n,
      class: dv.cls.n, subclass: c.subclass, keyAbility: c.keyAbility,
      abilityScores: dv.ab, abilityModifiers: dv.m,
      hp: { current: c.hp == null ? dv.hpMax : c.hp, max: dv.hpMax, temp: c.tempHp || 0 },
      dying: c.dying || 0, wounded: c.wounded || 0, heroPoints: c.hero || 0,
      activeEffects: (c.effects || []).map((e) => ({
        name: e.name, bonusType: e.type, roundsLeft: e.rounds, bonuses: e.b,
      })),
      ac: dv.ac, saves: dv.saves, perception: dv.perception, speed: dv.speed,
      classDC: dv.classDC, spellDC: dv.spellDC, spellAttack: dv.spellAtk,
      focus: { current: c.focusCur, max: c.focusMax },
      slots: FULL_CASTER_SLOTS[c.level] || {}, slotsUsed: c.slotsUsed || {},
      skills: sk,
      strikes: dv.attacks.map((a) => ({ name: a.name, attack: a.atk, secondAttack: a.map1, thirdAttack: a.map2, damage: a.dmg + sgn(a.dmgMod) + " " + a.dmgType, traits: a.traits })),
      feats: (c.feats || []).map((f) => f.name + " (" + f.type + ", L" + f.level + ")"),
      spells: (c.spellsKnown || []).map((s) => s.name + (s.rank ? " r" + s.rank : " cantrip")),
      inventory: (c.items || []).map((i) => (i.qty > 1 ? i.qty + "× " : "") + i.name),
      armor: c.armor, shield: c.shield, conditions: c.conditions || {},
      trainedSkillKeys: c.trainedSkills || [], skillIncreases: c.skillIncreases || {},
      bulk: Math.round(dv.bulk * 10) / 10, bulkLimit: dv.bulkLimit,
    };
  };

  const send = async (text) => {
    const question = (text || q).trim();
    if (!question || busy) return;
    if (!apiReady()) { setErr("Add an Anthropic API key to use Ask Claude outside the Claude app."); setKeyOpen(true); return; }
    setQ(""); setErr(""); setPending(null);
    const history = [...msgs, { role: "user", content: question }];
    setMsgs(history); setBusy(true);

    const system =
      "You are a Pathfinder 2e assistant built into a player's character sheet. You answer questions about their " +
      "character and the rules, and you propose edits to the sheet.\n\n" +
      "CHARACTER SNAPSHOT (authoritative — these numbers already include conditions, runes and proficiency):\n" +
      JSON.stringify(snapshot()) + "\n\n" +
      "Rules:\n" +
      "- Quote numbers from the snapshot exactly. Never recompute or guess a modifier that is already given.\n" +
      "- If the player asks for a change, express it as ops. If they only asked a question, return an empty ops array.\n" +
      "- Anything temporary — a spell buff, a potion, a debuff, a stance, a GM ruling for the fight — is an effect op, " +
      "never a permanent edit to a score or a field. Give it the real bonus type so PF2 stacking works, and set rounds " +
      "when the duration is known (1 minute = 10 rounds).\n" +
      "- The snapshot's numbers already include every active effect, so do not add those bonuses again in your reply.\n" +
      "- Keep the reply under 80 words, plain text, no markdown, talking directly to the player.\n" +
      "- For rules text you are unsure about, use web search on 2e.aonprd.com before answering.\n" +
      "- Never invent a feat, spell or item that does not exist in Pathfinder 2e — UNLESS the player is clearly " +
      "describing homebrew or a GM ruling. Then write it as a homebrew op, which adds a real stat block to the game " +
      "tables for every character, and say plainly that you made it up.\n" +
      "- Balance homebrew against the closest printed item and mention what you used as the yardstick.\n" +
      "- Defining a homebrew weapon does not give it to the player. Follow it with addWeapon using the same name if " +
      "they want to carry it.\n" +
      "- To CORRECT something that is already there, use an edit op, not a fresh definition — edits patch only the " +
      "fields you name and leave the rest alone. Ask yourself which layer is wrong. If the entry itself is wrong for " +
      "everyone (a printed item with a typo, a homebrew stat block that needs tuning) use editWeapon/editArmor/" +
      "editShield/editGear. If only this character's copy differs (a rune, a GM ruling, a one-off) use editCarried, " +
      "which leaves the tables untouched. When it is genuinely ambiguous, say which you chose and why in one line.\n" +
      "- Never invent a feat, spell or item that does not exist.\n\n" +
      "Available ops:\n" + OP_HELP + "\n\n" +
      "Valid addWeapon base names: " + allWeapons().map((w) => w.n).join(", ") + "\n" +
      "Existing homebrew (edit by reusing the exact name): " +
      (hbCount(hb) ? HB_SECTIONS.map(([k, l]) => (hb[k].length ? l + ": " + hb[k].map((e) => e.n).join(", ") : "")).filter(Boolean).join(" | ") : "none") + "\n" +
      "Valid skill keys: " + SKILLS.map((s) => s[0]).join(", ") + "\n" +
      "Valid condition keys: " + CONDITIONS.map((x) => x.k).join(", ") + "\n\n" +
      'Respond with ONE JSON object and nothing else: {"reply":"...","ops":[...]}';

    try {
      const res = await callClaude({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403
        ? "The API key was rejected. Check it in Key settings."
        : "The request came back " + res.status + ".");
      const data = await res.json();
      const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      const j = extractJson(text);
      if (!j) {
        setMsgs((m) => [...m, { role: "assistant", content: text || "I couldn't read that response. Try rephrasing?" }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: j.reply || "Done." }]);
        const ops = Array.isArray(j.ops) ? j.ops.filter((o) => o && o.op) : [];
        if (ops.length) { if (auto) apply(ops); else setPending(ops); }
      }
    } catch (e) {
      setErr("Couldn't reach Claude. Check your connection and try again.");
    }
    setBusy(false);
  };

  const chips = [
    "What are my best three actions this turn?",
    "I took " + Math.max(3, Math.round(dv.hpMax / 5)) + " damage",
    "Level me up and show what I need to pick",
    "What's my best attack against AC 22?",
    "The cleric cast bless on me",
    "My GM made me a weapon, can you stat it?",
    "My kukri should be d6, not d4",
    "Explain how my class DC is used",
  ];

  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheetin" style={{ maxWidth: 640, display: "flex", flexDirection: "column", height: "88vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="between" style={{ marginBottom: 10 }}>
          <div>
            <strong style={{ fontSize: 16, fontFamily: "var(--fontd)" }}>Ask Claude</strong>
            <div className="mut xs">
              Knows {c.name}'s full sheet. {auto ? "Edits land straight on it — undo is one tap." : "Any change is yours to approve."}
            </div>
          </div>
          <button className={"btn sm" + (auto ? " pri" : "")} onClick={() => setAuto(!auto)}
            title="Apply Claude's edits without asking first">
            {auto ? "Auto-apply on" : "Auto-apply off"}
          </button>
          {needsKey && (
            <button className={"btn sm" + (apiKey.get() ? "" : " pri")} onClick={() => setKeyOpen((k) => !k)}>Key</button>
          )}
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
          {msgs.length === 0 && (
            <div style={{ marginBottom: 10 }}>
              <div className="mut sm" style={{ marginBottom: 8 }}>
                Ask about your numbers, the rules, or what to do on your turn — or just tell it what happened and let it
                update the sheet.
              </div>
              {chips.map((ch) => (
                <button key={ch} className="pill" style={{ margin: "0 5px 6px 0" }} onClick={() => send(ch)}>{ch}</button>
              ))}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={"bub " + (m.role === "user" ? "me" : "cl")}>{m.content}</div>
          ))}
          {busy && <div className="bub cl mut">Thinking…</div>}
          {pending && (
            <div className="opsbox">
              <div className="sm" style={{ fontWeight: 700, marginBottom: 5 }}>Proposed changes</div>
              {pending.map((o, i) => (
                <div className="opline" key={i}><span>·</span><span>{describeOp(o)}</span></div>
              ))}
              <div className="row" style={{ marginTop: 9 }}>
                <button className="btn sm pri" onClick={() => apply(pending)}>
                  Apply {pending.length === 1 ? "change" : "all " + pending.length}
                </button>
                <button className="btn sm" onClick={() => setPending(null)}>Discard</button>
              </div>
            </div>
          )}
          {keyOpen && (
            <div className="opsbox">
              <div className="sm" style={{ fontWeight: 700, marginBottom: 2 }}>Anthropic API key</div>
              <div className="mut xs" style={{ marginBottom: 6 }}>
                Stored in this browser only, never sent anywhere but Anthropic. Anyone who can open this page's dev
                tools can read it, so use a key you're willing to rotate — and put a proxy in front of it instead if
                other people play on your copy.
              </div>
              <input type="password" value={keyVal} placeholder="sk-ant-..." autoComplete="off"
                onChange={(e) => setKeyVal(e.target.value.trim())} style={{ width: "100%" }} />
              <div className="row" style={{ marginTop: 6 }}>
                <button className="btn sm pri" onClick={() => { apiKey.set(keyVal); setKeyOpen(false); setErr(""); }}>Save</button>
                <button className="btn sm" onClick={() => { apiKey.set(""); setKeyVal(""); }}>Clear</button>
                <span className="mut xs" style={{ alignSelf: "center" }}>
                  {apiKey.get() ? "A key is saved." : "No key saved."}
                </span>
              </div>
            </div>
          )}
          {undo && (
            <div className="opsbox">
              <div className="between">
                <div className="sm">
                  <strong>{undo.ops.length === 1 ? "Change applied" : undo.ops.length + " changes applied"}</strong>
                  <div className="mut xs">{undo.ops.map(describeOp).join(" \u00b7 ")}</div>
                </div>
                <button className="btn sm" onClick={undoAll}>Undo</button>
              </div>
            </div>
          )}
          {err && <div className="bub cl" style={{ borderColor: "var(--crim)" }}>{err}</div>}
          <div ref={endRef} />
        </div>

        <div className="row" style={{ marginTop: 10 }}>
          <input value={q} placeholder="Ask anything about your character" autoFocus
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button className="btn pri" disabled={busy} onClick={() => send()}>Send</button>
        </div>
      </div>
    </div>
  );
}

// ================= DICE =================
// nun, gimel, hey, shin — what a dreidel shows while it's still going.
const DREIDEL_FACES = ["\u05E0", "\u05D2", "\u05D4", "\u05E9"];

function DiceOverlay({ roll, onDone, theme }) {
  const [face, setFace] = useState(1);
  const [phase, setPhase] = useState("rolling");
  useEffect(() => {
    setPhase("rolling");
    /* On the goblin theme the die is a dreidel, so it turns up Hebrew letters
       on the way round and the actual result when it settles. Letters read
       better a little slower than tumbling digits. */
    const spinning = theme === "candlelit";
    const tick = () => setFace(spinning
      ? DREIDEL_FACES[Math.floor(Math.random() * 4)]
      : 1 + Math.floor(Math.random() * (roll.cycleMax || 20)));
    tick();
    const iv = setInterval(tick, spinning ? 105 : 55);
    const land = setTimeout(() => {
      clearInterval(iv);
      setFace(roll.face);
      setPhase(roll.glow || "land");
    }, 620);
    const done = setTimeout(onDone, 2200);
    return () => { clearInterval(iv); clearTimeout(land); clearTimeout(done); };
  }, [roll.id, theme]);

  const landed = phase !== "rolling";
  return (
    <div className="dicewrap" onClick={onDone} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") onDone(); }}>
      <div className="die" data-phase={phase}>{face}</div>
      <div className="critter" data-squash={phase === "crit" ? "1" : "0"} data-bite={phase === "fumble" ? "1" : "0"} />
      {phase === "crit" && <div className="coinpop"><i /><i /><i /></div>}
      <div className="dicelabel">{roll.label}</div>
      {landed && <div className="dicemath">{roll.math}</div>}
      {landed && roll.verdict && (
        <div className={"diceverdict " + (phase === "fumble" ? "fumble" : "crit")}>{roll.verdict}</div>
      )}
      {landed && roll.big != null && <div className="big" style={{ fontSize: 30 }}>{roll.big}</div>}
      <div className="dicehint">Tap anywhere to dismiss</div>
    </div>
  );
}
