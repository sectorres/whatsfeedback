import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, TrendingDown, Minus, Loader2, BarChart3, Send, ChevronDown, ChevronUp, CalendarIcon, Download, List, Truck, Users, PackageCheck, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import * as XLSX from 'xlsx';
import { SurveyManagement } from "@/components/SurveyManagement";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent_count: number;
}

interface Survey {
  id: string;
  campaign_send_id: string;
  customer_name: string;
  customer_phone: string;
  rating: number | null;
  feedback: string | null;
  status: string;
  sent_at: string;
  responded_at: string | null;
}

interface CampaignSend {
  id: string;
  customer_name: string;
  customer_phone: string;
  message_sent: string;
  driver_name: string | null;
  campaign_id: string;
  peso_total: number | null;
  valor_total: number | null;
  quantidade_entregas: number | null;
  quantidade_skus: number | null;
  quantidade_itens: number | null;
}

interface Insight {
  id: string;
  total_responses: number;
  average_rating: number;
  rating_distribution: any;
  insights: string;
  sentiment_summary: string;
  generated_at: string;
}

export function SatisfactionSurveys() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]); // Todas as surveys para indicadores
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [allCampaignSends, setAllCampaignSends] = useState<Record<string, CampaignSend>>({}); // Todos os envios
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDriverData, setLoadingDriverData] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [sendingSurveys, setSendingSurveys] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const pollTimerRef = useRef<number | null>(null);
  const plannedIdsRef = useRef<string[]>([]);
  const startTimeRef = useRef<string>("");
  
  // Estados para filtro de data - Mês corrente
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());
  
  const { toast } = useToast();

  useEffect(() => {
    loadCampaigns();
    loadAllDriverData();
    loadInsights(); // Carregar insights ao iniciar
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadSurveys();
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
      }
    };
  }, []);

  const loadCampaigns = async () => {
    try {
      // Buscar todas as campanhas que têm envios
      const { data: sendsData, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('campaign_id');

      if (sendsError) {
        console.error('Erro ao buscar envios:', sendsError);
        toast({
          title: "Erro ao carregar campanhas",
          description: sendsError.message,
          variant: "destructive",
        });
        return;
      }

      const campaignIds = [...new Set(sendsData?.map(s => s.campaign_id) || [])];

      if (campaignIds.length === 0) {
        console.log('Nenhuma campanha com envios encontrada');
        setCampaigns([]);
        return;
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .in('id', campaignIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar campanhas:', error);
        toast({
          title: "Erro ao carregar campanhas",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Campanhas carregadas:', data?.length || 0);
      setCampaigns(data || []);
      if (data && data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    }
  };

  const loadSurveys = async () => {
    setLoading(true);
    try {
      // Buscar envios da campanha
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', selectedCampaignId);

      if (sendsError) throw sendsError;

      const sendIds = sends?.map(s => s.id) || [];
      
      // Criar mapa de envios para acesso rápido
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setCampaignSends(sendsMap);

      // Buscar pesquisas
      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds)
        .order('sent_at', { ascending: false });

      if (!error && data) {
        setSurveys(data);
      }
    } catch (error) {
      console.error('Erro ao carregar pesquisas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllDriverData = async () => {
    setLoadingDriverData(true);
    try {
      // Buscar todos os envios de campanha
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*');

      if (sendsError) throw sendsError;

      const sendIds = sends?.map(s => s.id) || [];
      
      // Criar mapa de todos os envios
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setAllCampaignSends(sendsMap);

      // Buscar todas as pesquisas
      const { data: allSurveysData, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds)
        .order('sent_at', { ascending: false });

      if (!surveysError && allSurveysData) {
        setAllSurveys(allSurveysData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de motoristas:', error);
    } finally {
      setLoadingDriverData(false);
    }
  };

  const loadInsights = async () => {
    // Carregar o insight mais recente (não filtrado por campanha)
    const { data, error } = await supabase
      .from('satisfaction_insights')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setInsights(data);
    } else {
      setInsights(null);
    }
  };

  const sendSurveys = async () => {
    setSendingSurveys(true);
    setSendProgress({ current: 0, total: 0, success: 0, failed: 0 });
    
    try {
      // Calcular previamente o total planejado (mesma lógica da função de backend)
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('id')
        .in('status', ['success', 'sent']);
      if (sendsError) throw sendsError;
      const sendIds = (sends || []).map((s: any) => s.id);

      const { data: responded, error: respondedError } = await supabase
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('campaign_send_id', sendIds)
        .eq('status', 'responded');
      if (respondedError) throw respondedError;

      const respondedSet = new Set((responded || []).map((r: any) => r.campaign_send_id));
      const plannedIds = sendIds.filter((id: string) => !respondedSet.has(id));

      plannedIdsRef.current = plannedIds;
      startTimeRef.current = new Date().toISOString();

      setSendProgress({ current: 0, total: plannedIds.length, success: 0, failed: 0 });

      // Polling de progresso em tempo real
      const poll = async () => {
        if (plannedIdsRef.current.length === 0) return;
        const { data: rows } = await supabase
          .from('satisfaction_surveys')
          .select('id,status,sent_at,campaign_send_id')
          .in('campaign_send_id', plannedIdsRef.current)
          .gte('sent_at', startTimeRef.current);

        const statuses = (rows || []).map(r => r.status);
        const failed = statuses.filter(s => s === 'failed').length;
        const success = statuses.filter(s => s === 'sent' || s === 'awaiting_feedback' || s === 'responded').length;
        const current = Math.min(success + failed, plannedIdsRef.current.length);

        setSendProgress({ current, total: plannedIdsRef.current.length, success, failed });

        if (current >= plannedIdsRef.current.length && pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      };

      // Disparar imediatamente e a cada 1s
      await poll();
      pollTimerRef.current = window.setInterval(() => { poll(); }, 1000);

      // Invocar a função de envio (processo em série com delays)
      const { data, error } = await supabase.functions.invoke('send-satisfaction-survey');
      if (error) throw error;

      // Último poll para sincronizar
      await poll();

      // Ajuste final com os números do backend (caso o polling não pegue 100%)
      if (data) {
        const finalSuccess = Math.max(sendProgress.success, (data.surveys_sent || 0) - (data.failed_surveys || 0));
        const finalFailed = Math.max(sendProgress.failed, data.failed_surveys || 0);
        const finalCurrent = Math.max(sendProgress.current, data.surveys_sent || 0);
        setSendProgress(prev => ({
          current: Math.max(prev.current, finalCurrent),
          total: Math.max(prev.total, plannedIdsRef.current.length),
          success: Math.max(prev.success, finalSuccess),
          failed: Math.max(prev.failed, finalFailed)
        }));
      }

      // Pequena pausa para o usuário ver 100%
      await new Promise(resolve => setTimeout(resolve, 800));

      const details = [] as string[];
      if (data?.new_surveys > 0) details.push(`${data.new_surveys} nova${data.new_surveys > 1 ? 's' : ''}`);
      if (data?.resent_surveys > 0) details.push(`${data.resent_surveys} reenviada${data.resent_surveys > 1 ? 's' : ''}`);
      if (data?.failed_surveys > 0) details.push(`${data.failed_surveys} falha${data.failed_surveys > 1 ? 's' : ''}`);

      toast({
        title: "Pesquisas enviadas!",
        description: data?.surveys_sent > 0 
          ? `${data.surveys_sent} pesquisa${data.surveys_sent > 1 ? 's' : ''} enviada${data.surveys_sent > 1 ? 's' : ''} (${details.join(', ')})`
          : "Nenhuma pesquisa pendente para enviar",
      });

      loadSurveys();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar pesquisas",
        description: error.message || 'Erro desconhecido',
        variant: "destructive",
      });
    } finally {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setSendingSurveys(false);
    }
  };

  const generateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-satisfaction-insights', {
        body: { 
          dateFrom: dateFrom?.toISOString(),
          dateTo: dateTo?.toISOString()
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Insights gerados!",
          description: "Análise completa disponível na aba Insights",
        });
        loadInsights();
      } else {
        toast({
          title: "Aviso",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao gerar insights",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingInsights(false);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === "Positivo") return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (sentiment === "Negativo") return <TrendingDown className="h-5 w-5 text-red-600" />;
    return <Minus className="h-5 w-5 text-yellow-600" />;
  };

  const toggleCard = (surveyId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [surveyId]: !prev[surveyId]
    }));
  };

  const exportToExcel = async () => {
    try {
      setLoading(true);

      // Buscar todas as surveys no período selecionado
      let query = supabase
        .from('satisfaction_surveys')
        .select('*')
        .not('rating', 'is', null)
        .order('responded_at', { ascending: false });

      if (dateFrom) {
        query = query.gte('responded_at', dateFrom.toISOString());
      }

      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query = query.lte('responded_at', endDate.toISOString());
      }

      const { data: surveysData, error: surveysError } = await query;

      if (surveysError) throw surveysError;

      if (!surveysData || surveysData.length === 0) {
        toast({
          title: "Nenhum dado encontrado",
          description: "Não há avaliações no período selecionado",
          variant: "destructive",
        });
        return;
      }

      // Buscar os campaign_sends correspondentes
      const sendIds = surveysData.map(s => s.campaign_send_id);
      const { data: sendsData, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*')
        .in('id', sendIds);

      if (sendsError) throw sendsError;

      // Criar mapa de sends
      const sendsMap = (sendsData || []).reduce((acc, send) => {
        acc[send.id] = send;
        return acc;
      }, {} as Record<string, any>);

      // Buscar as campanhas correspondentes
      const campaignIds = [...new Set((sendsData || []).map(s => s.campaign_id))];
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);

      if (campaignsError) throw campaignsError;

      // Criar mapa de campanhas
      const campaignsMap = (campaignsData || []).reduce((acc, campaign) => {
        acc[campaign.id] = campaign;
        return acc;
      }, {} as Record<string, any>);

      // Preparar dados para exportação
      const exportData = surveysData.map(survey => {
        const send = sendsMap[survey.campaign_send_id];
        const campaign = send ? campaignsMap[send.campaign_id] : null;
        
        // Extrair número do pedido da mensagem
        let numeroPedido = 'N/A';
        if (send?.message_sent) {
          const pedidoMatch = send.message_sent.match(/PEDIDO:\s*([^\n]+)/i);
          if (pedidoMatch) {
            numeroPedido = pedidoMatch[1].trim();
          }
        }
        
        return {
          'Carga': campaign?.name || 'N/A',
          'Pedido': numeroPedido,
          'Data da Avaliação': survey.responded_at 
            ? format(new Date(survey.responded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : 'N/A',
          'Cliente': survey.customer_name || 'N/A',
          'Motorista': send?.driver_name || 'N/A',
          'Peso Total (kg)': send?.peso_total || 'N/A',
          'Valor Total (R$)': send?.valor_total || 'N/A',
          'Quantidade Entregas': send?.quantidade_entregas || 'N/A',
          'Quantidade Itens': send?.quantidade_itens || 'N/A',
          'Quantidade SKUs': send?.quantidade_skus || 'N/A',
          'Nota': survey.rating || 'N/A',
          'Feedback': survey.feedback || '',
          'Telefone': survey.customer_phone || 'N/A',
        };
      });

      // Criar workbook e worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Pesquisas de Satisfação');

      // Ajustar largura das colunas
      const colWidths = [
        { wch: 25 }, // Carga
        { wch: 20 }, // Pedido
        { wch: 20 }, // Data
        { wch: 25 }, // Cliente
        { wch: 20 }, // Motorista
        { wch: 15 }, // Peso Total
        { wch: 15 }, // Valor Total
        { wch: 18 }, // Quantidade Entregas
        { wch: 16 }, // Quantidade SKUs
        { wch: 8 },  // Nota
        { wch: 40 }, // Feedback
        { wch: 18 }, // Telefone
      ];
      ws['!cols'] = colWidths;

      // Gerar nome do arquivo
      const fileName = `pesquisas_satisfacao_${format(new Date(), "dd-MM-yyyy_HH-mm")}.xlsx`;

      // Fazer download
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Exportação concluída!",
        description: `${surveysData.length} avaliações exportadas`,
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast({
        title: "Erro ao exportar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const responsesCount = surveys.filter(s => s.rating !== null).length;
  const responseRate = surveys.length > 0 ? (responsesCount / surveys.length) * 100 : 0;

  // Filtrar TODAS as surveys por data para indicadores de motorista
  const filteredSurveysByDate = allSurveys.filter(survey => {
    if (!dateFrom && !dateTo) return true;
    const surveyDate = new Date(survey.sent_at);
    
    if (dateFrom && dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      return surveyDate >= dateFrom && surveyDate <= endDate;
    }
    if (dateFrom) {
      return surveyDate >= dateFrom;
    }
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      return surveyDate <= endDate;
    }
    return true;
  });

  // Calcular indicadores por motorista usando TODAS as surveys (filtradas por data)
  const driverStats = filteredSurveysByDate.reduce((acc, survey) => {
    const sendDetails = allCampaignSends[survey.campaign_send_id];
    const driverName = sendDetails?.driver_name;
    
    if (driverName && survey.rating !== null) {
      if (!acc[driverName]) {
        acc[driverName] = {
          name: driverName,
          totalRatings: 0,
          sumRatings: 0,
          ratings: [],
          responseCount: 0,
          totalSurveys: 0,
          pesoTotal: 0,
          valorTotal: 0,
          quantidadeEntregas: 0,
          quantidadeSkus: 0,
          quantidadeItens: 0
        };
      }
      acc[driverName].totalRatings++;
      acc[driverName].sumRatings += survey.rating;
      acc[driverName].ratings.push(survey.rating);
      acc[driverName].responseCount++;
    }
    
    // Contar total de pesquisas por motorista e agregar métricas
    if (driverName) {
      if (!acc[driverName]) {
        acc[driverName] = {
          name: driverName,
          totalRatings: 0,
          sumRatings: 0,
          ratings: [],
          responseCount: 0,
          totalSurveys: 0,
          pesoTotal: 0,
          valorTotal: 0,
          quantidadeEntregas: 0,
          quantidadeSkus: 0,
          quantidadeItens: 0
        };
      }
      acc[driverName].totalSurveys++;
      acc[driverName].pesoTotal += sendDetails?.peso_total || 0;
      acc[driverName].valorTotal += sendDetails?.valor_total || 0;
      acc[driverName].quantidadeEntregas += sendDetails?.quantidade_entregas || 1;
      acc[driverName].quantidadeSkus += sendDetails?.quantidade_skus || 0;
      acc[driverName].quantidadeItens += sendDetails?.quantidade_itens || 0;
    }
    
    return acc;
  }, {} as Record<string, {
    name: string;
    totalRatings: number;
    sumRatings: number;
    ratings: number[];
    responseCount: number;
    totalSurveys: number;
    pesoTotal: number;
    valorTotal: number;
    quantidadeEntregas: number;
    quantidadeSkus: number;
    quantidadeItens: number;
  }>);

  const driverMetrics = Object.values(driverStats).map(stat => ({
    name: stat.name,
    averageRating: stat.totalRatings > 0 ? (stat.sumRatings / stat.totalRatings) : 0,
    totalRatings: stat.totalRatings,
    totalSurveys: stat.totalSurveys,
    responseRate: stat.totalSurveys > 0 ? (stat.responseCount / stat.totalSurveys) * 100 : 0,
    pesoTotal: stat.pesoTotal,
    valorTotal: stat.valorTotal,
    quantidadeEntregas: stat.quantidadeEntregas,
    quantidadeSkus: stat.quantidadeSkus,
    quantidadeItens: stat.quantidadeItens,
    distribution: {
      5: stat.ratings.filter(r => r === 5).length,
      4: stat.ratings.filter(r => r === 4).length,
      3: stat.ratings.filter(r => r === 3).length,
      2: stat.ratings.filter(r => r === 2).length,
      1: stat.ratings.filter(r => r === 1).length,
    }
  })).sort((a, b) => b.averageRating - a.averageRating);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Pesquisas de Satisfação</h2>
          <p className="text-muted-foreground">
            Acompanhe e analise o feedback dos seus clientes
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button 
            onClick={sendSurveys} 
            disabled={sendingSurveys}
            className="gap-2"
          >
            {sendingSurveys ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Enviar Pesquisas Pendentes
          </Button>
          <Button 
            onClick={() => setShowManagementDialog(true)}
            variant="outline"
            className="gap-2"
          >
            <List className="h-4 w-4" />
            Gerenciamento de Envios
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => {
              // Verificar se há pesquisas enviadas para esta campanha
              const hasSurveys = allSurveys.some(survey => {
                const send = allCampaignSends[survey.campaign_send_id];
                return send?.campaign_id === campaign.id;
              });
              
              return (
                <SelectItem key={campaign.id} value={campaign.id}>
                  <div className="flex items-center gap-2">
                    <span>{campaign.name}</span>
                    {hasSurveys && (
                      <Badge variant="default" className="ml-2 text-[10px] h-4 px-1">
                        Enviada
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedCampaignId && campaignSends && Object.keys(campaignSends).length > 0 && (
        <Card className="bg-muted/50">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <div>
              <CardTitle className="text-lg">Prévia dos Envios desta Campanha</CardTitle>
              <CardDescription>
                {Object.keys(campaignSends).length} clientes
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
              {showPreview ? 'Ocultar prévia' : 'Mostrar prévia'}
            </Button>
          </CardHeader>
          {showPreview && (
            <CardContent>
              <ScrollArea className="h-56 pr-2">
                <div className="space-y-2">
                  {Object.values(campaignSends).map((send) => (
                    <div key={send.id} className="grid grid-cols-3 items-center gap-2 p-2 bg-background rounded-md text-xs">
                      <div className="truncate">
                        <p className="font-medium truncate">{send.customer_name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{send.customer_phone}</p>
                      </div>
                      <div className="col-span-2 text-right text-[11px] text-muted-foreground truncate">
                        {send.message_sent?.match(/PEDIDO:\s*([^\n]+)/)?.[1] || 'Pedido N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}

      <Tabs defaultValue="responses" className="space-y-4">
        <TabsList>
          <TabsTrigger value="responses">Respostas</TabsTrigger>
          <TabsTrigger value="drivers">Indicadores por Motorista</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="responses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Respostas Recebidas</CardTitle>
              <CardDescription>
                Acompanhe as avaliações dos clientes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : surveys.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma pesquisa enviada ainda
                </p>
              ) : (
                <div className="space-y-4">
                  {surveys.map((survey) => {
                    const sendDetails = campaignSends[survey.campaign_send_id];
                    const driverName = sendDetails?.driver_name;
                    const isExpanded = expandedCards[survey.id] || false;
                    
                    return (
                      <Card key={survey.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <p className="font-semibold text-base">
                                  {survey.customer_name || sendDetails?.customer_name || 'Cliente'}
                                </p>
                                {survey.rating && (
                                  <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded">
                                    <Star className={`h-4 w-4 ${getRatingColor(survey.rating)} fill-current`} />
                                    <span className={`text-sm font-bold ${getRatingColor(survey.rating)}`}>
                                      {survey.rating}/5
                                    </span>
                                  </div>
                                )}
                                {driverName && (
                                  <Badge variant="secondary" className="text-xs">
                                    Motorista: {driverName}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="text-xs text-muted-foreground space-y-1">
                                {sendDetails?.message_sent && (
                                  <p className="font-medium text-primary">
                                    Pedido: {sendDetails.message_sent.match(/PEDIDO:\s*([^\n]+)/i)?.[1]?.trim() || 'N/A'}
                                  </p>
                                )}
                                <p>{survey.customer_phone || sendDetails?.customer_phone}</p>
                                <p>Enviado: {new Date(survey.sent_at).toLocaleString('pt-BR')}</p>
                                {survey.responded_at && (
                                  <p className="text-green-600">
                                    Respondido: {new Date(survey.responded_at).toLocaleString('pt-BR')}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {!survey.rating && (
                              <Badge variant="outline" className="ml-4">
                                {survey.status === 'sent' ? 'Pendente' : 'Enviado'}
                              </Badge>
                            )}
                          </div>

                          <Collapsible open={isExpanded} onOpenChange={() => toggleCard(survey.id)}>
                            {survey.feedback && (
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-xs">
                                  <span>Ver detalhes</span>
                                  {isExpanded ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            )}
                            
                            <CollapsibleContent className="space-y-3 mt-3">
                              {survey.feedback && (
                                <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                                  <p className="text-xs font-medium text-primary mb-1">
                                    Feedback do cliente:
                                  </p>
                                  <p className="text-sm italic">&quot;{survey.feedback}&quot;</p>
                                </div>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Desempenho dos Motoristas</CardTitle>
                  <CardDescription>
                    Avaliações de todas as campanhas filtradas por período
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    onClick={exportToExcel}
                    disabled={loading}
                    variant="outline"
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Exportar Excel
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingDriverData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : driverMetrics.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma avaliação de motorista no período selecionado
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {driverMetrics.map((driver, index) => (
                    <Card key={driver.name} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Left side - Driver info and delivery data */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base">
                                #{index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-base truncate">{driver.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {driver.totalRatings} avaliações de {driver.totalSurveys} entregas
                                </p>
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-background/60 p-2 rounded">
                                <p className="text-muted-foreground">Peso</p>
                                <p className="font-semibold">{driver.pesoTotal.toFixed(2)} kg</p>
                              </div>
                              <div className="bg-background/60 p-2 rounded">
                                <p className="text-muted-foreground">Valor</p>
                                <p className="font-semibold">R$ {driver.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                              </div>
                              <div className="bg-background/60 p-2 rounded">
                                <p className="text-muted-foreground">Entregas</p>
                                <p className="font-semibold">{driver.quantidadeEntregas}</p>
                              </div>
                              <div className="bg-background/60 p-2 rounded">
                                <p className="text-muted-foreground">Itens</p>
                                <p className="font-semibold">{driver.quantidadeItens}</p>
                              </div>
                              <div className="bg-background/60 p-2 rounded col-span-2">
                                <p className="text-muted-foreground">SKUs Diferentes</p>
                                <p className="font-semibold">{driver.quantidadeSkus}</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Right side - Rating and distribution */}
                          <div className="flex flex-col items-center gap-3">
                            <div className="text-center">
                              <div className="flex items-center gap-1 justify-center">
                                <Star className={`h-5 w-5 ${getRatingColor(driver.averageRating)} fill-current`} />
                                <span className={`text-3xl font-bold ${getRatingColor(driver.averageRating)}`}>
                                  {driver.averageRating.toFixed(1)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {driver.responseRate.toFixed(0)}% responderam
                              </p>
                            </div>
                            
                            {/* Distribution bars - compact */}
                            <div className="flex gap-1.5">
                              {[5, 4, 3, 2, 1].map((rating) => (
                                <div key={rating} className="flex flex-col items-center">
                                  <div className="text-xs font-medium mb-1">
                                    {rating}★
                                  </div>
                                  <div className="h-16 w-7 bg-muted rounded flex items-end justify-center overflow-hidden">
                                    <div 
                                      className={`w-full transition-all ${
                                        rating >= 4 ? 'bg-green-500' : 
                                        rating === 3 ? 'bg-yellow-500' : 
                                        'bg-red-500'
                                      }`}
                                      style={{ 
                                        height: driver.totalRatings > 0 
                                          ? `${(driver.distribution[rating as keyof typeof driver.distribution] / driver.totalRatings) * 100}%` 
                                          : '0%',
                                        minHeight: driver.distribution[rating as keyof typeof driver.distribution] > 0 ? '6px' : '0'
                                      }}
                                    />
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {driver.distribution[rating as keyof typeof driver.distribution]}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Feedbacks carousel - below everything */}
                        {(() => {
                          const driverFeedbacks = filteredSurveysByDate
                            .filter(s => {
                              const send = allCampaignSends[s.campaign_send_id];
                              return send?.driver_name === driver.name && s.feedback;
                            })
                            .sort((a, b) => new Date(b.responded_at || b.sent_at).getTime() - new Date(a.responded_at || a.sent_at).getTime())
                            .slice(0, 10);

                          return driverFeedbacks.length > 0 ? (
                            <div className="mt-3 pt-3 border-t border-border">
                              <Carousel
                                className="w-full"
                                opts={{
                                  align: "start",
                                  loop: true,
                                }}
                                plugins={[Autoplay({ delay: 3000 })]}
                              >
                                <CarouselContent>
                                  {driverFeedbacks.map((survey, idx) => (
                                    <CarouselItem key={idx}>
                                      <div className="text-center py-1">
                                        <p 
                                          className={`text-xs italic ${
                                            survey.rating >= 4 ? 'text-green-600' : 
                                            survey.rating <= 2 ? 'text-red-600' : 
                                            'text-yellow-600'
                                          }`}
                                        >
                                          &quot;{survey.feedback}&quot;
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                          {survey.rating}★ - {format(new Date(survey.responded_at || survey.sent_at), "dd/MM/yyyy", { locale: ptBR })}
                                        </p>
                                      </div>
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                              </Carousel>
                            </div>
                          ) : null;
                        })()}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-row items-center justify-between mb-4">
                <div>
                  <CardTitle>Análise de Insights</CardTitle>
                  <CardDescription>
                    Análise detalhada gerada por IA sobre o período selecionado
                  </CardDescription>
                </div>
                <Button 
                  onClick={generateInsights} 
                  disabled={generatingInsights}
                  className="gap-2"
                >
                  {generatingInsights ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <BarChart3 className="h-4 w-4" />
                  )}
                  Gerar Insights
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-3 pt-2 border-t">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "PPP", { locale: ptBR }) : "Data início"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={setDateFrom}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "justify-start text-left font-normal",
                        !dateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "PPP", { locale: ptBR }) : "Data fim"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={setDateTo}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {insights ? (
                <div className="space-y-6">
                  {/* Estatísticas Resumidas */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Total de Avaliações</p>
                          <p className="text-3xl font-bold">{insights.total_responses}</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Nota Média</p>
                          <div className="flex items-center justify-center gap-2">
                            <Star className={`h-6 w-6 ${getRatingColor(insights.average_rating)} fill-current`} />
                            <p className={`text-3xl font-bold ${getRatingColor(insights.average_rating)}`}>
                              {insights.average_rating.toFixed(1)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Satisfação Geral</p>
                          <Badge 
                            variant={
                              insights.sentiment_summary === 'Positivo' ? 'default' :
                              insights.sentiment_summary === 'Negativo' ? 'destructive' :
                              'secondary'
                            }
                            className="text-base px-3 py-1"
                          >
                            {insights.sentiment_summary}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Distribuição de Notas */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Distribuição de Notas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {Object.entries(insights.rating_distribution || {})
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([rating, count]) => {
                            const countNum = Number(count);
                            const percentage = insights.total_responses > 0 
                              ? (countNum / insights.total_responses) * 100 
                              : 0;
                            return (
                              <div key={rating} className="flex items-center gap-3">
                                <span className="w-12 text-sm font-medium">{rating} ⭐</span>
                                <Progress value={percentage} className="flex-1" />
                                <span className="text-sm text-muted-foreground w-16 text-right">
                                  {countNum} ({percentage.toFixed(0)}%)
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Insights Categorizados */}
                  {(() => {
                    try {
                      const parsedInsights = typeof insights.insights === 'string' 
                        ? JSON.parse(insights.insights) 
                        : insights.insights;

                      const getStatusColor = (status: string) => {
                        if (status === 'positivo') return 'border-green-500 bg-green-50/50';
                        if (status === 'negativo') return 'border-red-500 bg-red-50/50';
                        return 'border-yellow-500 bg-yellow-50/50';
                      };

                      const getIcon = (iconName: string) => {
                        const icons: Record<string, any> = {
                          'TruckIcon': Truck,
                          'Truck': Truck,
                          'Users': Users,
                          'PackageCheck': PackageCheck,
                          'TrendingUp': TrendingUp,
                          'BarChart3': BarChart3,
                          'AlertCircle': AlertCircle,
                        };
                        const IconComponent = icons[iconName] || BarChart3;
                        return <IconComponent className="h-5 w-5" />;
                      };

                      return (
                        <div className="space-y-4">
                          <h3 className="font-semibold text-lg">Análise por Categoria - Torres Cabral</h3>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {Object.entries(parsedInsights).map(([key, category]: [string, any]) => (
                              <Card key={key} className={`border-2 ${getStatusColor(category.status)}`}>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${
                                      category.status === 'positivo' ? 'bg-green-500 text-white' :
                                      category.status === 'negativo' ? 'bg-red-500 text-white' :
                                      'bg-yellow-500 text-white'
                                    }`}>
                                      {getIcon(category.icone)}
                                    </div>
                                    <CardTitle className="text-base">{category.titulo}</CardTitle>
                                  </div>
                                </CardHeader>
                                <CardContent>
                                  <ul className="space-y-2">
                                    {category.insights?.map((insight: string, idx: number) => (
                                      <li key={idx} className="flex items-start gap-2 text-sm">
                                        <span className="text-primary mt-0.5">•</span>
                                        <span className="flex-1">{insight}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    } catch (e) {
                      // Fallback para formato antigo
                      return (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Análise Detalhada</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                              <div className="prose prose-sm max-w-none text-foreground">
                                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                  {insights.insights}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }
                  })()}

                  <p className="text-xs text-muted-foreground text-center">
                    Análise gerada em {new Date(insights.generated_at).toLocaleString('pt-BR')} para Torres Cabral - Materiais de Construção
                  </p>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Selecione o período e clique em 'Gerar Insights' para analisar os dados
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Gerenciamento */}
      <Dialog open={showManagementDialog} onOpenChange={setShowManagementDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciamento de Envios</DialogTitle>
            <DialogDescription>
              Selecione e envie pesquisas individualmente
            </DialogDescription>
          </DialogHeader>
          <SurveyManagement />
        </DialogContent>
      </Dialog>

      {/* Dialog de Progresso */}
      <Dialog open={sendingSurveys} onOpenChange={(open) => !open && setSendingSurveys(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviando Pesquisas</DialogTitle>
            <DialogDescription>
              Acompanhe o progresso do envio em tempo real
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span className="font-medium">{sendProgress.current} / {sendProgress.total}</span>
              </div>
              <Progress value={sendProgress.total > 0 ? (sendProgress.current / sendProgress.total) * 100 : 0} />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">{sendProgress.success}</div>
                <div className="text-xs text-muted-foreground">Enviadas</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-red-600">{sendProgress.failed}</div>
                <div className="text-xs text-muted-foreground">Falharam</div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Aguarde enquanto as pesquisas são enviadas...</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}