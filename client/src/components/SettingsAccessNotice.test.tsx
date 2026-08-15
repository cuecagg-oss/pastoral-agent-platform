import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { navigationItems } from "./DashboardLayout";
import { SettingsAccessDeniedCard } from "../pages/Settings";

describe("Configurações administrativas", () => {
  it("mantém a rota de Configurações na navegação administrativa", () => {
    expect(navigationItems).toContainEqual(expect.objectContaining({ label: "Configurações", path: "/configuracoes" }));
  });

  it("comunica o bloqueio visual quando a membership não é administrativa", () => {
    const html = renderToStaticMarkup(<SettingsAccessDeniedCard />);

    expect(html).toContain("Acesso administrativo necessário");
    expect(html).toContain("não permite consultar ou alterar");
  });
});
