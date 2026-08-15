export type VoiceAgentReply = {
  content: string;
  confirmation?: {
    visitorId: number;
    visitorName: string;
    note: string;
    idempotencyKey: string;
  };
};

export type VoiceUtterance = {
  lang: string;
  onstart: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
};

export type VoiceSynthesis = {
  cancel: () => void;
  speak: (utterance: VoiceUtterance) => void;
};

export function extractVoiceAgentReply(payload: unknown): VoiceAgentReply | null {
  if (!payload || typeof payload !== "object") return null;
  const response = (payload as { response?: unknown }).response;
  if (!response || typeof response !== "object") return null;
  const content = (response as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim()) return null;
  return response as VoiceAgentReply;
}

export function canUseVoiceSynthesis(value: unknown): value is VoiceSynthesis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VoiceSynthesis>;
  return typeof candidate.cancel === "function" && typeof candidate.speak === "function";
}

export function playVoiceResponse(input: {
  content: string;
  synthesis: VoiceSynthesis;
  createUtterance: (content: string) => VoiceUtterance;
  timeoutMs?: number;
}): Promise<boolean> {
  return new Promise(resolve => {
    const utterance = input.createUtterance(input.content.replace(/[*#_`]/g, ""));
    utterance.lang = "pt-BR";
    let settled = false;
    const finish = (started: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(started);
    };
    const timeout = setTimeout(() => finish(false), input.timeoutMs ?? 2_500);
    utterance.onstart = () => finish(true);
    utterance.onerror = () => finish(false);
    try {
      input.synthesis.cancel();
      input.synthesis.speak(utterance);
    } catch {
      finish(false);
    }
  });
}
