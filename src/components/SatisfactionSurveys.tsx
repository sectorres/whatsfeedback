import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, TrendingDown, Minus, Loader2, BarChart3, Send, ChevronDown, ChevronUp, CalendarIcon, Download } from "lucide-react";
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
import * as XLSX from 'xlsx';

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
  
  // Estados para filtro de data
  const [dateFrom, setDateFrom] = useState<Date | undefined>(
    new Date(new Date().setDate(new Date().getDate() - 30))
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
    try {
      const { data, error } = await supabase.functions.invoke('send-satisfaction-survey');

      if (error) throw error;

      const details = [];
      if (data.new_surveys > 0) {
        details.push(`${data.new_surveys} nova${data.new_surveys > 1 ? 's' : ''}`);
      }
      if (data.resent_surveys > 0) {
        details.push(`${data.resent_surveys} reenviada${data.resent_surveys > 1 ? 's' : ''}`);
      }

      toast({
        title: "Pesquisas enviadas!",
        description: data.surveys_sent > 0 
          ? `${data.surveys_sent} pesquisa${data.surveys_sent > 1 ? 's' : ''} enviada${data.surveys_sent > 1 ? 's' : ''} (${details.join(', ')})`
          : "Nenhuma pesquisa pendente para enviar",
      });

      loadSurveys();
    } catch (error) {
      toast({
        title: "Erro ao enviar pesquisas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
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
          totalSurveys: 0
        };
      }
      acc[driverName].totalRatings++;
      acc[driverName].sumRatings += survey.rating;
      acc[driverName].ratings.push(survey.rating);
      acc[driverName].responseCount++;
    }
    
    // Contar total de pesquisas por motorista
    if (driverName) {
      if (!acc[driverName]) {
        acc[driverName] = {
          name: driverName,
          totalRatings: 0,
          sumRatings: 0,
          ratings: [],
          responseCount: 0,
          totalSurveys: 0
        };
      }
      acc[driverName].totalSurveys++;
    }
    
    return acc;
  }, {} as Record<string, {
    name: string;
    totalRatings: number;
    sumRatings: number;
    ratings: number[];
    responseCount: number;
    totalSurveys: number;
  }>);

  const driverMetrics = Object.values(driverStats).map(stat => ({
    name: stat.name,
    averageRating: stat.totalRatings > 0 ? (stat.sumRatings / stat.totalRatings) : 0,
    totalRatings: stat.totalRatings,
    totalSurveys: stat.totalSurveys,
    responseRate: stat.totalSurveys > 0 ? (stat.responseCount / stat.totalSurveys) * 100 : 0,
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
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Pesquisas de Satisfação</h2>
          <p className="text-muted-foreground">
            Acompanhe e analise o feedback dos seus clientes
          </p>
        </div>
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
      </div>

      <div className="flex gap-4">
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent>
            {campaigns.map((campaign) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Respostas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responsesCount}</div>
            <p className="text-xs text-muted-foreground">
              de {surveys.length} pesquisas enviadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRate.toFixed(1)}%</div>
            <Progress value={responseRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média de Avaliação</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights ? insights.average_rating.toFixed(1) : "-"}/5
            </div>
            {insights && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                {getSentimentIcon(insights.sentiment_summary)}
                {insights.sentiment_summary}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

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
                            {(sendDetails?.message_sent || survey.feedback) && (
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
                              {sendDetails?.message_sent && (
                                <div className="p-3 bg-muted rounded-md">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    Mensagem da campanha:
                                  </p>
                                  <p className="text-xs whitespace-pre-wrap">{sendDetails.message_sent}</p>
                                </div>
                              )}

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
                <div className="space-y-4">
                  {driverMetrics.map((driver, index) => (
                    <Card key={driver.name} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                              #{index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-base">{driver.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {driver.totalRatings} avaliações de {driver.totalSurveys} entregas
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                <Star className={`h-5 w-5 ${getRatingColor(driver.averageRating)} fill-current`} />
                                <span className={`text-xl font-bold ${getRatingColor(driver.averageRating)}`}>
                                  {driver.averageRating.toFixed(1)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {driver.responseRate.toFixed(0)}% responderam
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-muted-foreground">Distribuição de Notas:</p>
                          <div className="grid grid-cols-5 gap-2">
                            {[5, 4, 3, 2, 1].map((rating) => (
                              <div key={rating} className="text-center">
                                <div className="text-xs font-medium mb-1">
                                  {rating}★
                                </div>
                                <div className="h-16 bg-muted rounded flex items-end justify-center overflow-hidden">
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
                                      minHeight: driver.distribution[rating as keyof typeof driver.distribution] > 0 ? '8px' : '0'
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
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Distribuição de Notas</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={loadInsights}
                        className="text-xs"
                      >
                        Atualizar
                      </Button>
                    </div>
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
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Análise Detalhada</h3>
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap text-sm">{insights.insights}</p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Gerado em {new Date(insights.generated_at).toLocaleString('pt-BR')}
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
    </div>
  );
}