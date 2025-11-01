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
  BarChart3,
  XCircle,
  ShieldOff
} from "lucide-react";
import { toast } from "sonner";

interface DriverRating {
  driver_name: string;
  avg_rating: number;
  total_ratings: number;
}

interface KeywordCount {
  word: string;
  count: number;
}

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
  mensagensFalhadas: number;
  contatosBloqueados: number;
  topDrivers: DriverRating[];
  positiveKeywords: KeywordCount[];
  negativeKeywords: KeywordCount[];
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
    mediaAvaliacao: 0,
    mensagensFalhadas: 0,
    contatosBloqueados: 0,
    topDrivers: [],
    positiveKeywords: [],
    negativeKeywords: []
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
        surveysResult,
        campaignSendsResult,
        blacklistResult,
        allSurveysResult
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
        supabase.from('satisfaction_surveys').select('rating, status'),
        supabase.from('campaign_sends').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('blacklist').select('*', { count: 'exact', head: true }),
        supabase.from('satisfaction_surveys').select('*').not('rating', 'is', null)
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

      // Processar mensagens falhadas e blacklist
      const mensagensFalhadas = campaignSendsResult.count || 0;
      const contatosBloqueados = blacklistResult.count || 0;

      // Processar top 5 motoristas
      const allSurveys = allSurveysResult.data || [];
      const driverRatings = new Map<string, { sum: number; count: number }>();
      
      allSurveys.forEach((survey: any) => {
        const campaignSendId = survey.campaign_send_id;
        if (!campaignSendId) return;
        
        // Buscar driver_name do campaign_send (vamos fazer isso depois de forma otimizada)
        const existing = driverRatings.get(campaignSendId) || { sum: 0, count: 0 };
        existing.sum += survey.rating || 0;
        existing.count += 1;
        driverRatings.set(campaignSendId, existing);
      });

      // Buscar campaign_sends para obter driver_name
      const campaignSendIds = Array.from(driverRatings.keys());
      const { data: campaignSendsData } = await supabase
        .from('campaign_sends')
        .select('id, driver_name')
        .in('id', campaignSendIds);

      const driverStats = new Map<string, { sum: number; count: number }>();
      
      campaignSendsData?.forEach((send: any) => {
        if (!send.driver_name) return;
        const ratings = driverRatings.get(send.id);
        if (!ratings) return;

        const existing = driverStats.get(send.driver_name) || { sum: 0, count: 0 };
        existing.sum += ratings.sum;
        existing.count += ratings.count;
        driverStats.set(send.driver_name, existing);
      });

      const topDrivers: DriverRating[] = Array.from(driverStats.entries())
        .map(([driver_name, stats]) => ({
          driver_name,
          avg_rating: stats.sum / stats.count,
          total_ratings: stats.count
        }))
        .sort((a, b) => b.avg_rating - a.avg_rating)
        .slice(0, 5);

      // Processar palavras-chave dos feedbacks
      const positiveWords = ['ótimo', 'excelente', 'bom', 'boa', 'perfeito', 'rapido', 'rápido', 'educado', 'atencioso', 'profissional', 'pontual', 'cuidadoso', 'gentil', 'eficiente', 'parabens', 'parabéns', 'obrigado', 'obrigada', 'satisfeito', 'satisfeita', 'recomendo', 'melhor', 'top', 'tranquilo', 'caprichoso'];
      const negativeWords = ['ruim', 'péssimo', 'pessimo', 'demorado', 'atrasado', 'mal', 'grosso', 'rude', 'amassado', 'quebrado', 'danificado', 'problema', 'reclamação', 'reclamacao', 'insatisfeito', 'insatisfeita', 'horrível', 'terrível', 'nunca', 'mais', 'descuidado', 'irresponsável', 'frio'];

      const feedbacks = allSurveys
        .filter((s: any) => s.feedback)
        .map((s: any) => s.feedback.toLowerCase());

      const countKeywords = (words: string[]) => {
        const counts = new Map<string, number>();
        feedbacks.forEach((feedback: string) => {
          words.forEach(word => {
            if (feedback.includes(word)) {
              counts.set(word, (counts.get(word) || 0) + 1);
            }
          });
        });
        return Array.from(counts.entries())
          .map(([word, count]) => ({ word, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);
      };

      const positiveKeywords = countKeywords(positiveWords);
      const negativeKeywords = countKeywords(negativeWords);

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
        mediaAvaliacao,
        mensagensFalhadas,
        contatosBloqueados,
        topDrivers,
        positiveKeywords,
        negativeKeywords
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Média de Avaliação</CardTitle>
              <BarChart3 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loading ? "..." : stats.mediaAvaliacao > 0 ? `${stats.mediaAvaliacao.toFixed(1)}/5` : "-"}
              </div>
              {!loading && stats.topDrivers.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Top 5 Motoristas</p>
                  {stats.topDrivers.map((driver, index) => (
                    <div key={driver.driver_name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold text-primary">#{index + 1}</span>
                        <span className="truncate max-w-[120px]">{driver.driver_name}</span>
                      </span>
                      <span className="font-bold text-green-600">{driver.avg_rating.toFixed(1)}⭐</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Novos cards de palavras-chave */}
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Palavras Positivas mais Mencionadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : stats.positiveKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.positiveKeywords.map(keyword => (
                    <div 
                      key={keyword.word} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-full"
                    >
                      <span className="text-sm font-medium text-green-700 dark:text-green-300">{keyword.word}</span>
                      <span className="text-xs font-bold text-green-600 dark:text-green-400">×{keyword.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum feedback positivo registrado</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                Palavras Negativas mais Mencionadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm">Carregando...</p>
              ) : stats.negativeKeywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {stats.negativeKeywords.map(keyword => (
                    <div 
                      key={keyword.word} 
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-full"
                    >
                      <span className="text-sm font-medium text-red-700 dark:text-red-300">{keyword.word}</span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400">×{keyword.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nenhum feedback negativo registrado</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Seção: Campanhas */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Campanhas</h3>
          <p className="text-sm text-muted-foreground">Avisos de entrega e notificações</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Campanhas Ativas"
            value={stats.campanhasAtivas}
            icon={Calendar}
            color="text-purple-600"
          />
          <StatCard
            title="Envios Falhados"
            value={stats.mensagensFalhadas}
            icon={XCircle}
            color="text-red-600"
          />
          <StatCard
            title="Contatos Bloqueados"
            value={stats.contatosBloqueados}
            icon={ShieldOff}
            color="text-orange-600"
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
