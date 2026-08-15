import { Button } from "@/components/ui/button";
import { Sparkles, Volume2 } from "lucide-react";
import * as React from "react";

export function getVoiceSynthesisFallbackMessage(isAvailable: boolean) {
  return isAvailable ? null : "A síntese de voz não está disponível neste navegador. A resposta continuará disponível no histórico.";
}

export function getVoicePlaybackIssue(isAvailable: boolean, didStart: boolean) {
  return isAvailable && !didStart
    ? "A leitura em voz alta não iniciou. A resposta continua disponível no histórico."
    : null;
}

type VoiceFeatureCardProps = {
  isSynthesisAvailable: boolean;
  hasLatestAnswer: boolean;
  onSpeakLatest: () => void;
  playbackIssue?: string | null;
};

export function VoiceFeatureCard({ isSynthesisAvailable, hasLatestAnswer, onSpeakLatest, playbackIssue }: VoiceFeatureCardProps) {
  const fallbackMessage = getVoiceSynthesisFallbackMessage(isSynthesisAvailable);
  const visiblePlaybackIssue = isSynthesisAvailable ? playbackIssue : null;

  return (
    <div className="rounded-2xl border border-[#e7e1d4] bg-card p-5 shadow-sm">
      <h2 className="font-semibold text-[#173b34]">Voz</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">Envie uma mensagem de voz. O áudio é interpretado internamente; o histórico mostra a mensagem de voz, sem exibir a transcrição, e registra a resposta do assistente.</p>
      {fallbackMessage ? <p className="mt-3 text-xs leading-5 text-muted-foreground" role="status">{fallbackMessage}</p> : null}
      {visiblePlaybackIssue ? <p className="mt-3 rounded-lg bg-[#fff5e8] px-3 py-2 text-xs leading-5 text-[#7c4a16]" role="status">{visiblePlaybackIssue}</p> : null}
      <Button variant="outline" className="mt-4 w-full" onClick={onSpeakLatest} disabled={!hasLatestAnswer || !isSynthesisAvailable}>
        <Volume2 className="mr-2 size-4" /> Ouvir última resposta
      </Button>
    </div>
  );
}
