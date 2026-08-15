import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { IntelligencePanel, PendingScopeList, TrendCard } from "./DashboardOverviewPanels";

describe("painéis do Dashboard", () => {
  it("apresenta tendência indisponível e a indisponibilidade explícita de IA sem fabricar insight generativo", () => {
    const markup = renderToStaticMarkup(<><TrendCard label="Presença" trend={{ status: "insufficient_data", currentValue: 0, previousValue: 0, reason: "Base comparável insuficiente." }} /><IntelligencePanel generativeStatus="unavailable" unavailableReason="Somente regras objetivas estão ativas." insights={[{ id: "all_clear", title: "Nenhuma pendência objetiva identificada", priority: "info", summary: "Sem alertas.", periodLabel: "Últimos 7 dias", metrics: {} }]} /></>);
    expect(markup).toContain("Base comparável insuficiente.");
    expect(markup).toContain("Insights gerados por IA ainda não estão disponíveis.");
    expect(markup).toContain("Nenhuma pendência objetiva identificada");
  });

  it("explica o escopo de pendências sem esconder a regra aplicada", () => {
    const markup = renderToStaticMarkup(<PendingScopeList scopes={[{ label: "Relatórios", scope: { kind: "reporting_cycle", label: "Ciclo de relatórios em aberto", explanation: "Inclui relatórios não entregues." } }]} />);
    expect(markup).toContain("Ciclo de relatórios em aberto");
    expect(markup).toContain("Inclui relatórios não entregues.");
  });
});
