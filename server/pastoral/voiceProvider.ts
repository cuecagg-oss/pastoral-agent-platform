import { transcribeAudio } from "../_core/voiceTranscription";

export type VoiceProvider = {
  transcribe(audioUrl: string): Promise<{ text: string; provider: string }>;
};

export type VoiceProviderResolution = {
  requested: string;
  active: "built-in";
  usedFallback: boolean;
};

class BuiltInVoiceProvider implements VoiceProvider {
  async transcribe(audioUrl: string) {
    const response = await transcribeAudio({ audioUrl, language: "pt", prompt: "Transcrição de comando pastoral em português brasileiro." });
    if (!response || !("text" in response) || typeof response.text !== "string" || !response.text.trim()) {
      throw new Error("Não foi possível transcrever este áudio.");
    }
    return { text: response.text.trim(), provider: "built-in-whisper" };
  }
}

export function resolveVoiceProvider(): VoiceProviderResolution {
  const requested = process.env.VOICE_PROVIDER?.trim().toLowerCase() || "built-in";
  return { requested, active: "built-in", usedFallback: requested !== "built-in" };
}

export function getVoiceProvider(): VoiceProvider {
  return new BuiltInVoiceProvider();
}
