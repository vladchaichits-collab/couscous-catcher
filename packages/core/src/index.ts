export type Rarity =
  | "COMMON"
  | "UNCOMMON"
  | "RARE"
  | "EPIC"
  | "LEGENDARY"
  | "MYTHIC";

export type Context = "clock" | "ultimate";

export type TimeParts = {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

export type Pattern = {
  id: string;
  name: string;
  rarity: Rarity;
  rank: number;
  hidden?: boolean;
  description: string;
};

export type PatternMatch = Pattern & {
  primary: boolean;
};

export type AccuracyTier = {
  id: "PERFECT" | "CRISPY" | "CLEAN" | "GOOD" | "LATE" | "DIRTY";
  label: string;
  maxMs: number;
};

export const ACCURACY_TIERS: AccuracyTier[] = [
  { id: "PERFECT", label: "PERFECT", maxMs: 99 },
  { id: "CRISPY", label: "CRISPY", maxMs: 499 },
  { id: "CLEAN", label: "CLEAN", maxMs: 999 },
  { id: "GOOD", label: "GOOD", maxMs: 4999 },
  { id: "LATE", label: "LATE", maxMs: 29999 },
  { id: "DIRTY", label: "DIRTY COUSCOUS", maxMs: 59999 }
];

export function getAccuracyMs(t: TimeParts) {
  return t.second * 1000 + t.millisecond;
}

export function getAccuracyTier(ms: number) {
  return ACCURACY_TIERS.find((tier) => ms <= tier.maxMs) ?? ACCURACY_TIERS[ACCURACY_TIERS.length - 1];
}

const pattern = (
  id: string,
  name: string,
  rarity: Rarity,
  rank: number,
  description: string,
  hidden = false
): Pattern => ({ id, name, rarity, rank, description, hidden });

export const PATTERN_CATALOG: Pattern[] = [
  pattern("couscous", "COUSCOUS", "COMMON", 10, "The hour and minute match."),
  pattern("mirror", "MIRROR COUSCOUS", "UNCOMMON", 20, "The time mirrors itself."),
  pattern("double", "DOUBLE", "RARE", 30, "Four identical digits."),
  pattern("sequence", "SEQUENCE", "RARE", 32, "A clean ascending sequence."),
  pattern("reverse", "REVERSE", "RARE", 32, "A clean descending sequence."),
  pattern("noon", "NOON", "RARE", 35, "Exactly 12:00."),
  pattern("jackpot", "JACKPOT", "EPIC", 45, "Lucky sevens.", true),
  pattern("beast", "THE BEAST", "EPIC", 46, "A cursed 06:06.", true),
  pattern("pi", "PI", "EPIC", 47, "3.14, hidden in the clock.", true),
  pattern("420", "THE 420", "EPIC", 47, "You know why.", true),
  pattern("elite", "ELITE", "EPIC", 48, "13:37. Internet archaeology.", true),
  pattern("angel", "ANGEL", "LEGENDARY", 60, "11:11. The classic angel number.", true),
  pattern("midnight", "MIDNIGHT", "LEGENDARY", 62, "The first instant of a new day."),
  pattern("perfect-couscous", "PERFECT COUSCOUS", "MYTHIC", 90, "A couscous caught inside the first 100 ms.", true)
];

const byId = (id: string) => PATTERN_CATALOG.find((p) => p.id === id)!;
const reverse2 = (value: number) => String(value).padStart(2, "0").split("").reverse().join("");

export function detectClockPatterns(t: TimeParts): PatternMatch[] {
  const found: Pattern[] = [];
  const add = (id: string) => {
    const p = byId(id);
    if (!found.some((x) => x.id === id)) found.push(p);
  };

  const hh = String(t.hour).padStart(2, "0");
  const mm = String(t.minute).padStart(2, "0");
  const four = `${hh}${mm}`;

  if (t.hour === t.minute) add("couscous");
  if (hh === reverse2(t.minute) && hh !== mm) add("mirror");
  if (/^(\d)\1{3}$/.test(four)) add("double");
  if (four === "1234") add("sequence");
  if (four === "4321") add("reverse");
  if (t.hour === 12 && t.minute === 0) add("noon");
  if (t.hour === 7 && t.minute === 7) add("jackpot");
  if (t.hour === 6 && t.minute === 6) add("beast");
  if (t.hour === 3 && t.minute === 14) add("pi");
  if (t.hour === 4 && t.minute === 20) add("420");
  if (t.hour === 13 && t.minute === 37) add("elite");
  if (t.hour === 11 && t.minute === 11) add("angel");
  if (t.hour === 0 && t.minute === 0) add("midnight");

  const accuracy = getAccuracyMs(t);
  if (t.hour === t.minute && accuracy <= 99) add("perfect-couscous");

  found.sort((a, b) => b.rank - a.rank);
  return found.map((p, index) => ({ ...p, primary: index === 0 }));
}

export function detectUltimatePatterns(t: TimeParts): PatternMatch[] {
  // Ultimate interprets stopwatch MM:SS as the same two-number field as clock HH:MM.
  return detectClockPatterns({
    hour: t.hour,
    minute: t.minute,
    second: t.second,
    millisecond: t.millisecond
  });
}

export function getPrimary(matches: PatternMatch[]) {
  return matches[0] ?? null;
}

export function isCatchable(matches: PatternMatch[]) {
  return matches.length > 0;
}

export function rarityScore(rarity: Rarity) {
  return {
    COMMON: 100,
    UNCOMMON: 250,
    RARE: 600,
    EPIC: 1500,
    LEGENDARY: 4000,
    MYTHIC: 10000
  }[rarity];
}
