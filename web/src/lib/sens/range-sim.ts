export type Kind = "flick" | "track" | "micro" | "vertical" | "ladder";
export type RoundId = "low" | "mid" | "high" | "single";
type ActiveMode = "preroll" | "live" | "gap";

export type RoundResult = {
  id: RoundId;
  gain: number;
  hits: number;
  overshoots: number;
  acquireSum: number;
  durationMs: number;
  onTarget: number;
  breaks: number;
};

export type Finished =
  | { kind: "ladder"; rounds: RoundResult[] }
  | { kind: "flick" | "micro" | "vertical"; hits: number; overshoots: number; acquireSum: number; durationMs: number }
  | { kind: "track"; onTarget: number; breaks: number; durationMs: number };

type Target = {
  id: number;
  x: number;
  y: number;
  r: number;
  born: number;
  vx: number;
  vy: number;
};

type Particle = { x: number; y: number; born: number };

export type RunState = {
  kind: Kind;
  mode: ActiveMode | "paused" | "done";
  pauseFrom: ActiveMode;
  modeEnds: number;
  pauseStarted: number;
  round: number;
  roundCount: number;
  gains: number[];
  aimX: number;
  aimY: number;
  pendingPx: number;
  pendingPy: number;
  velX: number;
  velY: number;
  minHalf: number;
  targets: Target[];
  particles: Particle[];
  nextId: number;
  hits: number;
  overshoots: number;
  acquireSum: number;
  trackMs: number;
  overlapMs: number;
  breaks: number;
  overlapping: boolean;
  lastNow: number;
  roundDuration: number;
  prerollMs: number;
  gapMs: number;
  rounds: RoundResult[];
  finished: Finished | null;
};

const GRACE = 0.04;

function radiusFor(kind: Kind): number {
  if (kind === "micro") return 0.078;
  if (kind === "track") return 0.16;
  if (kind === "vertical") return 0.12;
  return 0.125;
}

function roundId(state: RunState): RoundId {
  if (state.roundCount === 1) return "single";
  return (["low", "mid", "high"] as const)[state.round] ?? "mid";
}

function currentGain(state: RunState): number {
  return state.gains[state.round] ?? state.gains[0] ?? 1;
}

function spawn(state: RunState, now: number): Target {
  const r = radiusFor(state.kind);
  if (state.kind === "track") {
    const a = Math.random() * Math.PI * 2;
    return {
      id: state.nextId++,
      x: Math.cos(a) * 0.34,
      y: Math.sin(a) * 0.28,
      r,
      born: now,
      vx: Math.cos(a) * 0.55,
      vy: Math.sin(a) * 0.42,
    };
  }
  let x = 0.4;
  let y = 0;
  for (let attempt = 0; attempt < 14; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const dist = 0.32 + Math.random() * 0.38;
    let rx = Math.cos(a) * dist;
    let ry = Math.sin(a) * dist;
    if (state.kind === "flick") ry *= 0.45;
    if (state.kind === "vertical") {
      rx *= 0.38;
      ry = Math.sign(ry || 1) * (0.34 + Math.random() * 0.32);
    }
    x = Math.max(-0.78, Math.min(0.78, rx));
    y = Math.max(-0.78, Math.min(0.78, ry));
    const fromAim = Math.hypot(x - state.aimX, y - state.aimY);
    const clear = state.targets.every((t) => Math.hypot(t.x - x, t.y - y) > t.r + r + 0.08);
    if (fromAim > 0.28 && (clear || attempt === 13)) break;
  }
  return { id: state.nextId++, x, y, r, born: now, vx: 0, vy: 0 };
}

function fillTargets(state: RunState, now: number) {
  state.targets = [];
  const n = state.kind === "micro" || state.kind === "track" || state.kind === "vertical" ? 1 : 3;
  for (let i = 0; i < n; i++) state.targets.push(spawn(state, now));
}

export function createRun(opts: {
  kind: Kind;
  gains: number[];
  now: number;
  roundDuration: number;
  prerollMs?: number;
  gapMs?: number;
  minHalf?: number;
}): RunState {
  const gains = opts.gains.length > 0 ? opts.gains : [1];
  const state: RunState = {
    kind: opts.kind,
    mode: "preroll",
    pauseFrom: "preroll",
    modeEnds: opts.now + (opts.prerollMs ?? 3000),
    pauseStarted: 0,
    round: 0,
    roundCount: gains.length,
    gains,
    aimX: 0,
    aimY: 0,
    pendingPx: 0,
    pendingPy: 0,
    velX: 0,
    velY: 0,
    minHalf: opts.minHalf && opts.minHalf > 0 ? opts.minHalf : 180,
    targets: [],
    particles: [],
    nextId: 1,
    hits: 0,
    overshoots: 0,
    acquireSum: 0,
    trackMs: 0,
    overlapMs: 0,
    breaks: 0,
    overlapping: false,
    lastNow: opts.now,
    roundDuration: opts.roundDuration,
    prerollMs: opts.prerollMs ?? 3000,
    gapMs: opts.gapMs ?? 1500,
    rounds: [],
    finished: null,
  };
  fillTargets(state, opts.now);
  return state;
}

