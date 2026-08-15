import { AIChatBox, type Message } from "@/components/AIChatBox";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { invalidateActiveConversationMessages } from "@/lib/conversationCache";
import { trpc } from "@/lib/trpc";
import { canUseVoiceSynthesis, extractVoiceAgentReply, playVoiceResponse, type VoiceAgentReply } from "@/lib/voiceInteraction";
import { Loader2, MessageCircleHeart, Sparkles, Volume2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PendingFollowup = {
  visitorId: number;
  visitorName: string;
  note: string;
  idempotencyKey: string;
};

export default function PastoralChat() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [pendingFollowup, setPendingFollowup] = useState<PendingFollowup | null>(null);
  const [voiceSynthesisAvailable] = useState(() => canUseVoiceSynthesis(typeof window === "undefined" ? undefined : window.speechSynthesis) && typeof SpeechSynthesisUtterance !== "undefined");
  const conversationQuery = trpc.pastoral.currentConversation.useQuery(undefined, { enabled: !!user && isAuthenticated });
  const conversationId = conversationQuery.data?.id;
  const messagesQuery = trpc.pastoral.messages.useQuery({ conversationId: conversationId ?? 0 }, { enabled: !!conversationId });
  const applyAgentReply = (result: VoiceAgentReply) => {
    if (result.confirmation) setPendingFollowup(result.confirmation);
    invalidateActiveConversationMessages(conversationId, input => utils.pastoral.messages.invalidate(input));
  };
  const sendMutation = trpc.pastoral.sendMessage.useMutation({
    onSuccess: applyAgentReply,
    onError: error => toast.error(error.message),
  });
  const confirmMutation = trpc.pastoral.confirmFollowup.useMutation({
    onSuccess: () => {
      toast.success("Acompanhamento confirmado e auditado.");
      setPendingFollowup(null);
      invalidateActiveConversationMessages(conversationId, input => utils.pastoral.messages.invalidate(input));
    },
    onError: error => toast.error(error.message),
  });
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);

  const messages = useMemo<Message[]>(() => (messagesQuery.data ?? []).map(message => ({ role: message.role, content: message.content })), [messagesQuery.data]);
  const isBusy = sendMutation.isPending || confirmMutation.isPending || isUploadingVoice;
  const latestAnswer = [...messages].reverse().find(message => message.role === "assistant")?.content;

  useEffect(() => {
    if (messagesQuery.error) toast.error(messagesQuery.error.message);
  }, [messagesQuery.error]);

  const sendMessage = (content: string) => {
    if (!conversationId) return;
    sendMutation.mutate({ conversationId, content });
  };

  const speak = async (content: string) => {
    if (!voiceSynthesisAvailable || !canUseVoiceSynthesis(window.speechSynthesis)) return false;
    return playVoiceResponse({
      content,
      synthesis: window.speechSynthesis,
      createUtterance: text => new SpeechSynthesisUtterance(text),
    });
  };

  const transcribeAudio = async (audio: Blob, mimeType: string) => {
    if (!conversationId) return;
    setIsUploadingVoice(true);
    try {
      const extension = mimeType.split("/")[1] || "webm";
      const formData = new FormData();
      formData.append("audio", audio, `mensagem-pastoral.${extension}`);
      const response = await fetch("/api/pastoral/voice", { method: "POST", credentials: "include", headers: { "x-pastoral-voice-request": "1" }, body: formData });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      const agentReply = extractVoiceAgentReply(payload);
      if (!response.ok || !agentReply) throw new Error(payload.error || "Não foi possível enviar o áudio.");
      applyAgentReply(agentReply);
      const startedSpeech = await speak(agentReply.content);
      toast.success(startedSpeech ? "O assistente respondeu por voz." : "Resposta recebida. A voz não foi iniciada neste navegador; consulte a resposta no histórico.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar o áudio. Tente novamente.");
    } finally {
      setIsUploadingVoice(false);
    }
  };

  const speakLatest = async () => {
    if (!latestAnswer) return;
    if (!await speak(latestAnswer)) toast.error("A leitura em voz alta não foi iniciada. Consulte a resposta no histórico.");
  };

  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-5 pb-6">
        <section className="relative overflow-hidden rounded-3xl bg-[#173b34] px-6 py-7 text-white shadow-[0_20px_50px_rgba(23,59,52,0.18)] md:px-8">
          <div className="absolute -right-10 -top-14 size-48 rounded-full bg-[#e2c76f]/20 blur-2xl" />
          <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2 text-[#eedc9a]"><MessageCircleHeart className="size-4" /><span className="text-xs font-semibold uppercase tracking-[0.16em]">Assistente Pastoral</span></div>
              <h1 className="font-['Fraunces'] text-3xl font-semibold tracking-tight md:text-4xl">Converse com os dados da sua igreja.</h1>
              <p className="mt-2 text-sm leading-6 text-white/75">Consultas são filtradas pela sua organização e as ações de acompanhamento exigem confirmação antes de gravar.</p>
            </div>
            <Badge className="w-fit border-0 bg-[#e2c76f] px-3 py-1.5 text-[#173b34] hover:bg-[#e2c76f]">Agente online</Badge>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative min-h-[620px]">
            {conversationQuery.isError ? <div className="flex h-[620px] flex-col items-center justify-center rounded-2xl border border-[#eccdc5] bg-[#fff9f7] px-8 text-center shadow-[0_14px_35px_rgba(31,42,38,0.06)]"><p className="font-['Fraunces'] text-2xl font-semibold text-[#8d3423]">Não foi possível abrir a conversa</p><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Sua sessão continua protegida. Tente carregar novamente.</p><Button variant="outline" className="mt-5" onClick={() => conversationQuery.refetch()}>Tentar novamente</Button></div> : conversationQuery.isLoading ? <div className="flex h-[620px] flex-col items-center justify-center rounded-2xl border border-[#e7e1d4] bg-[#fffdf8] px-8 text-center shadow-[0_14px_35px_rgba(31,42,38,0.06)]"><div className="flex size-14 items-center justify-center rounded-full bg-[#e2efe6] text-[#24714d]"><Loader2 className="size-5 animate-spin" /></div><p className="mt-5 font-['Fraunces'] text-2xl font-semibold text-[#173b34]">Preparando a conversa</p><p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">Estamos aplicando o contexto seguro da sua igreja antes de abrir o histórico.</p></div> : (
              <>
              {messagesQuery.isError ? <div role="alert" className="absolute left-4 right-4 top-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-[#eccdc5] bg-[#fff9f7] p-3 text-sm text-[#8d3423]"><span>O histórico não pôde ser carregado.</span><Button size="sm" variant="outline" onClick={() => messagesQuery.refetch()}>Tentar</Button></div> : null}
              <AIChatBox
                messages={messages}
                onSendMessage={sendMessage}
                isLoading={isBusy || messagesQuery.isLoading}
                height="620px"
                placeholder="Pergunte sobre células, relatórios, presença, visitantes ou líderes..."
                emptyStateMessage="Estou pronto para apoiar a gestão pastoral da sua igreja."
                suggestedPrompts={["Quantas células realizaram reunião esta semana?", "Quais células ainda não entregaram relatório?", "Quais visitantes ainda não receberam acompanhamento?"]}
                className="rounded-2xl border-[#e7e1d4] shadow-[0_14px_35px_rgba(31,42,38,0.06)]"
              />
              </>
            )}
            <div className="absolute bottom-4 left-4 z-10">
              <VoiceRecorder
                disabled={!conversationId || isBusy}
                onAudio={transcribeAudio}
              />
            </div>
          </div>
          <aside className="flex flex-col gap-4">
            <div className="rounded-2xl border border-[#e7e1d4] bg-[#fffdf8] p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[#173b34]"><Sparkles className="size-4" /><h2 className="font-semibold">Como usar</h2></div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Faça perguntas em linguagem natural. O assistente consulta apenas ferramentas autorizadas para a igreja da sua sessão.</p>
            </div>
            <div className="rounded-2xl border border-[#e7e1d4] bg-card p-5 shadow-sm">
              <h2 className="font-semibold text-[#173b34]">Voz</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Envie uma mensagem de voz. O áudio é interpretado internamente e o agente responde em voz; a resposta do assistente permanece registrada para consulta.</p>
              {!voiceSynthesisAvailable ? <p className="mt-3 text-xs leading-5 text-muted-foreground">A síntese de voz não está disponível neste navegador. A resposta continuará disponível no histórico.</p> : null}
              <Button variant="outline" className="mt-4 w-full" onClick={speakLatest} disabled={!latestAnswer || !voiceSynthesisAvailable}>
                <Volume2 className="mr-2 size-4" /> Ouvir última resposta
              </Button>
            </div>
          </aside>
        </section>
      </div>

      <AlertDialog open={!!pendingFollowup} onOpenChange={open => !open && setPendingFollowup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar acompanhamento</AlertDialogTitle>
            <AlertDialogDescription>
              Você está prestes a registrar o acompanhamento de <strong>{pendingFollowup?.visitorName}</strong>. A ação será auditada e não será duplicada se o pedido for reenviado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingFollowup || confirmMutation.isPending}
              onClick={event => {
                event.preventDefault();
                if (!pendingFollowup || !conversationId) return;
                confirmMutation.mutate({ conversationId, ...pendingFollowup });
              }}
            >
              {confirmMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null} Confirmar e registrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
