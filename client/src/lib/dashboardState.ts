export type DashboardSummary = {
  cells: number;
  pendingReports: number;
  openVisitors: number;
};

export type DashboardMetrics = {
  activeCells: number;
  completedCells: number;
  pendingCells: number;
  totalAttendance: number;
  averageAttendancePerCell: number | null;
  visitors: number;
  registeredPeople: number;
  leaders: number;
};

export function hasNoPastoralRecords(summary: DashboardSummary | undefined) {
  return !!summary && summary.cells === 0 && summary.pendingReports === 0 && summary.openVisitors === 0;
}

export function hasNoDashboardRecords(metrics: DashboardMetrics | undefined) {
  return !!metrics && metrics.activeCells === 0 && metrics.completedCells === 0 && metrics.totalAttendance === 0 && metrics.visitors === 0 && metrics.registeredPeople === 0 && metrics.leaders === 0;
}
