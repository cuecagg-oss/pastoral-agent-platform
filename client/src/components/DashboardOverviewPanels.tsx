import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, BrainCircuit, CheckCircle2, CircleDashed, Sparkles } from "lucide-react";
import * as React from "react";

export type TrendView = { status: "available" | "insufficient_data"; direction?: "up" | "down" | "stable"; currentValue: number; previousValue: number; percentageChange?: number; reason?: string };
export type InsightView = { id: string; title: string; priority: "high" | "medium" | "info"; summary: string; periodLabel: string; metrics: Record<string, number> };
export type PendingScopeView = { kind: string; label: string; explanation: string };

const priorityStyle = { high: "border-[#f1c8bd] bg-[#fff8f5] text-[#9b3d27]", medium: "border-[#f2d9a4] bg-[#fffbf1] text-[#9a6414]", info: "border-[#d6e2d7] bg-[#f7fbf6] text-[#37634a]" } as const;
const formatNumber = (value: number) => new Intl.NumberFormat("pt-BR").format(value);

export function TrendCard({ label, trend }: { label: string; trend: TrendView }) {
  if (trend.status === "insufficient_data") return <Card className="border-[#e7e1d4] bg-[#fffdf8] shadow-sm"><CardContent className="p-5"><p className="text-sm font-semibold text-[#173b34]">{label}</p><div className="mt-3 flex items-start gap-3 text-sm leading-6 text-muted-foreground"><CircleDashed className="mt-0.5 size-4 shrink-0 text-[#9a8e78]" /><span>{trend.reason ?? "Ainda não há dados comparáveis para esta tendência."}</span></div></CardContent></Card>;
  const isUp = trend.direction === "up";
  const isDown = trend.direction === "down";
  const Icon = isUp ? ArrowUpRight : isDown ? ArrowDownRight : ArrowRight;
  const tone = isUp ? "text-[#24714d]" : isDown ? "text-[#a0442a]" : "text-[#736957]";
  const direction = isUp ? "em alta" : isDown ? "em queda" : "estável";
  return <Card className="border-[#e7e1d4] bg-[#fffdf8] shadow-sm"><CardContent className="p-5"><p className="text-sm font-semibold text-[#173b34]">{label}</p><div className={`mt-3 flex items-center gap-2 text-lg font-semibold ${tone}`}><Icon className="size-5" />{Math.abs(trend.percentageChange ?? 0)}% <span className="text-sm font-medium">{direction}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{formatNumber(trend.currentValue)} no período atual · {formatNumber(trend.previousValue)} no período anterior</p></CardContent></Card>;
}

export function IntelligencePanel({ insights, generativeStatus, unavailableReason }: { insights: InsightView[]; generativeStatus: "available" | "unavailable"; unavailableReason?: string }) {
  return <Card className="border-[#dce5db] bg-[#fbfdf9] shadow-sm"><CardContent className="p-5 md:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#e2efe6] text-[#24714d]"><BrainCircuit className="size-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#56705e]">Camada inteligente</p><h2 className="mt-1 font-['Fraunces'] text-2xl font-semibold text-[#173b34]">Sinais para acompanhar</h2></div></div><Badge variant="outline" className="border-[#cfe0d0] bg-white text-[#37634a]">Regras objetivas</Badge></div><div className="mt-5 grid gap-3">{insights.map(insight => <article key={insight.id} className={`rounded-2xl border p-4 ${priorityStyle[insight.priority]}`}><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">{insight.title}</p><p className="mt-1 text-sm leading-6 opacity-90">{insight.summary}</p><p className="mt-2 text-xs font-medium opacity-80">Escopo: {insight.periodLabel}</p></div></div></article>)}</div>{generativeStatus === "unavailable" ? <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-[#cdd9ce] bg-white/70 p-4 text-sm leading-6 text-[#56705e]"><Sparkles className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold text-[#37634a]">Insights gerados por IA ainda não estão disponíveis.</p><p>{unavailableReason ?? "A visão continua usando regras objetivas sobre dados autorizados da sua igreja."}</p></div></div> : null}</CardContent></Card>;
}

export function PendingScopeList({ scopes }: { scopes: Array<{ label: string; scope: PendingScopeView }> }) {
  return <Card className="border-[#e7e1d4] bg-white shadow-sm"><CardContent className="p-5 md:p-6"><div className="flex items-center gap-3"><CheckCircle2 className="size-5 text-[#24714d]" /><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#56705e]">Como ler as pendências</p><h2 className="mt-1 font-['Fraunces'] text-2xl font-semibold text-[#173b34]">Escopos transparentes</h2></div></div><dl className="mt-5 grid gap-4 sm:grid-cols-2">{scopes.map(({ label, scope }) => <div key={label} className="rounded-xl bg-[#faf8f2] p-4"><dt className="text-sm font-semibold text-[#173b34]">{label}: {scope.label}</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">{scope.explanation}</dd></div>)}</dl></CardContent></Card>;
}
