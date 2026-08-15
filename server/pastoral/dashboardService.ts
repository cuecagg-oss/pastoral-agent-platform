import type { DashboardInsight, DashboardOverview, DashboardTrend } from "./types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PERIOD_DAYS = 7;
const PERIOD_LABEL = "Últimos 7 dias";

type DashboardCell = { id: number; active: boolean };
type DashboardMeeting = { cellId: number; occurredAt: Date; wasHeld: boolean; attendanceCount: number };
type DashboardReport = { cellId: number; delivered: boolean };
type DashboardVisitor = { firstVisitAt: Date; followedUp: boolean };
type DashboardLeader = { attentionNote: string | null };

export type DashboardSource = {
  cells: DashboardCell[];
  meetings: DashboardMeeting[];
  reports: DashboardReport[];
  visitors: DashboardVisitor[];
  leaders: DashboardLeader[];
  memberCount: number;
};

function isInRange(value: Date, startAt: Date, endAt: Date) {
  const timestamp = value.getTime();
  return timestamp >= startAt.getTime() && timestamp < endAt.getTime();
}

function calculateTrend(currentValue: number, previousValue: number): DashboardTrend {
  if (currentValue === 0 || previousValue === 0) {
    return {
      status: "insufficient_data",
      currentValue,
      previousValue,
      reason: "São necessários dados comparáveis nos dois períodos para calcular a tendência.",
    };
  }

  const percentageChange = Math.round(((currentValue - previousValue) / previousValue) * 100);
  return {
    status: "available",
    direction: percentageChange > 0 ? "up" : percentageChange < 0 ? "down" : "stable",
    currentValue,
    previousValue,
    percentageChange,
  };
}

function createInsights(input: {
  pendingReports: number;
  visitorsWithoutFollowup: number;
  missedMeetings: number;
  leadersRequiringAttention: number;
}): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  if (input.pendingReports > 0) {
    insights.push({
      id: "pending_reports",
      title: "Relatórios requerem atenção",
      priority: "high",
      summary: `${input.pendingReports} relatório${input.pendingReports === 1 ? "" : "s"} ainda ${input.pendingReports === 1 ? "aguarda" : "aguardam"} envio neste período.`,
      periodLabel: PERIOD_LABEL,
      metrics: { pendingReports: input.pendingReports },
    });
  }
  if (input.visitorsWithoutFollowup > 0) {
    insights.push({
      id: "visitor_followup",
      title: "Visitantes aguardam acompanhamento",
      priority: "high",
      summary: `${input.visitorsWithoutFollowup} visitante${input.visitorsWithoutFollowup === 1 ? " está" : "s estão"} sem retorno registrado.`,
      periodLabel: PERIOD_LABEL,
      metrics: { visitorsWithoutFollowup: input.visitorsWithoutFollowup },
    });
  }
  if (input.missedMeetings > 0) {
    insights.push({
      id: "missed_meetings",
      title: "Reuniões não concluídas",
      priority: "medium",
      summary: `${input.missedMeetings} célula${input.missedMeetings === 1 ? " não realizou" : "s não realizaram"} reunião no período.`,
      periodLabel: PERIOD_LABEL,
      metrics: { missedMeetings: input.missedMeetings },
    });
  }
  if (input.leadersRequiringAttention > 0) {
    insights.push({
      id: "leader_attention",
      title: "Lideranças com observação",
      priority: "medium",
      summary: `${input.leadersRequiringAttention} liderança${input.leadersRequiringAttention === 1 ? " possui" : "s possuem"} observação de acompanhamento.`,
      periodLabel: PERIOD_LABEL,
      metrics: { leadersRequiringAttention: input.leadersRequiringAttention },
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "all_clear",
      title: "Nenhuma pendência objetiva identificada",
      priority: "info",
      summary: "Não há relatórios pendentes, visitantes sem retorno, reuniões não concluídas ou observações de liderança registradas.",
      periodLabel: PERIOD_LABEL,
      metrics: {},
    });
  }
  return insights;
}

