import assert from "node:assert/strict";
import test from "node:test";
import { countdown, createRun, formatCountdownMs, pauseRun, projectScene, pushPointer, resumeRun, setMinHalf, step } from "./range-sim.ts";
import { applyFinished, defaultProfile, emptyStats, generateSheet, ladderGains, profileRequiresRetest } from "./generate.ts";
import type { RoundResult } from "./range-sim.ts";

test("countdown keeps falling with no finger on the screen", () => {
  const s = createRun({
    kind: "flick",
    gains: [1.15],
    now: 1000,
    roundDuration: 12000,
    prerollMs: 3000,
    gapMs: 1500,
    minHalf: 180,
  });
  let prev = Infinity;
  for (let t = 1000; t <= 3900; t += 100) {
    step(s, t);
    assert.equal(s.mode, "preroll");
    const ms = countdown(s, t).ms;
    assert.ok(ms < prev, `timer stuck at ${t}: ${ms}`);
    prev = ms;
  }
  step(s, 4000);
  assert.equal(s.mode, "live");
  assert.ok(countdown(s, 4000).ms > 10000);
  assert.equal(formatCountdownMs(3000), "3.0");
  assert.equal(formatCountdownMs(2900), "2.9");
  assert.equal(formatCountdownMs(0), "0.0");
});

test("round ends instead of freezing at zero", () => {
  const s = createRun({
    kind: "micro",
    gains: [1],
    now: 0,
    roundDuration: 800,
    prerollMs: 200,
    gapMs: 100,
    minHalf: 180,
  });
  let sawLive = false;
  for (let t = 0; t <= 2000; t += 16) {
    step(s, t);
    if (s.mode === "live") sawLive = true;
  }
  assert.equal(sawLive, true);
  assert.equal(s.mode, "done");
  assert.equal(countdown(s, 5000).caption, "完成");
  assert.equal(countdown(s, 5000).ms, 0);
});

test("crosshair overlap counts without a click", () => {
  const s = createRun({
    kind: "flick",
    gains: [1],
    now: 0,
    roundDuration: 5000,
    prerollMs: 0,
    gapMs: 100,
    minHalf: 200,
  });
  step(s, 0);
  assert.equal(s.mode, "live");
  const target = s.targets[0];
  assert.ok(target);
  const gain = s.gains[0] ?? 1;
  pushPointer(s, ((target.x - s.aimX) * s.minHalf) / gain, ((target.y - s.aimY) * s.minHalf) / gain);
  step(s, 40);
  assert.ok(s.hits >= 1, `expected contact hit, got ${s.hits}`);
});

test("sheet is phone-slider values, not mouse dpi", () => {
  const profile = { ...defaultProfile(), name: "夜巡", device: "phone" as const };
  const rounds: RoundResult[] = [
    { id: "low", gain: 0.78, hits: 4, overshoots: 1, acquireSum: 2400, durationMs: 10000, onTarget: 0, breaks: 0 },
    { id: "mid", gain: 1.15, hits: 18, overshoots: 2, acquireSum: 4200, durationMs: 10000, onTarget: 0, breaks: 0 },
    { id: "high", gain: 1.7, hits: 7, overshoots: 6, acquireSum: 3600, durationMs: 10000, onTarget: 0, breaks: 0 },
  ];
  const sheet = generateSheet(
    profile,
    {
      ladder: rounds,
      flick: null,
      micro: { hits: 8, overshoots: 1, acquireSum: 3000, durationMs: 15000 },
      vertical: { hits: 8, overshoots: 1, acquireSum: 2800, durationMs: 12000 },
      track: { onTarget: 0.6, breaks: 4, durationMs: 15000 },
    },
    0,
  );
  assert.ok(sheet);
  assert.ok(sheet.turnPct >= 38 && sheet.turnPct <= 48, `turn ${sheet.turnPct}`);
  assert.ok(sheet.verticalPct >= 90 && sheet.verticalPct <= 120);
  assert.ok(sheet.adsPct < sheet.turnPct);
  assert.match(sheet.copyText, /转向灵敏度: \d+(?:\n|$)/);
  assert.doesNotMatch(sheet.copyText, /无畏契约|转向灵敏度: \d+%/);
  assert.match(sheet.copyText, /固定速度/);
  assert.match(sheet.copyText, /全局灵敏度: 自定义/);
  assert.doesNotMatch(sheet.copyText, /DPI|eDPI|cm\/360/);
  for (const row of sheet.rows) {
    assert.equal(row.camera, Math.round(row.camera));
    assert.ok(row.camera >= 1 && row.camera <= 300);
    assert.ok(row.fire >= 1 && row.fire <= 300);
  }
  assert.ok(sheet.rows[0].camera >= 90 && sheet.rows[0].camera <= 150);
  const gains = ladderGains(profile);
  assert.equal(gains.length, 3);
  assert.ok(gains[0] < gains[1] && gains[1] < gains[2]);
});


