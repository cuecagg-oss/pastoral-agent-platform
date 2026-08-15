import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { hasNoPastoralRecords } from "@/lib/dashboardState";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Building2, ClipboardList, HeartHandshake, MessageCircleHeart, UsersRound } from "lucide-react";
import { Link } from "wouter";

function StatCard({ icon: Icon, label, value, tone }: { icon: typeof Building2; label: string; value: number | string; tone: string }) {
  return (
    <Card className="border-[#e7e1d4] bg-[#fffdf8] shadow-[0_10px_26px_rgba(31,42,38,0.05)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex size-11 items-center justify-center rounded-2xl ${tone}`}><Icon className="size-5" /></div>
        <div><p className="text-2xl font-semibold tracking-tight text-[#173b34]">{value}</p><p className="text-sm text-muted-foreground">{label}</p></div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const dashboard = trpc.pastoral.dashboard.useQuery(undefined, { enabled: !!user && isAuthenticated });
  const data = dashboard.data;
  const isEmpty = hasNoPastoralRecords(data?.summary);
  return (
    <DashboardLayout>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 pb-6">
        <section className="relative overflow-hidden rounded-3xl bg-[#f4efe2] px-6 py-8 md:px-8">
          <div className="absolute bottom-0 right-0 h-40 w-40 translate-x-8 translate-y-8 rounded-full border-[22px] border-[#d9c66e]/50" />
          <div className="relative max-w-2xl">
            <div className="mb-4 flex items-center gap-2 text-[#56705e]"><HeartHandshake className="size-5" /><span className="text-sm font-semibold">Ambiente seguro de gestão pastoral</span></div>
            <h1 className="font-['Fraunces'] text-4xl font-semibold tracking-tight text-[#173b34] md:text-5xl">Bom dia, {user?.name?.split(" ")[0] ?? "pastor(a)"}.</h1>
            <p className="mt-3 text-base leading-7 text-[#516259]">Acompanhe o que precisa de atenção e converse com o Assistente Pastoral usando os dados da sua igreja.</p>
            <div className="mt-6 flex flex-wrap gap-2"><Badge className="border-0 bg-[#173b34] px-3 py-1.5 text-white hover:bg-[#173b34]">{data?.tenant.organizationName ?? "Carregando igreja..."}</Badge><Badge variant="outline" className="border-[#d7cfbd] bg-white/60 px-3 py-1.5 text-[#516259]">Sessão autenticada</Badge></div>
          </div>
        </section>

        {dashboard.isError ? <Card className="border-[#eccdc5] bg-[#fff9f7]"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-[#8d3423]">Não foi possível carregar os dados da igreja.</p><p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p></div><Button variant="outline" onClick={() => dashboard.refetch()}>Tentar novamente</Button></CardContent></Card> : dashboard.isLoading ? <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-[94px] rounded-2xl" />)}</div> : (
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard icon={Building2} label="Células ativas" value={data?.summary.cells ?? 0} tone="bg-[#e2efe6] text-[#24714d]" />
            <StatCard icon={ClipboardList} label="Relatórios pendentes" value={data?.summary.pendingReports ?? 0} tone="bg-[#fff0d6] text-[#a45b13]" />
            <StatCard icon={UsersRound} label="Visitantes sem retorno" value={data?.summary.openVisitors ?? 0} tone="bg-[#e9e6f6] text-[#604fa6]" />
          </section>
        )}

        {isEmpty ? <Card className="border-dashed border-[#cfdccf] bg-[#f8fbf6]"><CardContent className="p-6"><p className="font-['Fraunces'] text-2xl font-semibold text-[#173b34]">Sua igreja ainda não possui registros.</p><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Quando células, relatórios ou visitantes forem cadastrados, os indicadores aparecerão aqui. Enquanto isso, você pode conversar com o assistente e conhecer as consultas disponíveis.</p><Link href="/assistente"><Button variant="outline" className="mt-5">Abrir assistente <ArrowRight className="ml-2 size-4" /></Button></Link></CardContent></Card> : null}

        <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-[#e7e1d4] shadow-sm">
            <CardContent className="p-6 md:p-7">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#173b34] text-[#eedc9a]"><MessageCircleHeart className="size-6" /></div>
              <h2 className="mt-5 font-['Fraunces'] text-3xl font-semibold text-[#173b34]">Assistente Pastoral</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Pergunte sobre relatórios, reuniões, presença, visitantes e líderes. Cada consulta respeita automaticamente os limites da sua organização.</p>
              <Link href="/assistente"><Button className="mt-6 bg-[#173b34] text-white hover:bg-[#214c43]">Abrir assistente <ArrowRight className="ml-2 size-4" /></Button></Link>
            </CardContent>
          </Card>
          <Card className="border-[#e7e1d4] bg-[#173b34] text-white shadow-sm">
            <CardContent className="p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eedc9a]">Status do agente</p>
              <div className="mt-5 flex items-center gap-3"><span className="size-3 rounded-full bg-[#a9db9a] shadow-[0_0_0_5px_rgba(169,219,154,0.12)]" /><span className="text-xl font-semibold">{data?.agent.status === "online" ? "Online e protegido" : "Verificando"}</span></div>
              <p className="mt-3 text-sm leading-6 text-white/70">Tools autorizadas, contexto de tenant no servidor e logs de auditoria ativos.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}
