import { describe, expect, it } from "vitest";
import { extractVoiceAgentReply, playVoiceResponse, type VoiceUtterance } from "./voiceInteraction";

describe("contrato de interação por voz", () => {
  it("aceita somente a resposta final do agente aninhada no payload", () => {
    expect(extractVoiceAgentReply({ response: { content: "A Igreja Demonstração A possui 4 células." } })).toMatchObject({ content: "A Igreja Demonstração A possui 4 células." });
  });

  it("não usa nem expõe uma transcrição bruta como resposta", () => {
    expect(extractVoiceAgentReply({ text: "Quantas células temos?" })).toBeNull();
    expect(extractVoiceAgentReply({ response: { content: "" }, text: "Quantas células temos?" })).toBeNull();
  });

  it("confirma sucesso somente quando o sintetizador inicia a fala", async () => {
    let utterance: VoiceUtterance | undefined;
    const started = playVoiceResponse({
      content: "Resposta pastoral",
      synthesis: { cancel: () => undefined, speak: next => { utterance = next; queueMicrotask(() => next.onstart?.()); } },
      createUtterance: () => ({ lang: "", onstart: null, onerror: null }),
    });

    await expect(started).resolves.toBe(true);
    expect(utterance?.lang).toBe("pt-BR");
  });

  it("reporta falha quando o sintetizador rejeita a reprodução", async () => {
    const started = playVoiceResponse({
      content: "Resposta pastoral",
      synthesis: { cancel: () => undefined, speak: utterance => queueMicrotask(() => utterance.onerror?.()) },
      createUtterance: () => ({ lang: "", onstart: null, onerror: null }),
    });

    await expect(started).resolves.toBe(false);
  });
});
