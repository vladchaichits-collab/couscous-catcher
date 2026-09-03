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
async function createShareCard({
  kind,
  time,
  label,
  details
}: {
  kind: "catch" | "miss" | "ultimate";
  time: string;
  label?: string;
  details?: string;
}) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const gold = "#d9bd8b";
  const white = "#f7f5ef";
  const muted = "#aaa7a0";

  // Background
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle rings
  ctx.strokeStyle = "rgba(217,189,139,0.07)";
  ctx.lineWidth = 2;
  for (let r = 260; r <= 850; r += 90) {
    ctx.beginPath();
    ctx.arc(540, 410, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Logo block
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "rgba(217,189,139,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(390, 85, 300, 300, 42);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = white;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 100px Arial, Helvetica, sans-serif";
  ctx.fillText("COUS", 540, 190);
  ctx.fillText("COUS", 540, 290);

  // Eyebrow
  ctx.fillStyle = gold;
  ctx.font = "600 34px Arial, Helvetica, sans-serif";
  ctx.letterSpacing = "8px";

  const eyebrow =
    kind === "ultimate"
      ? "ULTIMATE MODE"
      : kind === "miss"
        ? "NOT THIS TIME"
        : "MOMENT CAUGHT";

  ctx.fillText(eyebrow, 540, 475);

  // Time formatting
  let displayTime = time;

  if (kind !== "ultimate") {
    displayTime = time.split(".")[0];
  }

  // Main time
  ctx.fillStyle = white;
  ctx.font =
    kind === "ultimate"
      ? "900 150px Arial, Helvetica, sans-serif"
      : "900 170px Arial, Helvetica, sans-serif";

  ctx.fillText(displayTime, 540, 660);

  // Result
  ctx.fillStyle = gold;
  ctx.font = "600 42px Arial, Helvetica, sans-serif";

  const resultLabel =
    label ||
    (kind === "miss" ? "NO COUSCOUS" : "MOMENT CAUGHT");

  ctx.fillText(resultLabel.toUpperCase(), 540, 795);

  // Details
  if (details) {
    ctx.fillStyle = muted;
    ctx.font = "400 30px Arial, Helvetica, sans-serif";

    const lines = details.split("\n");

    lines.slice(0, 3).forEach((line, index) => {
      ctx.fillText(line, 540, 875 + index * 46);
    });
  }

  // Divider
  ctx.strokeStyle = "rgba(217,189,139,0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(210, 1070);
  ctx.lineTo(870, 1070);
  ctx.stroke();

  // Brand footer
  ctx.fillStyle = gold;
  ctx.font = "600 42px Arial, Helvetica, sans-serif";
  ctx.fillText("Couscous Catcher", 540, 1160);

  return new Promise<Blob | null>(resolve => {
    canvas.toBlob(
      blob => resolve(blob),
      "image/png",
      1
    );
  });
}
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

const shareMoment = async ({
  kind,
  time,
  label,
  details
}: {
  kind: "catch" | "miss" | "ultimate";
  time: string;
  label?: string;
  details?: string;
}) => {
  track("share_clicked", {
    kind,
    time,
    label: label || null
  });
const shareTime =
  kind === "ultimate" ? time : time.split(".")[0];
  
  const text =
    `${label || "MOMENT CAUGHT"}\n` +
`${shareTime}\n` +
    `${details ? `${details}\n` : ""}` +
    `\nCouscous Catcher\n` +
    `https://couscous-catcher.vercel.app`;

  try {
    const blob = await createShareCard({
      kind,
      time,
      label,
      details
    });

    if (blob) {
      const file = new File(
        [blob],
        `couscous-${Date.now()}.png`,
        { type: "image/png" }
      );

      const shareData = {
        title: "Couscous Catcher",
        text,
        files: [file]
      };

      if (
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        await navigator.share(shareData);
        return;
      }
    }

    if (navigator.share) {
      await navigator.share({
        title: "Couscous Catcher",
        text
      });
    } else {
      await navigator.clipboard?.writeText(text);
      alert("Moment copied.");
    }
  } catch {}
};

const shareCatch = async (item: SavedCatch) => {
  const primary = PATTERN_CATALOG.find(p => p.id === item.primaryPattern);

  await shareMoment({
    kind: "catch",
    time: item.localTime,
    label: `${primary?.name || item.primaryPattern} CAUGHT`,
    details:
      `+${item.accuracyMs} ms · ${item.accuracyTier}\n` +
      `🔥 ${streak} day streak`
  });
};
const previewShareCard = async () => {
  const blob = await createShareCard({
    kind: "catch",
    time: "12:34:56",
    label: "COUSCOUS CAUGHT",
    details: "+14 ms · PERFECT\n🔥 3 day streak"
  });

  if (!blob) {
    alert("Card generation failed.");
    return;
  }

  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60000);
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
<div className="actions">
  <button
    className="primaryPill"
    onClick={() =>
      shareMoment({
        kind: "miss",
        time: result.localTime,
label: "NO COUSCOUS",
        details: "No known pattern — but maybe you know why."
      })
    }
  >
    SHARE
  </button>

  <button
    className="secondaryPill"
    onClick={() => setResult(null)}
  >
    CONTINUE
  </button>
</div>          </div>
        )}

        {mode === "catch" && result && !("miss" in result) && (
          <CatchResult
            item={result}
            streak={streak}
            onShare={() => shareCatch(result)}
            onContinue={() => setResult(null)}
          />
        )}

{mode === "ultimate" && (
  <Ultimate
    onShare={(time, label, details) =>
      shareMoment({
        kind: "ultimate",
        time,
        label,
        details
      })
    }
  />
)}        {mode === "collection" && (
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

function Ultimate({
  onShare
}: {
  onShare: (time: string, label?: string, details?: string) => void;
}) {  const [running, setRunning] = useState(false);
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
  <button
    className="primaryPill"
    onClick={() =>
      onShare(
        `${pad(mm)}:${pad(ss)}.${pad(ms, 3)}`,
        stoppedResult && stoppedResult.length > 0
          ? `${stoppedResult[0].name} CAUGHT`
          : "MOMENT CAUGHT",
        stoppedResult && stoppedResult.length > 0
          ? `${stoppedResult[0].rarity}`
          : "No known pattern — but maybe you know why."
      )
    }
  >
    SHARE
  </button>

  <button className="secondaryPill" onClick={resume}>CONTINUE</button>
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
