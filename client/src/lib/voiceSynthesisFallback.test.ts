import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { getVoicePlaybackIssue, getVoiceSynthesisFallbackMessage, VoiceFeatureCard } from "../components/VoiceFeatureCard";

describe("getVoiceSynthesisFallbackMessage", () => {
  it("mantém uma mensagem visual clara quando TTS não está disponível", () => {
    expect(getVoiceSynthesisFallbackMessage(false)).toBe("A síntese de voz não está disponível neste navegador. A resposta continuará disponível no histórico.");
  });

  it("não exibe fallback quando TTS está disponível", () => {
    expect(getVoiceSynthesisFallbackMessage(true)).toBeNull();
  });

  it("só produz aviso de falha quando TTS está disponível, mas não inicia", () => {
    expect(getVoicePlaybackIssue(true, false)).toBe("A leitura em voz alta não iniciou. A resposta continua disponível no histórico.");
    expect(getVoicePlaybackIssue(false, false)).toBeNull();
    expect(getVoicePlaybackIssue(true, true)).toBeNull();
  });

  it("renderiza o fallback e desabilita a ação de ouvir quando a síntese não está disponível", () => {
    const markup = renderToStaticMarkup(React.createElement(VoiceFeatureCard, {
      isSynthesisAvailable: false,
      hasLatestAnswer: true,
      onSpeakLatest: () => undefined,
    }));

    expect(markup).toContain("A síntese de voz não está disponível neste navegador.");
    expect(markup).toContain("Ouvir última resposta");
    expect(markup).toContain("disabled");
    expect(markup).not.toContain("A leitura em voz alta não iniciou.");
  });

  it("exibe um aviso persistente quando a síntese existe, mas não inicia", () => {
    const markup = renderToStaticMarkup(React.createElement(VoiceFeatureCard, {
      isSynthesisAvailable: true,
      hasLatestAnswer: true,
      onSpeakLatest: () => undefined,
      playbackIssue: getVoicePlaybackIssue(true, false),
    }));

    expect(markup).toContain("A leitura em voz alta não iniciou. A resposta continua disponível no histórico.");
    expect(markup).toContain("Ouvir última resposta");
    expect(markup).not.toMatch(/<button[^>]*\sdisabled(?:\s|>)/);
  });

  it("prioriza somente a indisponibilidade total quando o navegador não oferece síntese", () => {
    const markup = renderToStaticMarkup(React.createElement(VoiceFeatureCard, {
      isSynthesisAvailable: false,
      hasLatestAnswer: true,
      onSpeakLatest: () => undefined,
      playbackIssue: "A leitura em voz alta não iniciou. A resposta continua disponível no histórico.",
    }));

    expect(markup).toContain("A síntese de voz não está disponível neste navegador.");
    expect(markup).not.toContain("A leitura em voz alta não iniciou.");
  });
});
