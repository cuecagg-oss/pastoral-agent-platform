export type DashboardSummary = {
  cells: number;
  pendingReports: number;
  openVisitors: number;
};

export function hasNoPastoralRecords(summary: DashboardSummary | undefined) {
  return !!summary && summary.cells === 0 && summary.pendingReports === 0 && summary.openVisitors === 0;
}
