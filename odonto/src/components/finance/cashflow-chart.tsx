// Hello World
"use client";

import { useMemo, useRef, useState } from "react";
import { formatDateBR } from "@/domain/dates";
import { formatBRL } from "@/domain/money";

interface Day {
  date: string;
  realizedBalance: number | null;
  projectedBalance: number;
  realizedIn: number;
  realizedOut: number;
  projectedIn: number;
  projectedOut: number;
}

const W = 960;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 72 };

function niceTicks(min: number, max: number, count = 4): number[] {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const start = Math.floor(min / step) * step;
  const out: number[] = [];
  // O último tick sempre cobre o valor máximo (nada fica fora do quadro).
  for (let v = start; v < max + step; v += step) out.push(v);
  return out;
}

/** Saldo diário: realizado (linha contínua) e projetado (tracejada), mesmo eixo. */
export function CashflowChart({ days, baseDate }: { days: Day[]; baseDate: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const { x, y, ticks, realizedPath, projectedPath } = useMemo(() => {
    const values = days.flatMap((d) => [d.projectedBalance, d.realizedBalance ?? d.projectedBalance]);
    const min = Math.min(0, ...values);
    const max = Math.max(...values, 1);
    const ticks = niceTicks(min, max);
    const lo = ticks[0]!;
    const hi = ticks[ticks.length - 1]!;
    const x = (i: number) => PAD.left + (days.length <= 1 ? 0 : (i * (W - PAD.left - PAD.right)) / (days.length - 1));
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.top - PAD.bottom);
    const realizedPts = days.map((d, i) => (d.realizedBalance === null ? null : `${x(i)},${y(d.realizedBalance)}`)).filter(Boolean);
    const lastRealized = days.reduce((acc, d, i) => (d.realizedBalance !== null ? i : acc), -1);
    const projectedPts = days.map((d, i) => (i >= Math.max(lastRealized, 0) ? `${x(i)},${y(d.projectedBalance)}` : null)).filter(Boolean);
    return { x, y, ticks, realizedPath: realizedPts.length ? `M${realizedPts.join("L")}` : "", projectedPath: projectedPts.length > 1 ? `M${projectedPts.join("L")}` : "" };
  }, [days]);

  if (days.length === 0) return null;
  const h = hover !== null ? days[hover] : null;
  const summary = `Saldo de ${formatDateBR(days[0]!.date)} a ${formatDateBR(days[days.length - 1]!.date)}: inicia em ${formatBRL(days[0]!.realizedBalance ?? days[0]!.projectedBalance)} e termina projetado em ${formatBRL(days[days.length - 1]!.projectedBalance)}.`;

  return (
    <figure className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-muted" aria-hidden="true">
        <span className="inline-flex items-center gap-2">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--accent)" strokeWidth="2" />
          </svg>
          Realizado (até {formatDateBR(baseDate)})
        </span>
        <span className="inline-flex items-center gap-2">
          <svg width="24" height="8">
            <line x1="0" y1="4" x2="24" y2="4" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" />
          </svg>
          Projetado (títulos em aberto)
        </span>
      </div>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none"
        role="img"
        aria-label={summary}
        onPointerMove={(e) => {
          const r = ref.current!.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (days.length - 1));
          setHover(Math.max(0, Math.min(days.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.5 : 1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--text-subtle)">
              {formatBRL(t).replace(",00", "")}
            </text>
          </g>
        ))}
        {[0, Math.floor((days.length - 1) / 2), days.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--text-subtle)">
            {formatDateBR(days[i]!.date).slice(0, 5)}
          </text>
        ))}
        <path d={projectedPath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="6 5" strokeLinejoin="round" />
        <path d={realizedPath} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {hover !== null && h ? (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-subtle)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(h.realizedBalance ?? h.projectedBalance)} r="4.5" fill="var(--accent)" stroke="#fff" strokeWidth="2" />
          </g>
        ) : null}
      </svg>
      {hover !== null && h ? (
        <div
          className="pointer-events-none absolute top-8 z-10 w-56 rounded-md border border-border bg-white p-3 text-xs shadow-lg"
          style={{ left: `clamp(0px, calc(${(x(hover) / W) * 100}% + 12px), calc(100% - 14rem))` }}
          role="status"
        >
          <p className="font-medium">{formatDateBR(h.date)}</p>
          {h.realizedBalance !== null ? (
            <>
              <p className="mt-1 flex justify-between gap-2 text-muted">
                Saldo realizado <span className="tabular text-fg">{formatBRL(h.realizedBalance)}</span>
              </p>
              <p className="flex justify-between gap-2 text-muted">
                Entradas <span className="tabular text-fg">{formatBRL(h.realizedIn)}</span>
              </p>
              <p className="flex justify-between gap-2 text-muted">
                Saídas <span className="tabular text-fg">{formatBRL(h.realizedOut)}</span>
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 flex justify-between gap-2 text-muted">
                Saldo projetado <span className="tabular text-fg">{formatBRL(h.projectedBalance)}</span>
              </p>
              <p className="flex justify-between gap-2 text-muted">
                A receber <span className="tabular text-fg">{formatBRL(h.projectedIn)}</span>
              </p>
              <p className="flex justify-between gap-2 text-muted">
                A pagar <span className="tabular text-fg">{formatBRL(h.projectedOut)}</span>
              </p>
            </>
          )}
        </div>
      ) : null}
    </figure>
  );
}
