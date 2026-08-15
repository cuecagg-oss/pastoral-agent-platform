import type { PastoralRepository, TenantContext } from "./types";
import type { VoiceProvider } from "./voiceProvider";

type VoiceStorage = (key: string, data: Uint8Array, contentType: string) => Promise<{ url: string }>;

type TranscribeVoiceInput = {
  context: TenantContext;
  audioBytes: Uint8Array;
  mimeType: string;
  storagePut: VoiceStorage;
  getVoice: () => VoiceProvider;
  repository: Pick<PastoralRepository, "audit">;
};

function extensionFor(mimeType: string) {
  return mimeType.split("/")[1]?.replace("mpeg", "mp3") || "webm";
}

export async function transcribeVoiceInput(input: TranscribeVoiceInput) {
  try {
    const key = `pastoral-audio/${input.context.organizationId}/${input.context.userId}/${Date.now()}.${extensionFor(input.mimeType)}`;
    const stored = await input.storagePut(key, input.audioBytes, input.mimeType);
    const transcript = await input.getVoice().transcribe(stored.url);
    await input.repository.audit({
      context: input.context,
      action: "voice.transcribe",
      agent: "voice-gateway",
      model: transcript.provider,
      status: "success",
      metadata: { provider: transcript.provider },
    });
    return transcript;
  } catch (error) {
    try {
      await input.repository.audit({
        context: input.context,
        action: "voice.transcribe",
        agent: "voice-gateway",
        status: "failure",
        metadata: { reason: error instanceof Error ? error.message.slice(0, 120) : "voice_provider_error" },
      });
    } catch {
      // A falha original de transcrição deve continuar sendo reportada mesmo se o audit log também estiver indisponível.
    }
    throw new Error("Não foi possível transcrever o áudio. Tente novamente ou envie a mensagem em texto.");
  }
}
