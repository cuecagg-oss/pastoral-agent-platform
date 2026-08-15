import { Button } from "@/components/ui/button";
import { Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type VoiceRecorderProps = {
  onAudio: (audio: Blob, mimeType: "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mpeg" | "audio/mp4") => void | Promise<void>;
  disabled?: boolean;
};

function supportedMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find(type => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
}

export function VoiceRecorder({ onAudio, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const begin = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Este navegador não oferece suporte à gravação de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = supportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const actualMime = (recorder.mimeType || "audio/webm").split(";")[0] as "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mpeg" | "audio/mp4";
        const blob = new Blob(chunksRef.current, { type: actualMime });
        stream.getTracks().forEach(track => track.stop());
        if (!blob.size) return;
        if (blob.size > 16 * 1024 * 1024) {
          toast.error("O áudio excede o limite de 16 MB. Grave uma mensagem menor.");
          return;
        }
        await onAudio(blob, actualMime);
      };
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique a permissão do navegador.");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      size="icon"
      disabled={disabled}
      onClick={recording ? stop : begin}
      aria-label={recording ? "Encerrar gravação" : "Gravar comando de voz"}
      title={recording ? "Encerrar gravação" : "Gravar comando de voz"}
      className="h-[38px] w-[38px] shrink-0"
    >
      {disabled && !recording ? <Loader2 className="size-4 animate-spin" /> : recording ? <Square className="size-4" /> : <Mic className="size-4" />}
    </Button>
  );
}
