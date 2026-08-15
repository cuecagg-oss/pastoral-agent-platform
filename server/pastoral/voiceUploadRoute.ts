import express, { type Express, type Request, type Response } from "express";
import { createContext } from "../_core/context";
import { storagePut } from "../storage";
import { getTenantContextForUser, DatabasePastoralRepository } from "./repository";
import { transcribeVoiceInput } from "./voiceGateway";
import { getVoiceProvider } from "./voiceProvider";

const ACCEPTED_AUDIO_TYPES = new Set(["audio/webm", "audio/ogg", "audio/wav", "audio/mpeg", "audio/mp4"]);

export function normalizeAudioMimeType(value: string | undefined) {
  const mimeType = value?.split(";")[0]?.trim().toLowerCase() || "";
  return ACCEPTED_AUDIO_TYPES.has(mimeType) ? mimeType : null;
}

async function uploadAndTranscribe(req: Request, res: Response) {
  const mimeType = normalizeAudioMimeType(req.header("content-type"));
  if (!mimeType) return res.status(415).json({ error: "Formato de áudio não suportado." });
  const bytes = req.body instanceof Buffer ? new Uint8Array(req.body) : null;
  if (!bytes?.byteLength) return res.status(400).json({ error: "Nenhum áudio foi recebido." });

  const requestContext = await createContext({ req, res } as Parameters<typeof createContext>[0]);
  if (!requestContext.user) return res.status(401).json({ error: "Sua sessão expirou. Entre novamente para enviar áudio." });

  try {
    const context = await getTenantContextForUser(requestContext.user.id);
    const transcript = await transcribeVoiceInput({
      context,
      audioBytes: bytes,
      mimeType,
      storagePut: (key, data, contentType) => storagePut(key, data, contentType),
      getVoice: getVoiceProvider,
      repository: new DatabasePastoralRepository(),
    });
    return res.json(transcript);
  } catch {
    return res.status(502).json({ error: "Não foi possível transcrever o áudio. Tente novamente ou envie a mensagem em texto." });
  }
}

export function registerVoiceUploadRoute(app: Express) {
  app.post("/api/pastoral/voice", express.raw({ type: "audio/*", limit: "16mb" }), (req, res) => {
    void uploadAndTranscribe(req, res);
  });
}