test("overshoot and tracking change estimated COD values", () => {
  const profile = defaultProfile();
  const rounds: RoundResult[] = ["low", "mid", "high"].map((id, i) => ({ id: id as RoundResult["id"], gain: [0.8, 1.15, 1.7][i], hits: [5, 15, 5][i], overshoots: 1, acquireSum: 4000, durationMs: 10000, onTarget: 0, breaks: 0 }));
  const base = { ladder: rounds, flick: null, vertical: null, micro: null, track: null };
  const smooth = generateSheet(profile, { ...base, micro: { hits: 10, overshoots: 0, acquireSum: 6000, durationMs: 15000 }, track: { onTarget: 0.8, breaks: 2, durationMs: 15000 } })!;
  const over = generateSheet(profile, { ...base, micro: { hits: 10, overshoots: 8, acquireSum: 6000, durationMs: 15000 }, track: { onTarget: 0.2, breaks: 20, durationMs: 15000 } })!;
  assert.ok(smooth.rows[0].camera > over.rows[0].camera);
  assert.ok(smooth.rows[0].fire > over.rows[0].fire);
  assert.equal(generateSheet(profile, { ...base, ladder: rounds.slice(0, 2) }), null);
  assert.doesNotMatch(smooth.copyText, /陀螺仪灵敏度/);
});


test("a fast sweep intersects and removes a target in the same frame", () => {
  const s = createRun({ kind: "micro", gains: [1], now: 0, roundDuration: 5000, prerollMs: 0, minHalf: 200 });
  step(s, 0);
  const target = s.targets[0];
  target.x = 0; target.y = 0;
  s.aimX = -0.7; s.aimY = 0;
  pushPointer(s, 280, 0);
  step(s, 16);
  assert.equal(s.hits, 1);
  assert.equal(s.overshoots, 1);
  assert.ok(!s.targets.some(t => t.id === target.id));
});

test("a fast movement that ends on the target is not an overshoot", () => {
  const s = createRun({ kind: "micro", gains: [1], now: 0, roundDuration: 5000, prerollMs: 0, minHalf: 200 });
  step(s, 0);
  const target = s.targets[0];
  target.x = 0.5; target.y = 0;
  pushPointer(s, 100, 0);
  step(s, 16);
  assert.equal(s.hits, 1);
  assert.equal(s.overshoots, 0);
});

test("background pause discards stale movement and excludes pause from acquisition time", () => {
  const s = createRun({ kind: "micro", gains: [1], now: 0, roundDuration: 5000, prerollMs: 0, minHalf: 200 });
  step(s, 0);
  const target = s.targets[0];
  target.x = 0.4; target.y = 0;
  pushPointer(s, 80, 0);
  pauseRun(s, 100);
  resumeRun(s, 10100);
  step(s, 10116);
  assert.equal(s.aimX, 0);
  assert.equal(s.hits, 0);
  pushPointer(s, 80, 0);
  step(s, 10132);
  assert.equal(s.hits, 1);
  assert.equal(s.acquireSum, 132);
  assert.equal(countdown(s, 10132).ms, 4868);
});

test("crosshair stays within the viewport after a drag and rotation", () => {
  const s = createRun({ kind: "micro", gains: [1], now: 0, roundDuration: 5000, prerollMs: 0, minHalf: 200 });
  step(s, 0);
  pushPointer(s, 10000, 10000);
  step(s, 16);
  assert.ok(s.aimX <= 1 - 24 / 200 && s.aimY <= 1 - 24 / 200);
  setMinHalf(s, 700, 220);
  assert.ok(s.aimX <= 1 - 24 / 110 && s.aimY <= 1 - 24 / 110);
});

test("changing test conditions requires a new test but changing name or gyro does not", () => {
  const profile = defaultProfile();
  assert.equal(profileRequiresRetest(profile, { ...profile, device: "tablet" }), true);
  assert.equal(profileRequiresRetest(profile, { ...profile, fingers: "five" }), true);
  assert.equal(profileRequiresRetest(profile, { ...profile, thumb: "small" }), true);
  assert.equal(profileRequiresRetest(profile, { ...profile, codRole: "sniper" }), true);
  assert.equal(profileRequiresRetest(profile, { ...profile, name: "夜巡", gyro: "ads" }), false);
});

test("repeating the ladder clears tests measured at the old gain", () => {
  const stats = { ...emptyStats(), micro: { hits: 5, overshoots: 1, acquireSum: 500, durationMs: 15000 }, track: { onTarget: 0.8, breaks: 1, durationMs: 15000 } };
  const updated = applyFinished(stats, { kind: "ladder", rounds: [] });
  assert.equal(updated.micro, null);
  assert.equal(updated.track, null);
  assert.deepEqual(updated.ladder, []);
});

test("targets and crosshair remain inside different viewport ratios after rotation", () => {
  const s = createRun({ kind: "flick", gains: [1], now: 0, roundDuration: 5000, prerollMs: 0 });
  step(s, 0);
  for (const [width, height] of [[568, 320], [844, 390], [871, 400], [932, 430], [1131, 800], [1133, 744], [1194, 834], [1366, 1024], [320, 568], [834, 1194]]) {
    setMinHalf(s, width, height);
    const scene = projectScene(s, width, height, 0);
    assert.ok(scene.aim.sx >= 24 && scene.aim.sx <= width - 24);
    assert.ok(scene.aim.sy >= 24 && scene.aim.sy <= height - 24);
    for (const target of scene.targets) {
      assert.ok(target.sx - target.r >= 0 && target.sx + target.r <= width);
      assert.ok(target.sy - target.r >= 0 && target.sy + target.r <= height);
    }
  }
});
