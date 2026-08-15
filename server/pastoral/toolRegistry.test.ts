import { describe, expect, it } from "vitest";
import { chooseReadTool, extractVisitorName, isFollowupIntent, isOrganizationCountIntent } from "./toolRegistry";

describe("Tool Registry pastoral", () => {
  it("seleciona apenas ferramentas registradas para perguntas do MVP", () => {
    expect(chooseReadTool("Quantas células realizaram reunião esta semana?")).toBe("consultar_presenca");
    expect(chooseReadTool("Quais células ainda não entregaram relatório?")).toBe("consultar_relatorios");
    expect(chooseReadTool("Quais visitantes ainda não receberam acompanhamento?")).toBe("consultar_visitantes");
  });

  it("detecta uma intenção de escrita sem aceitar SQL", () => {
    const message = "Registre que o pastor entrou em contato com João hoje.";
    expect(isFollowupIntent(message)).toBe(true);
    expect(extractVisitorName(message)).toBe("João");
  });

  it("detecta contagem de igrejas como pergunta fora do escopo do tenant", () => {
    expect(isOrganizationCountIntent("Quantas igrejas existem?")).toBe(true);
    expect(isOrganizationCountIntent("Qual é o total de organizações?")).toBe(true);
    expect(isOrganizationCountIntent("Quantas células tem nossa igreja?")).toBe(false);
  });
});
