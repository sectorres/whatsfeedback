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
  TrendingUp
} from "lucide-react";

interface Stats {
  conversasAtivas: number;
  conversasTotal: number;
  mensagensHoje: number;
  campanhasAtivas: number;
  pedidosAbertos: number;
  pedidosFaturados: number;
  totalCargas: number;
  cargasPendentes: number;
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
    cargasPendentes: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllStats();
  }, []);

  const fetchAllStats = async () => {
    setLoading(true);
    try {
      // Buscar estatísticas de conversas
      const { count: conversasAtivasCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      const { count: conversasTotalCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true });

      // Buscar mensagens de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: mensagensHojeCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      // Buscar estatísticas de cargas e pedidos
      const { data: cargasData } = await supabase.functions.invoke("fetch-cargas");

      let pedidosAbertos = 0;
      let pedidosFaturados = 0;
      let totalCargas = 0;
      let cargasPendentes = 0;

      if (cargasData?.status === "SUCESSO" && cargasData.retorno?.cargas) {
        const cargas = cargasData.retorno.cargas;
        totalCargas = cargas.length;
        
        pedidosAbertos = cargas
          .filter((c: any) => c.status === "ABER")
          .reduce((sum: number, carga: any) => sum + (carga.pedidos?.length || 0), 0);
        
        pedidosFaturados = cargas
          .filter((c: any) => c.status === "FATU")
          .reduce((sum: number, carga: any) => sum + (carga.pedidos?.length || 0), 0);

        cargasPendentes = cargas.filter((c: any) => c.status !== "FATU").length;
      }

      setStats({
        conversasAtivas: conversasAtivasCount || 0,
        conversasTotal: conversasTotalCount || 0,
        mensagensHoje: mensagensHojeCount || 0,
        campanhasAtivas: 0, // Placeholder - implementar quando houver campanhas ativas
        pedidosAbertos,
        pedidosFaturados,
        totalCargas,
        cargasPendentes
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
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
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{loading ? "..." : value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h2>
        <p className="text-muted-foreground">
          Visão geral das suas operações e atendimentos
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <StatCard
          title="Campanhas Ativas"
          value={stats.campanhasAtivas}
          icon={Calendar}
          color="text-purple-600"
        />
        <StatCard
          title="Total de Cargas"
          value={stats.totalCargas}
          icon={Truck}
          color="text-orange-600"
          subtitle={`${stats.cargasPendentes} pendentes`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Pedidos Abertos"
          value={stats.pedidosAbertos}
          icon={Clock}
          color="text-yellow-600"
        />
        <StatCard
          title="Pedidos Faturados"
          value={stats.pedidosFaturados}
          icon={CheckCircle2}
          color="text-green-600"
        />
        <StatCard
          title="Total de Pedidos"
          value={stats.pedidosAbertos + stats.pedidosFaturados}
          icon={Package}
          color="text-blue-600"
        />
      </div>
    </div>
  );
}
