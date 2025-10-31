import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  MessageSquare, 
  Send, 
  Package, 
  Truck, 
  Users, 
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Star,
  BarChart3
} from "lucide-react";
import { toast } from "sonner";

interface Stats {
  conversasAtivas: number;
  conversasTotal: number;
  mensagensHoje: number;
  campanhasAtivas: number;
  pedidosAbertos: number;
  pedidosFaturados: number;
  totalCargas: number;
  cargasPendentes: number;
  totalRespostas: number;
  taxaResposta: number;
  mediaAvaliacao: number;
}

export function DashboardStats() {
  const [stats, setStats] = useState<Stats>({
    conversasAtivas: 0,
    conversasTotal: 0,
    mensagensHoje: 0,
    campanhasAtivas: 0,
    pedidosAbertos: 0,
    pedidosFaturados: 0,
    totalCargas: 0,
    cargasPendentes: 0,
    totalRespostas: 0,
    taxaResposta: 0,
    mediaAvaliacao: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    setLoading(true);
    console.log('DashboardStats: Iniciando fetch de dados...');
    try {
      // Buscar todas as estatísticas em paralelo
      const [
        conversasAtivasResult,
        conversasTotalResult,
        mensagensResult,
        campanhasResult,
        cargasResult,
        surveysResult
      ] = await Promise.all([
        supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('conversations').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
        supabase.from('campaigns').select('*', { count: 'exact', head: true }).in('status', ['draft', 'sending', 'scheduled']),
        supabase.functions.invoke("fetch-cargas", {
          body: {
            dataInicial: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10).replace(/-/g, ''),
            dataFinal: new Date().toISOString().slice(0, 10).replace(/-/g, '')
          }
        }),
        supabase.from('satisfaction_surveys').select('rating, status')
      ]);

      console.log('Conversas ativas:', conversasAtivasResult.count);
      console.log('Total de conversas:', conversasTotalResult.count);
      console.log('Mensagens hoje:', mensagensResult.count);
      console.log('Campanhas ativas:', campanhasResult.count);
      console.log('Dados de cargas:', cargasResult.data);

      let pedidosAbertos = 0;
      let pedidosFaturados = 0;
      let totalCargas = 0;
      let cargasPendentes = 0;

      if (cargasResult.data?.status === "SUCESSO" && cargasResult.data.retorno?.cargas) {
        const cargas = cargasResult.data.retorno.cargas;
        totalCargas = cargas.length;
        
        pedidosAbertos = cargas
          .filter((c: any) => c.status === "ABER")
          .reduce((sum: number, carga: any) => sum + (carga.pedidos?.length || 0), 0);
        
        pedidosFaturados = cargas
          .filter((c: any) => c.status === "FATU")
          .reduce((sum: number, carga: any) => sum + (carga.pedidos?.length || 0), 0);

        cargasPendentes = cargas.filter((c: any) => c.status !== "FATU").length;
      }

      // Processar dados de pesquisas de satisfação
      const surveys = surveysResult.data || [];
      const totalSurveys = surveys.length;
      const responsesWithRating = surveys.filter((s: any) => s.rating !== null);
      const totalRespostas = responsesWithRating.length;
      const taxaResposta = totalSurveys > 0 ? (totalRespostas / totalSurveys) * 100 : 0;
      const sumRatings = responsesWithRating.reduce((sum: number, s: any) => sum + (s.rating || 0), 0);
      const mediaAvaliacao = totalRespostas > 0 ? sumRatings / totalRespostas : 0;

      const newStats = {
        conversasAtivas: conversasAtivasResult.count || 0,
        conversasTotal: conversasTotalResult.count || 0,
        mensagensHoje: mensagensResult.count || 0,
        campanhasAtivas: campanhasResult.count || 0,
        pedidosAbertos,
        pedidosFaturados,
        totalCargas,
        cargasPendentes,
        totalRespostas,
        taxaResposta,
        mediaAvaliacao
      };

      console.log('Stats atualizadas:', newStats);
      setStats(newStats);
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
      console.log('DashboardStats: Fetch concluído');
    }
  };

  const StatCard = ({ 
    title, 
    value, 
    icon: Icon, 
    color = "text-primary",
    subtitle 
  }: { 
    title: string; 
    value: number; 
    icon: any; 
    color?: string;
    subtitle?: string;
  }) => {
    const displayValue = loading ? "..." : 
      (title === "Taxa de Resposta" ? subtitle || value : 
       title === "Média de Avaliação" ? subtitle || value : 
       value);
    
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{displayValue}</div>
          {subtitle && title !== "Taxa de Resposta" && title !== "Média de Avaliação" && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h2>
        <p className="text-muted-foreground">
          Visão geral das suas operações e atendimentos
        </p>
      </div>

      {/* Seção: Atendimento */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Atendimento</h3>
          <p className="text-sm text-muted-foreground">Conversas e mensagens com clientes</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="Conversas Ativas"
            value={stats.conversasAtivas}
            icon={MessageSquare}
            color="text-blue-600"
            subtitle={`${stats.conversasTotal} total`}
          />
          <StatCard
            title="Mensagens Hoje"
            value={stats.mensagensHoje}
            icon={Send}
            color="text-green-600"
          />
        </div>
      </div>

      {/* Seção: Pesquisas de Satisfação */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Pesquisas de Satisfação</h3>
          <p className="text-sm text-muted-foreground">Feedback e avaliações dos clientes</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total de Respostas"
            value={stats.totalRespostas}
            icon={Star}
            color="text-yellow-600"
            subtitle="pesquisas respondidas"
          />
          <StatCard
            title="Taxa de Resposta"
            value={stats.taxaResposta}
            icon={TrendingUp}
            color="text-blue-600"
            subtitle={loading ? "" : `${stats.taxaResposta.toFixed(1)}%`}
          />
          <StatCard
            title="Média de Avaliação"
            value={stats.mediaAvaliacao}
            icon={BarChart3}
            color="text-green-600"
            subtitle={loading ? "" : stats.mediaAvaliacao > 0 ? `${stats.mediaAvaliacao.toFixed(1)}/5` : "-"}
          />
        </div>
      </div>

      {/* Seção: Campanhas */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Campanhas</h3>
          <p className="text-sm text-muted-foreground">Avisos de entrega e notificações</p>
        </div>
        <div className="grid gap-4 md:grid-cols-1">
          <StatCard
            title="Campanhas Ativas"
            value={stats.campanhasAtivas}
            icon={Calendar}
            color="text-purple-600"
          />
        </div>
      </div>

      {/* Seção: Cargas e Pedidos */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Cargas e Pedidos</h3>
          <p className="text-sm text-muted-foreground">Gestão de cargas e status de pedidos</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total de Cargas"
            value={stats.totalCargas}
            icon={Truck}
            color="text-orange-600"
            subtitle={`${stats.cargasPendentes} pendentes`}
          />
          <StatCard
            title="Cargas Pendentes"
            value={stats.cargasPendentes}
            icon={Clock}
            color="text-yellow-600"
          />
          <StatCard
            title="Pedidos Abertos"
            value={stats.pedidosAbertos}
            icon={AlertCircle}
            color="text-yellow-600"
          />
          <StatCard
            title="Pedidos Faturados"
            value={stats.pedidosFaturados}
            icon={CheckCircle2}
            color="text-green-600"
          />
        </div>
      </div>
    </div>
  );
}
