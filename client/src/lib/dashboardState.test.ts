import { describe, expect, it } from "vitest";
import { hasNoDashboardRecords, hasNoPastoralRecords } from "./dashboardState";

describe("estado do dashboard", () => {
  it("identifica uma organização sem registros pastorais", () => {
    expect(hasNoPastoralRecords({ cells: 0, pendingReports: 0, openVisitors: 0 })).toBe(true);
  });

  it("mantém o dashboard normal quando houver algum registro", () => {
    expect(hasNoPastoralRecords({ cells: 1, pendingReports: 0, openVisitors: 0 })).toBe(false);
  });

  it("identifica o vazio no contrato gerencial ampliado", () => {
    expect(hasNoDashboardRecords({ activeCells: 0, completedCells: 0, pendingCells: 0, totalAttendance: 0, averageAttendancePerCell: null, visitors: 0, registeredPeople: 0, leaders: 0 })).toBe(true);
    expect(hasNoDashboardRecords({ activeCells: 0, completedCells: 1, pendingCells: 0, totalAttendance: 0, averageAttendancePerCell: 12, visitors: 0, registeredPeople: 0, leaders: 0 })).toBe(false);
  });
});