export function buildDashboardOverview(source: DashboardSource, now = new Date()): DashboardOverview {
  const endAt = new Date(now);
  const startAt = new Date(endAt.getTime() - PERIOD_DAYS * DAY_IN_MS);
  const previousStartAt = new Date(startAt.getTime() - PERIOD_DAYS * DAY_IN_MS);
  const currentMeetings = source.meetings.filter(meeting => isInRange(meeting.occurredAt, startAt, endAt));
  const previousMeetings = source.meetings.filter(meeting => isInRange(meeting.occurredAt, previousStartAt, startAt));
  const completedMeetings = currentMeetings.filter(meeting => meeting.wasHeld);
  const previousCompletedMeetings = previousMeetings.filter(meeting => meeting.wasHeld);
  const missedMeetings = currentMeetings.filter(meeting => !meeting.wasHeld);
  const pendingReports = source.reports.filter(report => !report.delivered);
  const pendingCellIds = new Set([...pendingReports.map(report => report.cellId), ...missedMeetings.map(meeting => meeting.cellId)]);
  const totalAttendance = completedMeetings.reduce((total, meeting) => total + Math.max(0, meeting.attendanceCount), 0);
  const previousAttendance = previousCompletedMeetings.reduce((total, meeting) => total + Math.max(0, meeting.attendanceCount), 0);
  const visitors = source.visitors.filter(visitor => isInRange(visitor.firstVisitAt, startAt, endAt));
  const visitorsWithoutFollowup = source.visitors.filter(visitor => !visitor.followedUp);
  const leadersRequiringAttention = source.leaders.filter(leader => Boolean(leader.attentionNote?.trim()));

  return {
    period: { label: PERIOD_LABEL, startAt, endAt, days: PERIOD_DAYS },
    metrics: {
      activeCells: source.cells.filter(cell => cell.active).length,
      completedCells: completedMeetings.length,
      pendingCells: pendingCellIds.size,
      totalAttendance,
      averageAttendancePerCell: completedMeetings.length ? Math.round((totalAttendance / completedMeetings.length) * 10) / 10 : null,
      visitors: visitors.length,
      registeredPeople: source.memberCount,
      leaders: source.leaders.length,
    },
    pending: {
      pendingReports: pendingReports.length,
      missedMeetings: missedMeetings.length,
      visitorsWithoutFollowup: visitorsWithoutFollowup.length,
      leadersRequiringAttention: leadersRequiringAttention.length,
    },
    pendingScopes: {
      reports: {
        kind: "reporting_cycle",
        label: "Ciclo de relatórios em aberto",
        explanation: "Inclui relatórios ainda não entregues no ciclo de prestação de contas registrado pela organização.",
      },
      missedMeetings: {
        kind: "reporting_cycle",
        label: PERIOD_LABEL,
        explanation: "Inclui reuniões registradas como não realizadas dentro dos últimos 7 dias.",
      },
      visitorsWithoutFollowup: {
        kind: "open_records",
        label: "Acompanhamentos em aberto",
        explanation: "Inclui visitantes da organização que ainda não possuem retorno registrado, independentemente da data da primeira visita.",
      },
      leadersRequiringAttention: {
        kind: "current_leadership_notes",
        label: "Observações de liderança atuais",
        explanation: "Inclui lideranças com observação ativa; o domínio ainda não possui data própria de atualização dessa observação.",
      },
    },
    trends: {
      attendance: calculateTrend(totalAttendance, previousAttendance),
      completedCells: calculateTrend(completedMeetings.length, previousCompletedMeetings.length),
    },
    intelligence: {
      mode: "rules",
      generativeStatus: "unavailable",
      unavailableReason: "Insights generativos ainda não estão habilitados; os avisos exibidos usam somente regras objetivas e agregados sanitizados.",
      insights: createInsights({
        pendingReports: pendingReports.length,
        visitorsWithoutFollowup: visitorsWithoutFollowup.length,
        missedMeetings: missedMeetings.length,
        leadersRequiringAttention: leadersRequiringAttention.length,
      }),
    },
  };
}
