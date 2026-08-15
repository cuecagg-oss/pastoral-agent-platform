import { describe, expect, it } from "vitest";
import { hasNoPastoralRecords } from "./dashboardState";

describe("estado do dashboard", () => {
  it("identifica uma organização sem registros pastorais", () => {
    expect(hasNoPastoralRecords({ cells: 0, pendingReports: 0, openVisitors: 0 })).toBe(true);
  });

  it("mantém o dashboard normal quando houver algum registro", () => {
    expect(hasNoPastoralRecords({ cells: 1, pendingReports: 0, openVisitors: 0 })).toBe(false);
  });
});
