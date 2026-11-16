import type { Finished, RoundResult } from "./range-sim";

export type Device = "phone" | "tablet";
export type Fingers = "two" | "three" | "four" | "five";
export type Thumb = "small" | "mid" | "large";
export type ValRole = "duelist" | "initiator" | "controller" | "sentinel";
export type CodRole = "ar" | "smg" | "sniper" | "flex";
export type Gyro = "off" | "ads" | "always";

export type Profile = {
  name: string;
  device: Device;
  fingers: Fingers;
  thumb: Thumb;
  valRole: ValRole;
  codRole: CodRole;
  gyro: Gyro;
};

export type FlickStat = { hits: number; overshoots: number; acquireSum: number; durationMs: number };
export type TrackStat = { onTarget: number; breaks: number; durationMs: number };

export type Stats = {
  ladder: RoundResult[] | null;
  flick: FlickStat | null;
  micro: FlickStat | null;
  vertical: FlickStat | null;
  track: TrackStat | null;
};

export type CodRow = { name: string; camera: number; fire: number; gyro: number };

export type Sheet = {
  name: string;
  deviceLabel: string;
  turnPct: number;
  verticalPct: number;
  firePct: number;
  adsPct: number;
  scopePct: number;
  gyroTurnPct: number;
  gyroVerticalPct: number;
  showGyro: boolean;
  gyroLabel: string;
  rows: CodRow[];
  notes: string[];
  reliable: boolean;
  copyText: string;
  bias: number;
  gain: number;
};

export const emptyStats = (): Stats => ({
  ladder: null,
  flick: null,
  micro: null,
  vertical: null,
  track: null,
});

export const defaultProfile = (): Profile => ({
  name: "",
  device: "phone",
  fingers: "three",
  thumb: "mid",
  valRole: "duelist",
  codRole: "ar",
  gyro: "off",
});

export function profileRequiresRetest(before: Profile, after: Profile): boolean {
  return before.device !== after.device || before.fingers !== after.fingers ||
    before.thumb !== after.thumb || before.codRole !== after.codRole;
}

const DEVICE_LABEL: Record<Device, string> = { phone: "手机", tablet: "平板" };
const FINGER_LABEL: Record<Fingers, string> = { two: "两指", three: "三指", four: "四指", five: "五指" };
const THUMB_LABEL: Record<Thumb, string> = { small: "拇指行程短", mid: "拇指行程中等", large: "拇指行程长" };
const VAL_LABEL: Record<ValRole, string> = {
  duelist: "决斗",
  initiator: "先锋",
  controller: "控场",
  sentinel: "哨卫",
};
const COD_LABEL: Record<CodRole, string> = { ar: "突击", smg: "冲锋", sniper: "狙击", flex: "全能" };
const ROUND_LABEL: Record<string, string> = { low: "低", mid: "中", high: "高", single: "本档" };

const CAMERA_SHAPE: [string, number][] = [
  ["转向灵敏度", 121],
  ["机瞄/红点/全息", 100],
  ["1.5倍镜", 120],
  ["3倍镜", 100],
  ["4倍镜", 80],
  ["6倍战术瞄准镜", 40],
  ["8倍战术瞄准镜", 40],
  ["狙击枪灵敏度", 45],
];

const FIRE_SHAPE: [string, number][] = [
  ["转向灵敏度", 87],
  ["机瞄/红点/全息", 100],
  ["1.5倍镜", 120],
  ["3倍镜", 100],
  ["4倍镜", 80],
  ["6倍战术瞄准镜", 40],
  ["8倍战术瞄准镜", 30],
  ["狙击枪灵敏度", 45],
];

const GYRO_SHAPE: [string, number][] = [
  ["转向灵敏度", 28],
  ["机瞄/红点/全息", 26],
  ["1.5倍镜", 24],
  ["3倍镜", 22],
  ["4倍镜", 18],
  ["6倍战术瞄准镜", 12],
  ["8倍战术瞄准镜", 10],
  ["狙击枪灵敏度", 14],
];

const GAIN_TO_PCT: [number, number][] = [
  [0.55, 26],
  [0.8, 32],
  [1.0, 38],
  [1.15, 42],
  [1.35, 48],
  [1.6, 55],
  [2.0, 64],
  [2.5, 74],
];

