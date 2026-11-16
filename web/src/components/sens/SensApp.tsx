import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Crosshair } from "lucide-react";
import { Button, cn } from "./ui";
import { AimRange } from "@/components/sens/AimRange";

import {
  applyFinished,
  defaultProfile,
  emptyStats,
  generateSheet,
  habitLine,
  ladderGains,
  profileRequiresRetest,
  workingGain,
  type CodRole,
  type Device,
  type Fingers,
  type Gyro,
  type Profile,
  type Stats,
  type Thumb,
} from "@/lib/sens/generate";
import type { Finished, Kind } from "@/lib/sens/range-sim";

type Step = "habit" | "range" | "sheet";

const STORE = "kedu-touch-v1";

const TESTS: { kind: Kind; title: string; blurb: string; seconds: number; need?: string }[] = [
  {
    kind: "ladder",
    title: "三档寻优",
    blurb: "低、中、高三种拖动速度各 10 秒。哪档又快又少滑过，就用哪档当主灵敏度。",
    seconds: 10,
    need: "必做",
  },
  {
    kind: "flick",
    title: "左右甩枪",
    blurb: "目标偏左右。用来看你横向会不会甩过头。",
    seconds: 15,
  },
  {
    kind: "micro",
    title: "开镜微瞄",
    blurb: "目标更小。过冲多就把开镜和狙击开镜再收一点。",
    seconds: 15,
  },
  {
    kind: "track",
    title: "跟枪",
    blurb: "圈会动。准星留在圈上越久，开火灵敏度越接近转向。",
    seconds: 15,
  },
];

