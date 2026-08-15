import { describe, expect, it } from "vitest";
import { normalizeAudioMimeType } from "./voiceUploadRoute";

describe("rota binária de voz", () => {
  it("aceita os formatos do MediaRecorder, incluindo parâmetros de codec", () => {
    expect(normalizeAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMimeType("audio/ogg")).toBe("audio/ogg");
  });

  it("rejeita formatos que não são áudio suportado", () => {
    expect(normalizeAudioMimeType("application/json")).toBeNull();
    expect(normalizeAudioMimeType(undefined)).toBeNull();
  });
});