export function setMinHalf(state: RunState, cssWidth: number, cssHeight: number) {
  const half = Math.min(cssWidth, cssHeight) / 2;
  if (half > 8) {
    state.minHalf = half;
    const limit = Math.max(0, 1 - 24 / half);
    state.aimX = Math.max(-limit, Math.min(limit, state.aimX));
    state.aimY = Math.max(-limit, Math.min(limit, state.aimY));
  }
}

/** Finger or mouse delta in CSS pixels. No click is required. */
export function pushPointer(state: RunState, movementX: number, movementY: number) {
  if (state.mode !== "live" && state.mode !== "preroll") return;
  state.pendingPx += movementX;
  state.pendingPy += movementY;
}

function applyPointer(state: RunState, dt: number) {
  const gain = currentGain(state);
  const m = state.minHalf;
  const dx = (state.pendingPx * gain) / m;
  const dy = (state.pendingPy * gain) / m;
  state.pendingPx = 0;
  state.pendingPy = 0;
  const limit = Math.max(0, 1 - 24 / m);
  state.aimX = Math.max(-limit, Math.min(limit, state.aimX + dx));
  state.aimY = Math.max(-limit, Math.min(limit, state.aimY + dy));
  if (dx === 0 && dy === 0) {
    state.velX *= 0.8;
    state.velY *= 0.8;
    return;
  }
  if (dt > 0.001) {
    state.velX = state.velX * 0.45 + (dx / dt) * 0.55;
    state.velY = state.velY * 0.45 + (dy / dt) * 0.55;
  }
}

function moveTargets(state: RunState, dt: number) {
  if (state.kind !== "track") return;
  for (const t of state.targets) {
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (Math.abs(t.x) > 0.72) {
      t.vx = -Math.sign(t.x) * Math.max(0.35, Math.abs(t.vx));
      t.x = Math.sign(t.x) * 0.72;
    }
    if (Math.abs(t.y) > 0.62) {
      t.vy = -Math.sign(t.y) * Math.max(0.28, Math.abs(t.vy));
      t.y = Math.sign(t.y) * 0.62;
    }
    if (Math.random() < dt * 0.65) {
      const a = Math.random() * Math.PI * 2;
      t.vx = Math.cos(a) * 0.58;
      t.vy = Math.sin(a) * 0.46;
    }
  }
}

function touching(state: RunState, t: Target): boolean {
  return Math.hypot(t.x - state.aimX, t.y - state.aimY) <= t.r + GRACE;
}

function scoreTrack(state: RunState, dt: number) {
  const t = state.targets[0];
  if (!t) return;
  state.trackMs += dt * 1000;
  const on = touching(state, t);
  if (on) state.overlapMs += dt * 1000;
  if (state.overlapping && !on) state.breaks += 1;
  state.overlapping = on;
}

function resolveHits(state: RunState, now: number, oldX: number, oldY: number) {
  const keep: Target[] = [];
  let removed = 0;
  for (const t of state.targets) {
    const dx = state.aimX - oldX;
    const dy = state.aimY - oldY;
    const length2 = dx * dx + dy * dy;
    const u = length2 ? Math.max(0, Math.min(1, ((t.x - oldX) * dx + (t.y - oldY) * dy) / length2)) : 0;
    const crossed = Math.hypot(t.x - (oldX + u * dx), t.y - (oldY + u * dy)) <= t.r + GRACE;
    if (crossed) {
      state.hits += 1;
      state.acquireSum += Math.max(0, now - t.born);
      if (!touching(state, t)) state.overshoots += 1;
      state.particles.push({ x: t.x, y: t.y, born: now });
      removed += 1;
    } else {
      keep.push(t);
    }
  }
  state.targets = keep;
  for (let i = 0; i < removed; i++) state.targets.push(spawn(state, now));
  state.particles = state.particles.filter((p) => now - p.born < 320);
}

function snapshot(state: RunState): RoundResult {
  return {
    id: roundId(state),
    gain: currentGain(state),
    hits: state.hits,
    overshoots: state.overshoots,
    acquireSum: state.acquireSum,
    durationMs: state.roundDuration,
    onTarget: state.trackMs > 0 ? state.overlapMs / state.trackMs : 0,
    breaks: state.breaks,
  };
}

function packFinished(state: RunState): Finished {
  const last = state.rounds[state.rounds.length - 1];
  if (state.kind === "ladder") return { kind: "ladder", rounds: state.rounds.slice() };
  if (state.kind === "track") {
    return {
      kind: "track",
      onTarget: last?.onTarget ?? 0,
      breaks: last?.breaks ?? 0,
      durationMs: last?.durationMs ?? state.roundDuration,
    };
  }
  return {
    kind: state.kind,
    hits: last?.hits ?? 0,
    overshoots: last?.overshoots ?? 0,
    acquireSum: last?.acquireSum ?? 0,
    durationMs: last?.durationMs ?? state.roundDuration,
  };
}

