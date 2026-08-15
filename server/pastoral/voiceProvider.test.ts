import { afterEach, describe, expect, it } from "vitest";
import { getVoiceProvider, resolveVoiceProvider } from "./voiceProvider";

const originalProvider = process.env.VOICE_PROVIDER;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.VOICE_PROVIDER;
  else process.env.VOICE_PROVIDER = originalProvider;
});

describe("VoiceProvider configurável", () => {
  it("usa built-in como padrão e expõe um contrato de transcrição", () => {
    delete process.env.VOICE_PROVIDER;
    expect(resolveVoiceProvider()).toEqual({ requested: "built-in", active: "built-in", usedFallback: false });
    expect(getVoiceProvider()).toMatchObject({ transcribe: expect.any(Function) });
  });

  it("faz fallback seguro para built-in quando o valor configurado ainda não tem adaptador", () => {
    process.env.VOICE_PROVIDER = "provedor-inexistente";
    expect(resolveVoiceProvider()).toEqual({ requested: "provedor-inexistente", active: "built-in", usedFallback: true });
    expect(getVoiceProvider()).toMatchObject({ transcribe: expect.any(Function) });
  });
});
