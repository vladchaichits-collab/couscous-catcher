import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PATTERN_CATALOG,
  detectClockPatterns,
  detectUltimatePatterns,
  getAccuracyMs,
  getAccuracyTier,
  getPrimary,
  rarityScore,
  type PatternMatch,
  type TimeParts
} from "@couscous/core";
import "./styles.css";

type Mode = "catch" | "ultimate" | "collection";

type SavedCatch = {
  id: string;
  timestamp: number;
  localDate: string;
  localTime: string;
  eventKey: string;
  mode: "clock" | "ultimate";
  accuracyMs: number;
  accuracyTier: string;
  primaryPattern: string;
  matchedPatterns: string[];
  rarity: string;
  score: number;
};

const STORAGE_KEY = "cc:v02:catches";
const DISCOVERED_KEY = "cc:v02:discovered";

const pad = (n: number, size = 2) => String(n).padStart(size, "0");

function timeParts(d = new Date()): TimeParts {
  return {
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    millisecond: d.getMilliseconds()
  };
}

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localTimeString(d: Date, withMs = true) {
  const t = timeParts(d);
  return `${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}${withMs ? `.${pad(t.millisecond, 3)}` : ""}`;
}

function clockString(d: Date) {
  const t = timeParts(d);
  return `${pad(t.hour)}:${pad(t.minute)}:${pad(t.second)}`;
}

function loadCatches(): SavedCatch[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function loadDiscovered(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISCOVERED_KEY) || "[]");
  } catch {
    return [];
  }
}

function persist(catches: SavedCatch[], discovered: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catches));
  localStorage.setItem(DISCOVERED_KEY, JSON.stringify(discovered));
}