function loadSave(): { profile: Profile; stats: Stats; bias: number } | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const data = JSON.parse(raw) as { v?: number; profile?: Profile; stats?: Stats; bias?: number };
    if (data.v !== 1 || !data.profile) return null;
    return { profile: { ...defaultProfile(), ...data.profile }, stats: { ...emptyStats(), ...data.stats }, bias: data.bias ?? 0 };
  } catch {
    return null;
  }
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; hint?: string }[];
  onChange: (id: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm text-muted">{label}</legend>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={cn(
                "min-h-11 rounded-md border px-3 py-2 text-left",
                on ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg",
              )}
            >
              <span className="block text-sm font-medium">{opt.label}</span>
              {opt.hint && <span className={cn("mt-0.5 block text-xs", on ? "text-primary-fg/80" : "text-muted")}>{opt.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function SensApp() {
  const [step, setStep] = useState<Step>("habit");
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [bias, setBias] = useState(0);
  const [ready, setReady] = useState(false);
  const [launch, setLaunch] = useState<{ nonce: number; kind: Kind } | null>(null);
  const [copied, setCopied] = useState<"all" | "cod" | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    const saved = loadSave();
    if (saved) {
      setProfile(saved.profile);
      setStats(saved.stats);
      setBias(saved.bias);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify({ v: 1, profile, stats, bias }));
    } catch {
      // Some browsers block storage for files opened directly; keep the app usable.
    }
  }, [ready, profile, stats, bias]);

  const sheet = useMemo(() => generateSheet(profile, stats, bias), [profile, stats, bias]);
  const patch = (partial: Partial<Profile>) => {
    const next = { ...profile, ...partial };
    if (profileRequiresRetest(profile, next)) setStats(emptyStats());
    setProfile(next);
  };

  const open = (kind: Kind) => setLaunch({ nonce: Date.now(), kind });

  const onFinish = (result: Finished) => setStats((s) => applyFinished(s, result));

  const copy = async (which: "all" | "cod") => {
    if (!sheet) return;
    const text = sheet.copyText;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
      setCopyFailed(true);
    }
  };

  const active = launch ? TESTS.find((t) => t.kind === launch.kind) : null;

  return (
    <main className="app-shell mx-auto min-h-screen max-w-5xl px-4 pt-safe pb-safe">
      <header className="app-header flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary text-primary-fg">
          <Crosshair className="size-6" />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-none tracking-wide text-fg">手感刻度</h1>
          <p className="mt-1 text-sm text-muted">手机 · 平板 · 使命召唤手游</p>
        </div>
      </header>

      <nav className="step-nav mt-5 grid grid-cols-3 gap-2" aria-label="步骤">
        {(
          [
            ["habit", "01 习惯"],
            ["range", "02 靶场"],
            ["sheet", "03 方案"],
          ] as const
        ).map(([id, label]) => {
          const locked = id === "sheet" && stats.ladder?.length !== 3;
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => setStep(id)}
              className={cn(
                "min-h-11 rounded-md border text-sm",
                step === id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface text-fg",
                locked && "opacity-40",
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>

      {step === "habit" && (
        <section className="habit-layout mt-5 space-y-5">
          <p className="text-sm leading-6 text-muted">
            在手机或平板上用手指测。准星碰上目标就算命中。测完得到整数，按滑条填进游戏。
          </p>
          <p className="text-sm text-muted">更换设备、指法、拇指行程或打法后，需要重新测试。</p>
          <label className="block">
            <span className="mb-2 block text-sm text-muted">代号，可空</span>
            <input
              value={profile.name}
              onChange={(e) => patch({ name: e.target.value.slice(0, 16) })}
              placeholder="例如夜巡"
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-fg outline-none focus:border-primary"
            />
          </label>
          <Choice<Device>
            label="设备"
            value={profile.device}
            onChange={(device) => patch({ device })}
            options={[
              { id: "phone", label: "手机", hint: "拇指行程短" },
              { id: "tablet", label: "平板", hint: "可以拖得更长" },
            ]}
          />
          <Choice<Fingers>
            label="指法"
            value={profile.fingers}
            onChange={(fingers) => patch({ fingers })}
            options={[
              { id: "two", label: "两指" },
              { id: "three", label: "三指" },
              { id: "four", label: "四指" },
              { id: "five", label: "五指" },
            ]}
          />
          <Choice<Thumb>
            label="滑屏时拇指能划多远"
            value={profile.thumb}
            onChange={(thumb) => patch({ thumb })}
            options={[
              { id: "small", label: "很短", hint: "容易需要高敏" },
              { id: "mid", label: "普通" },
              { id: "large", label: "能划很长", hint: "可以更低" },
            ]}
          />
          <Choice<CodRole>
            label="使命召唤打法"
            value={profile.codRole}
            onChange={(codRole) => patch({ codRole })}
            options={[
              { id: "ar", label: "突击" },
              { id: "smg", label: "冲锋" },
              { id: "sniper", label: "狙击" },
              { id: "flex", label: "全能" },
            ]}
          />
          <Choice<Gyro>
            label="陀螺仪"
            value={profile.gyro}
            onChange={(gyro) => patch({ gyro })}
            options={[
              { id: "off", label: "关闭" },
              { id: "ads", label: "开镜时" },
              { id: "always", label: "一直开" },
            ]}
          />
          <p className="text-sm text-fg">{habitLine(profile)}</p>
          <Button type="button" size="lg" className="w-full" onClick={() => setStep("range")}>
            去靶场测
          </Button>
        </section>
      )}

      {step === "range" && (
        <section className="mt-5">
          <p className="text-sm leading-6 text-muted">
            先做三档寻优。其他测试会调整开镜和开火。手指按住拖，准星碰上就消，不用点目标。
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {TESTS.map((test) => {
              const done =
                (test.kind === "ladder" && stats.ladder) ||
                (test.kind === "flick" && stats.flick) ||
                (test.kind === "vertical" && stats.vertical) ||
                (test.kind === "micro" && stats.micro) ||
                (test.kind === "track" && stats.track);
              return (
                <button
                  key={test.kind}
                  type="button"
                  onClick={() => open(test.kind)}
                  className="min-h-11 rounded-md border border-border bg-surface p-4 text-left"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display text-xl text-fg">{test.title}</span>
                    {done ? <Check className="size-5 text-primary" /> : test.need ? <span className="text-xs text-accent">{test.need}</span> : null}
                  </span>
                  <span className="mt-2 block text-sm leading-6 text-muted">{test.blurb}</span>
                  <span className="mt-2 block text-xs text-primary">{test.kind === "ladder" ? "3 × 10 秒" : `${test.seconds} 秒`}</span>
                </button>
              );
            })}
          </div>
          <Button type="button" size="lg" className="mt-4 w-full" disabled={stats.ladder?.length !== 3} onClick={() => setStep("sheet")}>
            {stats.ladder?.length === 3 ? "生成我的灵敏度" : "先完成三档寻优"}
          </Button>
        </section>
      )}

      {step === "sheet" && sheet && (
        <section className="mt-5 space-y-4">
          {sheet.reliable && <p className="text-sm text-muted">基于三档测试的估算，建议先去训练场验证。</p>}
          {!sheet.reliable && (
            <p className="border border-accent bg-surface px-3 py-3 text-sm leading-6 text-fg">
              寻优命中少：起点，先去训练场验证。
            </p>
          )}
          <div className="grid gap-4 grid-cols-1">
            <article className="border border-border bg-surface p-4">
              <div>
                <p className="text-xs text-primary">使命召唤手游 · 整数</p>
                <h2 className="mt-1 font-display text-xl text-fg">灵敏度</h2>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-muted">
                <li>模式：固定速度。切换：开镜时切换。全局：自定义。</li>
                <li>陀螺仪：{sheet.gyroLabel}。数字是滑条整数，不要填成百分比。</li>
              </ul>
              <div className="result-grid mt-4">
                {sheet.rows.map((row) => (
                  <div key={row.name} className="border-b border-border pb-2">
                    <p className="text-sm text-muted">{row.name}</p>
                    <div className={cn("mt-1 grid gap-2", sheet.showGyro ? "grid-cols-3" : "grid-cols-2")}>
                      <Num label="镜头" value={String(row.camera)} compact />
                      <Num label="开火" value={String(row.fire)} compact />
                      {sheet.showGyro && <Num label="陀螺仪" value={String(row.gyro)} compact />}
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="surface" className="mt-4 w-full" onClick={() => copy("cod")}>
                <Copy className="size-4" />
                {copied === "cod" ? "已复制" : "复制使命召唤"}
              </Button>
            </article>
          </div>

          <div className="border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-fg" htmlFor="bias">
                整体偏快或偏慢
              </label>
              <span className="font-display text-lg text-primary tabular-nums">
                {bias > 0 ? "+" : ""}
                {Math.round(bias * 100)}%
              </span>
            </div>
            <input
              id="bias"
              type="range"
              min={-25}
              max={25}
              step={1}
              value={Math.round(bias * 100)}
              onChange={(e) => setBias(Number(e.target.value) / 100)}
              className="mt-3 w-full accent-primary"
            />
            <p className="mt-2 text-sm text-muted">进游戏拖两把。整体飘就往左，跟不上就往右。陀螺仪不受这个滑条影响。</p>
          </div>

          <div className="border border-border bg-bg p-4">
            <h2 className="font-display text-lg text-fg">为什么是这组数</h2>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-muted">
              {sheet.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <Button type="button" size="lg" className="w-full" onClick={() => copy("all")}>
            <Copy className="size-4" />
            {copied === "all" ? "已复制整套" : "复制整套数值"}
          </Button>
          {copyFailed && <p role="status" className="text-accent">复制失败，请长按下方文字手动复制。</p>}
          <pre className="break-words border border-border bg-surface p-3 text-xs leading-5 text-fg whitespace-pre-wrap">
            {sheet.copyText}
          </pre>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("range")}>
            回去重测某一项
          </Button>
        </section>
      )}

      {active && launch && (
        <AimRange
          key={launch.nonce}
          title={active.title}
          blurb={active.blurb}
          kind={active.kind}
          gains={active.kind === "ladder" ? ladderGains(profile) : [workingGain(profile, stats)]}
          roundLabels={active.kind === "ladder" ? ["低", "中", "高"] : ["测"]}
          duration={active.seconds * 1000}
          onFinish={onFinish}
          onClose={() => setLaunch(null)}
        />
      )}
    </main>
  );
}

function Num({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("rounded-md bg-bg px-3 py-2", compact && "px-2")}>
      <p className="text-xs text-muted">{label}</p>
      <button type="button" className="min-h-11 w-full text-left font-display text-2xl text-fg tabular-nums" onClick={async () => { try { await navigator.clipboard.writeText(value); setFailed(false); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); setFailed(true); } }} aria-label={`复制${label} ${value}`}>{value} <span className="text-xs text-muted">{copied ? "已复制" : failed ? "复制失败，请手动选择下方整段" : "复制"}</span></button>
    </div>
  );
}
