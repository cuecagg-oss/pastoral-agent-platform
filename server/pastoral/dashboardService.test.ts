import { describe, expect, it } from "vitest";
import { buildDashboardOverview } from "./dashboardService";

const now = new Date("2026-08-15T12:00:00.000Z");
const daysBefore = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("buildDashboardOverview", () => {
  it("calcula métricas, pendências e tendências a partir de agregados do tenant", () => {
    const overview = buildDashboardOverview({
      cells: [{ id: 1, active: true }, { id: 2, active: true }],
      meetings: [
        { cellId: 1, occurredAt: daysBefore(2), wasHeld: true, attendanceCount: 12 },
        { cellId: 2, occurredAt: daysBefore(2), wasHeld: false, attendanceCount: 0 },
        { cellId: 1, occurredAt: daysBefore(9), wasHeld: true, attendanceCount: 8 },
      ],
      reports: [{ cellId: 2, delivered: false }],
      visitors: [{ firstVisitAt: daysBefore(2), followedUp: false }],
      leaders: [{ attentionNote: "Acompanhar" }, { attentionNote: null }],
      memberCount: 7,
    }, now);

    expect(overview.metrics).toMatchObject({
      activeCells: 2,
      completedCells: 1,
      pendingCells: 1,
      totalAttendance: 12,
      averageAttendancePerCell: 12,
      visitors: 1,
      registeredPeople: 7,
      leaders: 2,
    });
    expect(overview.pending).toEqual({ pendingReports: 1, missedMeetings: 1, visitorsWithoutFollowup: 1, leadersRequiringAttention: 1 });
    expect(overview.pendingScopes).toMatchObject({
      reports: { kind: "reporting_cycle" },
      missedMeetings: { label: "Últimos 7 dias" },
      visitorsWithoutFollowup: { kind: "open_records" },
      leadersRequiringAttention: { kind: "current_leadership_notes" },
    });
    expect(overview.trends.attendance).toMatchObject({ status: "available", direction: "up", percentageChange: 50 });
    expect(overview.intelligence).toMatchObject({ mode: "rules", generativeStatus: "unavailable" });
    expect(overview.intelligence.insights.map(insight => insight.id)).toEqual(["pending_reports", "visitor_followup", "missed_meetings", "leader_attention"]);
  });

  it("não inventa tendência quando não há base comparável", () => {
    const overview = buildDashboardOverview({
      cells: [], meetings: [], reports: [], visitors: [], leaders: [], memberCount: 0,
    }, now);

    expect(overview.metrics.averageAttendancePerCell).toBeNull();
    expect(overview.trends.attendance).toMatchObject({ status: "insufficient_data", currentValue: 0, previousValue: 0 });
    expect(overview.intelligence.insights).toEqual([expect.objectContaining({ id: "all_clear", priority: "info" })]);
  });
});