function nextBaseCouscous(now: Date) {
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  let hour = now.getHours();

  if (now.getMinutes() >= hour) hour += 1;

  if (hour <= 23) {
    candidate.setHours(hour, hour, 0, 0);
    if (candidate > now) return candidate;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function countdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

function currentStreak(catches: SavedCatch[]) {
  const days = new Set(catches.filter(c => c.mode === "clock").map(c => c.localDate));
  let d = new Date();
  let streak = 0;

  // A day in progress doesn't break the streak until it ends.
  if (!days.has(localDateKey(d))) d.setDate(d.getDate() - 1);

  for (let i = 0; i < 3660; i++) {
    if (!days.has(localDateKey(d))) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}
const POSTHOG_KEY = "phc_prrPAT65iLHiu6b2GcvcjynqHbLcmDoRLFr5CZkAszK8"; const POSTHOG_HOST = "https://eu.i.posthog.com";
const ANALYTICS_ID_KEY = "cc:v02:analytics-id";
function getAnalyticsId() { let id = localStorage.getItem(ANALYTICS_ID_KEY);
if (!id) { id = crypto.randomUUID(); localStorage.setItem(ANALYTICS_ID_KEY, id); }
return id; }
function track(event: string, properties: Record<string, unknown> = {}) { try { void fetch(POSTHOG_HOST + "/i/v0/e/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ api_key: POSTHOG_KEY, event, distinct_id: getAnalyticsId(), properties: { ...properties, app: "couscous-catcher", version: "0.2" } }), keepalive: true }); } catch {} }
function App() {
  
  const [mode, setMode] = useState<Mode>("catch");
  const [now, setNow] = useState(new Date());
  const [catches, setCatches] = useState<SavedCatch[]>(loadCatches);
  const [discovered, setDiscovered] = useState<string[]>(loadDiscovered);
  const [result, setResult] = useState<SavedCatch | { miss: true; localTime: string } | null>(null);
useEffect(() => {
  track("app_open");
}, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 40);
    return () => window.clearInterval(id);
  }, []);

  const streak = useMemo(() => currentStreak(catches), [catches]);
  const today = localDateKey(now);
  const todayClockCatches = catches.filter(c => c.mode === "clock" && c.localDate === today);
  const todayHours = new Set(
    todayClockCatches
      .filter(c => c.matchedPatterns.includes("couscous"))
      .map(c => Number(c.eventKey.split(":")[1]))
  );
  const dailyGoal = Math.min(todayClockCatches.length, 3);

  const doClockCatch = () => {
    const d = new Date();
    const t = timeParts(d);
    const matches = detectClockPatterns(t);
    const primary = getPrimary(matches);
    const localTime = localTimeString(d, true);

    if (!primary) {
      setResult({ miss: true, localTime });
      track("catch_miss", {
  reason: "no_pattern"
});
      haptic(12);
      return;
    }

    const eventKey = `clock:${localDateKey(d)}:${pad(t.hour)}:${pad(t.minute)}`;
    const duplicate = catches.some(c => c.eventKey === eventKey);

    if (duplicate) {
      setResult({ miss: true, localTime });
      track("catch_miss", {
  reason: "duplicate"
});
      haptic([10, 35, 10]);
      return;
    }

    const accuracyMs = getAccuracyMs(t);
    const tier = getAccuracyTier(accuracyMs);
    const item: SavedCatch = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      localDate: localDateKey(d),
      localTime,
      eventKey,
      mode: "clock",
      accuracyMs,
      accuracyTier: tier.label,
      primaryPattern: primary.id,
      matchedPatterns: matches.map(m => m.id),
      rarity: primary.rarity,
      score: matches.reduce((sum, m) => sum + rarityScore(m.rarity), 0)
    };

    const nextCatches = [...catches, item];
    const nextDiscovered = Array.from(new Set([...discovered, ...item.matchedPatterns]));
    setCatches(nextCatches);
    setDiscovered(nextDiscovered);
    persist(nextCatches, nextDiscovered);
    setResult(item);
    track("catch_success", {
  mode: item.mode,
  primary_pattern: item.primaryPattern,
  matched_patterns: item.matchedPatterns,
  rarity: item.rarity,
  accuracy_ms: item.accuracyMs,
  accuracy_tier: item.accuracyTier,
  score: item.score
});
    haptic(primary.rank >= 60 ? [50, 35, 90, 35, 140] : [35, 25, 60]);
  };

  const shareCatch = async (item: SavedCatch) => {
track("share_clicked", {
  mode: item.mode,
  primary_pattern: item.primaryPattern,
  rarity: item.rarity,
  score: item.score
});
    const primary = PATTERN_CATALOG.find(p => p.id === item.primaryPattern);
    const text =
      `${primary?.name || item.primaryPattern} CAUGHT\n` +
      `${item.localTime}\n` +
      `+${item.accuracyMs} ms · ${item.accuracyTier}\n` +
      `🔥 ${streak} day streak\n\nCouscous Catcher`;

    try {
      if (navigator.share) {
        await navigator.share({ title: "Couscous Catcher", text });
      } else {
        await navigator.clipboard?.writeText(text);
        alert("Catch copied.");
      }
    } catch {}
  };

  return (
    <main className="app">
      <header className="top">
        <div className="brand">COUSCOUS<br />CATCHER</div>
        <div className="streak">🔥 {streak}</div>
      </header>

      <section className="screen">
        {mode === "catch" && !result && (
          <>
            <div className="clock">{clockString(now)}</div>
            <div className="next">
              next couscous · {pad(nextBaseCouscous(now).getHours())}:{pad(nextBaseCouscous(now).getMinutes())}
              <br />
              <span>{countdown(nextBaseCouscous(now).getTime() - now.getTime())}</span>
            </div>

            <button className="catchButton" onClick={doClockCatch}>COUSCOUS!</button>

            <div className="dailyMini">
              DAILY {dailyGoal}/3
              <span>{dailyGoal >= 3 ? " ✓" : ""}</span>
            </div>
          </>
        )}

        {mode === "catch" && result && "miss" in result && (
          <div className="result">
            <div className="eyebrow">NOT THIS TIME</div>
            <h1>NO COUSCOUS</h1>
            <div className="timestamp">{result.localTime}</div>
            <button className="primaryPill" onClick={() => setResult(null)}>CONTINUE</button>
          </div>
        )}

        {mode === "catch" && result && !("miss" in result) && (
          <CatchResult
            item={result}
            streak={streak}
            onShare={() => shareCatch(result)}
            onContinue={() => setResult(null)}
          />
        )}

        {mode === "ultimate" && <Ultimate />}
        {mode === "collection" && (
          <Collection
            catches={catches}
            discovered={discovered}
            todayHours={todayHours}
            dailyGoal={dailyGoal}
            todayCount={todayClockCatches.length}
          />
        )}
      </section>

      <nav className="nav">
        {(["catch", "ultimate", "collection"] as Mode[]).map(item => (
          <button
            key={item}
            className={mode === item ? "on" : ""}
            onClick={() => {
              setMode(item);
              setResult(null);
            }}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </nav>
    </main>
  );
}

function CatchResult({
  item,
  streak,
  onShare,
  onContinue
}: {
  item: SavedCatch;
  streak: number;
  onShare: () => void;
  onContinue: () => void;
}) {
  const primary = PATTERN_CATALOG.find(p => p.id === item.primaryPattern)!;
  const names = item.matchedPatterns
    .filter(id => id !== item.primaryPattern)
    .map(id => PATTERN_CATALOG.find(p => p.id === id)?.name)
    .filter(Boolean);

  return (
    <div className={`result rarity-${item.rarity.toLowerCase()}`}>
      <div className="eyebrow">{item.rarity} · CAUGHT</div>
      <h1>{primary.name}</h1>
      <div className="timestamp">{item.localTime}</div>
      <div className="accuracy">+{item.accuracyMs} ms</div>
      <div className="tier">{item.accuracyTier}</div>
      {names.length > 0 && <div className="combo">COMBO · {names.join(" + ")}</div>}
      <div className="score">+{item.score} XP · 🔥 {streak}</div>
      <div className="actions">
        <button className="primaryPill" onClick={onShare}>SHARE</button>
        <button className="secondaryPill" onClick={onContinue}>CONTINUE</button>
      </div>
    </div>
  );
}

function Ultimate() {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [stoppedResult, setStoppedResult] = useState<PatternMatch[] | null>(null);
  const raf = useRef(0);

  useEffect(() => {
    if (!running) return;
    const draw = () => {
      setElapsed(prev => {
        const base = Number((document.body.dataset.ultimateBase || "0"));
        return base + performance.now() - startedAt;
      });
      raf.current = requestAnimationFrame(draw);
    };
    raf.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf.current);
  }, [running, startedAt]);

  const t = Math.max(0, elapsed);
  const mm = Math.floor(t / 60000) % 60;
  const ss = Math.floor(t / 1000) % 60;
  const ms = Math.floor(t) % 1000;

  const startFresh = () => {
    document.body.dataset.ultimateBase = "0";
    setElapsed(0);
    setStoppedResult(null);
    setStartedAt(performance.now());
    setRunning(true);
  };

  const stop = () => {
    const base = Number(document.body.dataset.ultimateBase || "0");
    const exact = base + performance.now() - startedAt;
    document.body.dataset.ultimateBase = String(exact);
    setElapsed(exact);
    setRunning(false);

    const p: TimeParts = {
      hour: Math.floor(exact / 60000) % 60,
      minute: Math.floor(exact / 1000) % 60,
      second: Math.floor(exact / 1000) % 60,
      millisecond: Math.floor(exact) % 1000
    };
    setStoppedResult(detectUltimatePatterns(p));
  };

  const resume = () => {
    setStoppedResult(null);
    setStartedAt(performance.now());
    setRunning(true);
  };

  const reset = () => {
    cancelAnimationFrame(raf.current);
    document.body.dataset.ultimateBase = "0";
    setRunning(false);
    setElapsed(0);
    setStoppedResult(null);
  };

  return (
    <>
      <div className="eyebrow">COUSCOUS ULTIMATE</div>
      <div className="ultimateClock">{pad(mm)}:{pad(ss)}.{pad(ms, 3)}</div>

      {!running && elapsed === 0 && (
        <button className="ultimateMain" onClick={startFresh}>START</button>
      )}

      {running && (
        <button className="ultimateMain" onClick={stop}>STOP</button>
      )}

      {!running && elapsed > 0 && (
        <>
          {stoppedResult && stoppedResult.length > 0 ? (
            <div className="ultimateHit">
              {stoppedResult[0].name} · {stoppedResult[0].rarity}
            </div>
          ) : (
            <div className="ultimateMiss">NO COUSCOUS</div>
          )}
          <div className="actions">
            <button className="primaryPill" onClick={resume}>CONTINUE</button>
            <button className="secondaryPill" onClick={reset}>RESET</button>
          </div>
        </>
      )}

      <div className="next">training mode</div>
    </>
  );
}

function Collection({
  catches,
  discovered,
  todayHours,
  dailyGoal,
  todayCount
}: {
  catches: SavedCatch[];
  discovered: string[];
  todayHours: Set<number>;
  dailyGoal: number;
  todayCount: number;
}) {
  return (
    <div className="collectionWrap">
      <div className="collectionHeader">
        <div>
          <div className="eyebrow">TODAY</div>
          <div className="bigStat">{todayCount}</div>
          <div className="muted">catches · daily {dailyGoal}/3</div>
        </div>
        <div className="dexScore">{todayHours.size}/24</div>
      </div>

      <div className="hourBoard">
        {Array.from({ length: 24 }, (_, h) => (
          <div key={h} className={todayHours.has(h) ? "hour caught" : "hour"}>
            {pad(h)}
          </div>
        ))}
      </div>

      <div className="eyebrow collectionTitle">COUSCOUS DEX</div>
      <div className="patternList">
        {PATTERN_CATALOG.map(pattern => {
          const isFound = discovered.includes(pattern.id);
          const name = pattern.hidden && !isFound ? "???" : pattern.name;
          const description = pattern.hidden && !isFound ? "Undiscovered" : pattern.description;
          return (
            <div className={`patternRow ${isFound ? "found" : ""}`} key={pattern.id}>
              <div>
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
              <small>{isFound ? pattern.rarity : "LOCKED"}</small>
            </div>
          );
        })}
      </div>

      <div className="eyebrow collectionTitle">RECENT</div>
      <div className="recent">
        {catches.length === 0 && <div className="muted">nothing caught yet</div>}
        {catches.slice(-6).reverse().map(c => {
          const p = PATTERN_CATALOG.find(x => x.id === c.primaryPattern);
          return (
            <div key={c.id}>
              <b>{p?.name || c.primaryPattern}</b>
              <span>{c.localTime} · +{c.accuracyMs} ms</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