const GAIN_TO_TURN: [number, number][] = [
  [0.55, 72],
  [0.8, 88],
  [1.0, 102],
  [1.15, 116],
  [1.35, 132],
  [1.6, 150],
  [2.0, 172],
  [2.5, 198],
];

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i];
    const [x1, y1] = table[i + 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function gainToTurnPct(gain: number): number {
  return clampInt(interp(GAIN_TO_PCT, gain), 22, 80);
}

export function ladderCenterGain(profile: Profile): number {
  let g = profile.device === "tablet" ? 1.02 : 1.15;
  if (profile.fingers === "two") g -= 0.12;
  if (profile.fingers === "four") g += 0.1;
  if (profile.fingers === "five") g += 0.18;
  if (profile.thumb === "small") g += 0.16;
  if (profile.thumb === "large") g -= 0.12;
  if (profile.codRole === "sniper") g -= 0.08;
  if (profile.codRole === "smg") g += 0.06;
  return clamp(Math.round(g * 100) / 100, 0.7, 2.2);
}

export function ladderGains(profile: Profile): number[] {
  const c = ladderCenterGain(profile);
  return [c * 0.68, c, c * 1.48].map((g) => Math.round(g * 100) / 100);
}

export function workingGain(profile: Profile, stats: Stats): number {
  if (!stats.ladder || stats.ladder.length === 0) return ladderCenterGain(profile);
  return blendGain(stats.ladder).gain;
}

function quality(r: RoundResult): number {
  const seconds = Math.max(0.1, r.durationMs / 1000);
  const hps = r.hits / seconds;
  const over = r.overshoots / Math.max(1, r.hits);
  const acquire = r.hits > 0 ? r.acquireSum / r.hits : 1400;
  return hps * 100 - over * 28 - acquire / 30;
}

export function blendGain(rounds: RoundResult[]): { gain: number; best: RoundResult } {
  const qualities = rounds.map(quality);
  let bestI = 0;
  for (let i = 1; i < qualities.length; i++) if (qualities[i] > qualities[bestI]) bestI = i;
  const min = Math.min(...qualities);
  const weights = qualities.map((q) => Math.exp((q - min) / 12));
  const sum = weights.reduce((a, b) => a + b, 0);
  const gain = rounds.reduce((s, r, i) => s + r.gain * (weights[i] / sum), 0);
  return { gain, best: rounds[bestI] };
}

function overRate(s: FlickStat | null): number | null {
  if (!s || s.hits < 1) return null;
  return s.overshoots / s.hits;
}

function roleMul(role: CodRole, name: string): number {
  const zoom = name.includes("4倍") || name.includes("6倍") || name.includes("8倍") || name.includes("狙击");
  const hip = name.includes("转向") || name.includes("红点") || name.includes("1.5");
  if (role === "smg") return zoom ? 0.92 : hip ? 1.08 : 1;
  if (role === "sniper") {
    if (name.includes("转向")) return 0.94;
    if (zoom) return 0.8;
  }
  if (role === "ar" && (name.includes("红点") || name.includes("3倍"))) return 1.04;
  return 1;
}

export function generateSheet(profile: Profile, stats: Stats, bias = 0): Sheet | null {
  if (!stats.ladder || stats.ladder.length !== 3) return null;
  const blended = blendGain(stats.ladder);
  let factor = 1;
  const microRate = overRate(stats.micro);
  const flickRate = overRate(stats.flick);
  if (microRate != null) {
    if (microRate > 0.42) factor *= 0.88;
    else if (microRate < 0.12 && stats.micro && stats.micro.hits >= 5) factor *= 1.06;
  } else if (flickRate != null) {
    if (flickRate > 0.48) factor *= 0.90;
    else if (flickRate < 0.12) factor *= 1.06;
  }
  if (stats.track) {
    if (stats.track.onTarget < 0.32) factor *= 0.90;
    else if (stats.track.onTarget > 0.6 && stats.track.breaks < 12) factor *= 1.06;
  }
  factor = clamp(factor, 0.80, 1.15);
  const biasMul = 1 + clamp(bias, -0.25, 0.25);
  const gain = clamp(blended.gain * factor * biasMul, 0.5, 2.6);

  let turnPct = gainToTurnPct(gain);
  if (profile.codRole === "smg") turnPct = clampInt(turnPct * 1.06, 22, 80);
  if (profile.codRole === "sniper") turnPct = clampInt(turnPct * 0.94, 22, 80);

  const vRate = overRate(stats.vertical);
  let verticalPct = 100;
  if (stats.vertical && vRate != null && stats.vertical.hits >= 3) {
    const avg = stats.vertical.acquireSum / stats.vertical.hits;
    if (vRate > 0.45) verticalPct = 92;
    else if (vRate > 0.28) verticalPct = 96;
    else if (vRate < 0.1 && avg > 520) verticalPct = 112;
    else if (vRate < 0.12) verticalPct = 106;
    else verticalPct = 100;
  }

  let adsRatio = 0.58;
  let scopeRatio = 0.45;
  if (microRate != null && microRate > 0.4) {
    adsRatio = 0.5;
    scopeRatio = 0.38;
  } else if (microRate != null && microRate > 0.25) {
    adsRatio = 0.54;
    scopeRatio = 0.42;
  }
  if (profile.codRole === "sniper") {
    adsRatio -= 0.04;
    scopeRatio -= 0.05;
  }
  const adsPct = clampInt(turnPct * adsRatio, 12, 60);
  const scopePct = clampInt(turnPct * scopeRatio, 10, 48);
  let fireRatio = 0.85;
  if (stats.track) {
    if (stats.track.onTarget >= 0.55 && stats.track.breaks < 12) fireRatio = 0.92;
    else if (stats.track.onTarget < 0.38) fireRatio = 0.78;
  }
  const firePct = clampInt(turnPct * fireRatio, 12, 75);
  const gyroTurnPct = clampInt(turnPct * (profile.gyro === "always" ? 0.85 : 0.72), 16, 55);
  const gyroVerticalPct = 100;

  const codTurn = interp(GAIN_TO_TURN, gain);
  const codScale = codTurn / 121;
  const zoomNudge = microRate != null && microRate > 0.3 ? 0.9 : 1;
  let fireHip = fireRatio / 0.85;
  const gyroMul = profile.gyro === "always" ? 1.15 : 1;
  const rows: CodRow[] = CAMERA_SHAPE.map(([name, camBase], i) => {
    const zoom = name.includes("4倍") || name.includes("6倍") || name.includes("8倍") || name.includes("狙击");
    const hip = name.includes("转向") || name.includes("红点");
    const mul = roleMul(profile.codRole, name) * (zoom ? zoomNudge : 1);
    const camera = clampInt(Math.round(camBase * codScale * mul / 5) * 5, 1, 300);
    let fire = clampInt(Math.round(FIRE_SHAPE[i][1] * codScale * mul * (hip ? fireHip : 1) / 5) * 5, 1, 300);
    if (name.includes("转向")) fire = Math.min(fire, camera);
    const gyroScale = interp(GAIN_TO_TURN, clamp(blended.gain * factor, 0.5, 2.6)) / 121;
    const gyro = clampInt(Math.round(GYRO_SHAPE[i][1] * gyroScale * mul * gyroMul / 5) * 5, 1, 300);
    return { name, camera, fire, gyro };
  });

  const totalHits = stats.ladder.reduce((s, r) => s + r.hits, 0);
  const reliable = totalHits >= 6;
  const gyroLabel = profile.gyro === "off" ? "关闭" : profile.gyro === "ads" ? "开镜时开启" : "总是开启";
  const best = blended.best;

  const notes = [
    `寻优最佳：${ROUND_LABEL[best.id] ?? "中"}档，命中 ${best.hits}，过冲 ${best.overshoots}。`,
    "数值由手感估算，请在训练场验证并微调。",
    "固定速度与本次测试一致；所有数字均为整数。",
  ];
  if (Math.abs(bias) > 0.01) notes.push(`整体修正 ${bias > 0 ? "+" : ""}${Math.round(bias * 100)}%。垂直百分比不跟这个滑条走。`);

  const who = profile.name.trim() || "未署名";
  const lines = [
    `【手感刻度 · ${who} · ${DEVICE_LABEL[profile.device]}】`,
    "",
    "使命召唤手游（设置 → 灵敏度）",
    "灵敏度模式: 固定速度",
    "灵敏度切换模式: 开镜时切换",
    "全局灵敏度: 自定义",
    `陀螺仪: ${gyroLabel}`,
    "",
    "镜头灵敏度",
    ...rows.map((r) => `${r.name}: ${r.camera}`),
    "",
    "开火灵敏度",
    ...rows.map((r) => `${r.name}: ${r.fire}`),
  ];
  if (profile.gyro !== "off") {
    lines.push("", "陀螺仪灵敏度", ...rows.map((r) => `${r.name}: ${r.gyro}`));
  }

  return {
    name: who,
    deviceLabel: DEVICE_LABEL[profile.device],
    turnPct,
    verticalPct,
    firePct,
    adsPct,
    scopePct,
    gyroTurnPct,
    gyroVerticalPct,
    showGyro: profile.gyro !== "off",
    gyroLabel,
    rows,
    notes,
    reliable,
    copyText: lines.join("\n"),
    bias,
    gain,
  };
}

export function applyFinished(stats: Stats, finished: Finished): Stats {
  const next: Stats = { ...stats };
  if (finished.kind === "ladder") return { ...emptyStats(), ladder: finished.rounds };
  else if (finished.kind === "track") {
    next.track = { onTarget: finished.onTarget, breaks: finished.breaks, durationMs: finished.durationMs };
  } else if (finished.kind === "flick") {
    next.flick = pickFlick(finished);
  } else if (finished.kind === "micro") {
    next.micro = pickFlick(finished);
  } else if (finished.kind === "vertical") {
    next.vertical = pickFlick(finished);
  }
  return next;
}

function pickFlick(finished: Extract<Finished, { kind: "flick" | "micro" | "vertical" }>): FlickStat {
  return {
    hits: finished.hits,
    overshoots: finished.overshoots,
    acquireSum: finished.acquireSum,
    durationMs: finished.durationMs,
  };
}

export function habitLine(profile: Profile): string {
  return `${DEVICE_LABEL[profile.device]} · ${FINGER_LABEL[profile.fingers]} · ${THUMB_LABEL[profile.thumb]} · ${COD_LABEL[profile.codRole]}`;
}

