import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { VoiceConversationPanel } from "../pages/PastoralChat";

describe("VoiceConversationPanel", () => {
  it("mostra a falha persistente quando TTS está disponível, mas não inicia", () => {
    const markup = renderToStaticMarkup(
      <VoiceConversationPanel
        isSynthesisAvailable
        latestAnswer="Resposta pastoral"
        playbackIssue="A leitura em voz alta não iniciou. A resposta continua disponível no histórico."
        onSpeakLatest={() => undefined}
      />,
    );

    expect(markup).toContain("A leitura em voz alta não iniciou. A resposta continua disponível no histórico.");
    expect(markup).not.toContain("A síntese de voz não está disponível neste navegador.");
    expect(markup).not.toMatch(/<button[^>]*\sdisabled(?:\s|>)/);
  });

  it("mostra apenas a indisponibilidade quando TTS não existe", () => {
    const markup = renderToStaticMarkup(
      <VoiceConversationPanel
        isSynthesisAvailable={false}
        latestAnswer="Resposta pastoral"
        playbackIssue="A leitura em voz alta não iniciou. A resposta continua disponível no histórico."
        onSpeakLatest={() => undefined}
      />,
    );

    expect(markup).toContain("A síntese de voz não está disponível neste navegador.");
    expect(markup).not.toContain("A leitura em voz alta não iniciou.");
    expect(markup).toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
  });
});
