import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import {
  countdown,
  createRun,
  formatCountdownMs,
  pauseRun,
  phaseProgress,
  projectScene,
  pushPointer,
  resumeRun,
  setMinHalf,
  step,
  type Finished,
  type Kind,
  type RunState,
} from "@/lib/sens/range-sim";

type Colors = { bg: string; primary: string; accent: string; border: string; fg: string };

function readColors(el: HTMLElement): Colors {
  const s = getComputedStyle(el);
  const pick = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: pick("--color-bg", "#10140f"),
    primary: pick("--color-primary", "#d6ff3f"),
    accent: pick("--color-accent", "#ff5a36"),
    border: pick("--color-border", "#2e3a2a"),
    fg: pick("--color-fg", "#e7f0e2"),
  };
}

function strokeCross(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const gap = 7;
  const len = 16;
  const arm = (col: string, w: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x - gap - len, y);
    ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y);
    ctx.lineTo(x + gap + len, y);
    ctx.moveTo(x, y - gap - len);
    ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap);
    ctx.lineTo(x, y + gap + len);
    ctx.stroke();
  };
  arm("#e7f0e2", 7);
  arm("#070a06", 5);
  arm(color, 3);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: RunState | null,
  now: number,
  colors: Colors,
  reduce: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const gap = 36;
  for (let x = gap; x < w; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = gap; y < h; y += gap) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();

  if (!state) {
    strokeCross(ctx, w / 2, h / 2, colors.primary);
    return;
  }

  const scene = projectScene(state, w, h, now);
  if (!reduce) {
    for (const p of scene.particles) {
      ctx.globalAlpha = p.life;
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 16 + (1 - p.life) * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (const t of scene.targets) {
    const radius = Math.max(10, t.r);
    if (t.track) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(t.sx, t.sy, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.sx, t.sy, radius * 0.45, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(t.sx, t.sy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.arc(t.sx, t.sy, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.sx, t.sy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  strokeCross(ctx, scene.aim.sx, scene.aim.sy, colors.primary);
}

function summaryText(result: Finished): string {
  if (result.kind === "track") return `贴靶 ${Math.round(result.onTarget * 100)}% · 断开 ${result.breaks} 次`;
  if (result.kind === "ladder") {
    const hits = result.rounds.reduce((n, r) => n + r.hits, 0);
    const over = result.rounds.reduce((n, r) => n + r.overshoots, 0);
    return `三档合计命中 ${hits}，过冲 ${over}`;
  }
  return `命中 ${result.hits} · 过冲 ${result.overshoots}`;
}

function fit(canvas: HTMLCanvasElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (w < 2 || h < 2) return null;
  const pw = Math.round(w * dpr);
  const ph = Math.round(h * dpr);
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw;
    canvas.height = ph;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

export function AimRange({
  title,
  blurb,
  kind,
  gains,
  roundLabels,
  duration,
  onFinish,
  onClose,
}: {
  title: string;
  blurb: string;
  kind: Kind;
  gains: number[];
  roundLabels: string[];
  duration: number;
  onFinish: (result: Finished) => void;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<RunState | null>(null);
  const raf = useRef(0);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const captionRef = useRef<HTMLParagraphElement>(null);
  const timerRef = useRef<HTMLParagraphElement>(null);
  const gearRef = useRef<HTMLParagraphElement>(null);
  const hitsRef = useRef<HTMLParagraphElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [summary, setSummary] = useState<Finished | null>(null);
  const colors = useRef<Colors | null>(null);
  const reduce = useRef(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const canvas = canvasRef.current;
    if (canvas) colors.current = readColors(canvas);

    const paint = (now: number) => {
      const node = canvasRef.current;
      if (!node) return;
      const fitted = fit(node);
      if (!fitted) return;
      const state = engine.current;
      if (state) setMinHalf(state, fitted.w, fitted.h);
      drawFrame(fitted.ctx, fitted.w, fitted.h, state, now, colors.current ?? readColors(node), reduce.current);
    };

    let pointer: { id: number; x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      const state = engine.current;
      if (!state || !pointer || pointer.id !== e.pointerId) return;
      if (e.pointerType === "touch" || e.pointerType === "pen") {
        if (e.buttons === 0) return;
        e.preventDefault();
      }
      pushPointer(state, e.clientX - pointer.x, e.clientY - pointer.y);
      pointer.x = e.clientX; pointer.y = e.clientY;
    };
    const onDown = (e: PointerEvent) => {
      if (!engine.current) return;
      e.preventDefault();
      if (pointer) return;
      pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas?.setPointerCapture(e.pointerId);
    };
    const onUp = (e: PointerEvent) => { if (pointer?.id === e.pointerId) pointer = null; };
    const onHide = () => {
      const state = engine.current;
      if (!state || state.mode === "done" || state.mode === "paused") return;
      if (document.visibilityState === "hidden") {
        pointer = null;
        pauseRun(state, performance.now());
        setPaused(true);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    canvas?.addEventListener("pointerdown", onDown);
    canvas?.addEventListener("lostpointercapture", onUp);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("visibilitychange", onHide);
    const onResize = () => { if (!engine.current) paint(performance.now()); };
    window.addEventListener("resize", onResize);
    paint(performance.now());

    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf.current);
      window.removeEventListener("pointermove", onMove);
      canvas?.removeEventListener("pointerdown", onDown);
      canvas?.removeEventListener("lostpointercapture", onUp);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const paintHud = (state: RunState, now: number) => {
    const c = countdown(state, now);
    if (timerRef.current) timerRef.current.textContent = formatCountdownMs(c.ms);
    if (captionRef.current) captionRef.current.textContent = c.caption;
    if (barRef.current) barRef.current.style.transform = `scaleX(${phaseProgress(state, now)})`;
    const label = roundLabels[state.round] ?? "";
    if (gearRef.current) {
      gearRef.current.textContent = state.roundCount > 1 ? `${label}档` : title;
    }
    if (hitsRef.current) {
      if (kind === "track") {
        const pct = state.trackMs > 0 ? Math.round((state.overlapMs / state.trackMs) * 100) : 0;
        hitsRef.current.textContent = `贴靶 ${pct}%`;
      } else {
        hitsRef.current.textContent = `命中 ${state.hits} · 过冲 ${state.overshoots}`;
      }
    }
  };

  const start = () => {
    if (engine.current) return;
    const now = performance.now();
    const canvas = canvasRef.current;
    const half = canvas ? Math.min(canvas.clientWidth, canvas.clientHeight) / 2 : 180;
    const state = createRun({
      kind,
      gains,
      now,
      roundDuration: duration,
      prerollMs: 3000,
      gapMs: gains.length > 1 ? 1500 : 800,
      minHalf: half > 8 ? half : 180,
    });
    engine.current = state;
    setRunning(true);
    setPaused(false);
    setSummary(null);
    paintHud(state, now);

    const frame = (t: number) => {
      const current = engine.current;
      if (!current) return;
      if (timerRef.current) {
        timerRef.current.textContent = formatCountdownMs(countdown(current, t).ms);
      }
      try {
        step(current, t);
      } catch (err) {
        console.error(err);
      }
      paintHud(current, t);
      const node = canvasRef.current;
      if (node) {
        const fitted = fit(node);
        if (fitted && colors.current) {
          setMinHalf(current, fitted.w, fitted.h);
          drawFrame(fitted.ctx, fitted.w, fitted.h, current, t, colors.current, reduce.current);
        }
      }
      if (current.mode === "done" && current.finished) {
        setSummary(current.finished);
        onFinishRef.current(current.finished);
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
  };

  const resume = () => {
    const state = engine.current;
    if (!state) return;
    resumeRun(state, performance.now());
    setPaused(false);
  };

  const close = () => {
    cancelAnimationFrame(raf.current);
    engine.current = null;
    onClose();
  };

  return (
    <div className="range-shell fixed inset-0 z-40 flex flex-col bg-bg pt-safe text-fg">
      <header className="range-header flex items-center gap-3 px-4 pt-4 pb-2">
        <Button type="button" variant="surface" onClick={close}>
          退出
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <p ref={captionRef} className="text-xs tracking-wide text-muted">
            {running ? "准备" : "靶场"}
          </p>
          <p
            ref={timerRef}
            data-testid="range-timer"
            className="font-display text-4xl leading-none text-accent tabular-nums sm:text-5xl"
          >
            {running ? "3.0" : "—"}
          </p>
        </div>
        <p ref={gearRef} className="w-20 text-right font-display text-2xl text-primary">
          {roundLabels[0] ? `${roundLabels[0]}档` : "准备"}
        </p>
      </header>
      <div className="range-progress px-4">
        <div className="h-1 overflow-hidden rounded-md bg-surface">
          <div ref={barRef} className="h-full origin-left bg-primary" style={{ transform: "scaleX(1)" }} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none select-none" />
        {!running && !summary && (
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <div className="w-full max-w-md max-h-full overflow-y-auto border border-border bg-surface p-3">
              <h2 className="font-display text-2xl text-fg">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{blurb}</p>
              <p className="mt-2 text-sm leading-6 text-fg">
                按住拖动准星碰目标，松手后倒计时继续。
              </p>
              <Button type="button" size="lg" className="mt-4 w-full" onClick={start}>
                开始
              </Button>
            </div>
          </div>
        )}
        {paused && !summary && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/80 p-4">
            <div className="w-full max-w-sm border border-border bg-surface p-4 text-center">
              <p className="font-display text-2xl text-fg">已暂停</p>
              <p className="mt-2 text-sm text-muted">倒计时停在这里，点继续才会接着走。</p>
              <Button type="button" size="lg" className="mt-4 w-full" onClick={resume}>
                继续
              </Button>
            </div>
          </div>
        )}
        {summary && (
          <div className="absolute inset-0 flex items-end justify-center p-4 sm:items-center">
            <div className="w-full max-w-md border border-border bg-surface p-4">
              <p className="text-sm text-primary">这一项已计入</p>
              <h2 className="mt-1 font-display text-2xl text-fg">{title}</h2>
              <p className="mt-2 text-sm text-muted">{summaryText(summary)}</p>
              <Button type="button" size="lg" className="mt-4 w-full" onClick={close}>
                返回靶场
              </Button>
            </div>
          </div>
        )}
      </div>
      <p ref={hitsRef} className="range-hits px-4 pt-2 pb-safe text-center text-sm text-muted">
        按住拖动
      </p>
    </div>
  );
}