function beginLive(state: RunState, now: number) {
  state.mode = "live";
  state.modeEnds = now + state.roundDuration;
  state.lastNow = now;
  state.hits = 0;
  state.overshoots = 0;
  state.acquireSum = 0;
  state.trackMs = 0;
  state.overlapMs = 0;
  state.breaks = 0;
  state.overlapping = false;
  state.velX = 0;
  state.velY = 0;
  state.pendingPx = 0;
  state.pendingPy = 0;
  state.aimX = 0;
  state.aimY = 0;
  state.particles = [];
  fillTargets(state, now);
}

function endRound(state: RunState, now: number) {
  state.rounds.push(snapshot(state));
  if (state.round + 1 >= state.roundCount) {
    state.mode = "done";
    state.finished = packFinished(state);
    return;
  }
  state.round += 1;
  state.mode = "gap";
  state.modeEnds = now + state.gapMs;
  state.lastNow = now;
  state.pendingPx = 0;
  state.pendingPy = 0;
  state.aimX = 0;
  state.aimY = 0;
  state.targets = [];
}

export function step(state: RunState, now: number) {
  if (state.mode === "done" || state.mode === "paused") return;

  if (state.mode === "preroll" || state.mode === "gap") {
    const dt = Math.min(0.05, Math.max(0, (now - state.lastNow) / 1000));
    if (state.mode === "preroll") {
      applyPointer(state, dt);
      moveTargets(state, dt);
    }
    state.lastNow = now;
    if (now >= state.modeEnds) beginLive(state, now);
    return;
  }

  const dt = Math.min(0.05, Math.max(0, (now - state.lastNow) / 1000));
  state.lastNow = now;
  const oldX = state.aimX;
  const oldY = state.aimY;
  applyPointer(state, dt);
  moveTargets(state, dt);
  if (state.kind === "track") scoreTrack(state, dt);
  else resolveHits(state, now, oldX, oldY);
  if (now >= state.modeEnds) endRound(state, now);
}

export function pauseRun(state: RunState, now: number) {
  if (state.mode !== "live" && state.mode !== "preroll" && state.mode !== "gap") return;
  state.pauseFrom = state.mode;
  state.pauseStarted = now;
  state.pendingPx = 0;
  state.pendingPy = 0;
  state.velX = 0;
  state.velY = 0;
  state.mode = "paused";
}

export function resumeRun(state: RunState, now: number) {
  if (state.mode !== "paused") return;
  const left = Math.max(0, state.modeEnds - state.pauseStarted);
  const pausedFor = Math.max(0, now - state.pauseStarted);
  for (const target of state.targets) target.born += pausedFor;
  for (const particle of state.particles) particle.born += pausedFor;
  state.mode = state.pauseFrom;
  state.modeEnds = now + left;
  state.lastNow = now;
}

export function formatCountdownMs(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const sec = Math.floor(tenths / 10);
  const tenth = tenths % 10;
  return `${sec}.${tenth}`;
}

export function countdown(state: RunState, now: number): { ms: number; caption: string } {
  if (state.mode === "done") return { ms: 0, caption: "完成" };
  if (state.mode === "paused") {
    return { ms: Math.max(0, state.modeEnds - state.pauseStarted), caption: "已暂停" };
  }
  const ms = Math.max(0, state.modeEnds - now);
  if (state.mode === "preroll") return { ms, caption: "准备" };
  if (state.mode === "gap") return { ms, caption: "下一档" };
  return { ms, caption: "剩余" };
}

export function phaseProgress(state: RunState, now: number): number {
  const mode = state.mode === "paused" ? state.pauseFrom : state.mode;
  const total =
    mode === "live" ? state.roundDuration : mode === "gap" ? state.gapMs : mode === "preroll" ? state.prerollMs : 1;
  const left =
    state.mode === "paused"
      ? Math.max(0, state.modeEnds - state.pauseStarted)
      : state.mode === "done"
        ? 0
        : Math.max(0, state.modeEnds - now);
  if (total <= 0) return 0;
  return Math.max(0, Math.min(1, left / total));
}

export type DrawDot = { sx: number; sy: number; r: number; track: boolean };
export type DrawPop = { sx: number; sy: number; life: number };

export function projectScene(state: RunState, width: number, height: number, now: number) {
  const m = Math.min(width, height) / 2;
  const to = (x: number, y: number) => ({ sx: width / 2 + x * m, sy: height / 2 + y * m });
  const aim = to(state.aimX, state.aimY);
  const targets: DrawDot[] = state.targets.map((t) => {
    const p = to(t.x, t.y);
    return { ...p, r: t.r * m, track: state.kind === "track" };
  });
  const particles: DrawPop[] = state.particles.map((p) => {
    const s = to(p.x, p.y);
    return { ...s, life: Math.max(0, 1 - (now - p.born) / 320) };
  });
  return { aim, targets, particles };
}
