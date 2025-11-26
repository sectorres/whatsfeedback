import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, TrendingDown, Loader2, BarChart3, CalendarIcon, Download, Truck, Users, PackageCheck, AlertCircle, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import * as XLSX from 'xlsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  date_from: string | null;
  date_to: string | null;
}

export function DriverPerformance() {
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [allCampaignSends, setAllCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDriverData, setLoadingDriverData] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  
  // Estados para filtro de data - primeiro e último dia do mês corrente
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0); // Último dia do mês
    return date;
  });
  
  // Filtros para a aba Feedback - primeiro e último dia do mês corrente
  const [feedbackDateFrom, setFeedbackDateFrom] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date;
  });
  const [feedbackDateTo, setFeedbackDateTo] = useState<Date | undefined>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0); // Último dia do mês
    return date;
  });
  const [feedbackPedido, setFeedbackPedido] = useState("");
  const [feedbackMotorista, setFeedbackMotorista] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    console.log('DriverPerformance: Carregando dados...');
    loadAllDriverData();
    loadInsights();
  }, []);

  const loadAllDriverData = async () => {
    setLoadingDriverData(true);
    console.log('DriverPerformance: Iniciando loadAllDriverData');
    try {
      // Buscar todos os envios de campanha
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*');

      if (sendsError) {
        console.error('DriverPerformance: Erro ao buscar envios:', sendsError);
        throw sendsError;
      }

      console.log('DriverPerformance: Envios carregados:', sends?.length);
      const sendIds = sends?.map(s => s.id) || [];
      
      // Criar mapa de todos os envios
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setAllCampaignSends(sendsMap);

      // Buscar todas as pesquisas (excluindo apenas canceladas e não enviadas)
      const { data: allSurveysData, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds)
        .not('status', 'in', '(cancelled,not_sent)')
        .order('sent_at', { ascending: false });

      if (!surveysError && allSurveysData) {
        console.log('DriverPerformance: Surveys carregadas:', allSurveysData.length);
        console.log('DriverPerformance: Amostra de surveys:', allSurveysData.slice(0, 3));
        setAllSurveys(allSurveysData);
      } else {
        console.error('DriverPerformance: Erro ao buscar surveys:', surveysError);
      }
    } catch (error) {
      console.error('DriverPerformance: Erro ao carregar dados de motoristas:', error);
    } finally {
      setLoadingDriverData(false);
      console.log('DriverPerformance: Finalizou loadAllDriverData');
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
          description: "Análise completa disponível",
        });
        loadInsights();
      } else {
        toast({
          title: "Aviso",
          description: data.message,
          variant: "destructive",
        });
      }
    } catch (error: any) {
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
    } catch (error: any) {
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

  console.log('DriverPerformance: Surveys após filtro de data:', filteredSurveysByDate.length);
  console.log('DriverPerformance: Filtros aplicados - dateFrom:', dateFrom, 'dateTo:', dateTo);

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

  console.log('DriverPerformance: Driver metrics calculados:', driverMetrics.length);
  if (driverMetrics.length > 0) {
    console.log('DriverPerformance: Amostra de metrics:', driverMetrics.slice(0, 3));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Desempenho</h2>
          <p className="text-muted-foreground">
            Análise de desempenho dos motoristas e insights de satisfação
          </p>
        </div>
      </div>

      <Tabs defaultValue="motoristas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="motoristas">Desempenho por Motorista</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="motoristas" className="space-y-6">

          {/* Indicadores por Motorista */}
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
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
              <div className="space-y-2">
                <p className="text-lg font-medium text-muted-foreground">
                  Nenhuma avaliação de motorista encontrada
                </p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Para ver dados de desempenho, é necessário enviar pesquisas de satisfação e os clientes precisam respondê-las. 
                  Vá para a aba "Pesquisas de Satisfação" para enviar pesquisas aos clientes.
                </p>
              </div>
            </div>
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
                                        survey.rating && survey.rating >= 4 ? 'text-green-600' : 
                                        survey.rating && survey.rating <= 2 ? 'text-red-600' : 
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

        <TabsContent value="insights" className="space-y-6">
          {/* Insights */}
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
              {/* Período Analisado */}
              {insights.date_from && insights.date_to && (
                <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg border">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Período analisado: {format(new Date(insights.date_from), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(insights.date_to), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              )}
              
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

        <TabsContent value="feedback" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Feedbacks Recebidos</CardTitle>
              <CardDescription>
                Todos os feedbacks de satisfação com filtros
              </CardDescription>
              
              {/* Filtros */}
              <div className="flex flex-wrap gap-3 pt-4 border-t">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {feedbackDateFrom ? format(feedbackDateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={feedbackDateFrom}
                      onSelect={setFeedbackDateFrom}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[150px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {feedbackDateTo ? format(feedbackDateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={feedbackDateTo}
                      onSelect={setFeedbackDateTo}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                <div className="relative flex-1 min-w-[200px]">
                  <Input
                    placeholder="Filtrar por pedido..."
                    value={feedbackPedido}
                    onChange={(e) => setFeedbackPedido(e.target.value)}
                    className="pr-8"
                  />
                  {feedbackPedido && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setFeedbackPedido("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Input
                    placeholder="Filtrar por motorista..."
                    value={feedbackMotorista}
                    onChange={(e) => setFeedbackMotorista(e.target.value)}
                    className="pr-8"
                  />
                  {feedbackMotorista && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                      onClick={() => setFeedbackMotorista("")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {(feedbackDateFrom || feedbackDateTo || feedbackPedido || feedbackMotorista) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFeedbackDateFrom(undefined);
                      setFeedbackDateTo(undefined);
                      setFeedbackPedido("");
                      setFeedbackMotorista("");
                    }}
                  >
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingDriverData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (() => {
                const feedbacksComFiltro = filteredSurveysByDate
                  .filter(survey => {
                    if (!survey.feedback) return false;
                    
                    const send = allCampaignSends[survey.campaign_send_id];
                    
                    // Filtro de data
                    if (feedbackDateFrom || feedbackDateTo) {
                      const surveyDate = new Date(survey.responded_at || survey.sent_at);
                      if (feedbackDateFrom && surveyDate < feedbackDateFrom) return false;
                      if (feedbackDateTo) {
                        const endDate = new Date(feedbackDateTo);
                        endDate.setHours(23, 59, 59, 999);
                        if (surveyDate > endDate) return false;
                      }
                    }
                    
                    // Filtro de pedido
                    if (feedbackPedido) {
                      let numeroPedido = '';
                      if (send?.message_sent) {
                        const pedidoMatch = send.message_sent.match(/PEDIDO:\s*([^\n]+)/i);
                        if (pedidoMatch) {
                          numeroPedido = pedidoMatch[1].trim();
                        }
                      }
                      if (!numeroPedido.toLowerCase().includes(feedbackPedido.toLowerCase())) {
                        return false;
                      }
                    }
                    
                    // Filtro de motorista
                    if (feedbackMotorista) {
                      const driverName = send?.driver_name || '';
                      if (!driverName.toLowerCase().includes(feedbackMotorista.toLowerCase())) {
                        return false;
                      }
                    }
                    
                    return true;
                  })
                  .sort((a, b) => new Date(b.responded_at || b.sent_at).getTime() - new Date(a.responded_at || a.sent_at).getTime());

                return feedbacksComFiltro.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum feedback encontrado com os filtros aplicados
                  </p>
                ) : (
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Motorista</TableHead>
                          <TableHead>Nota</TableHead>
                          <TableHead className="max-w-md">Feedback</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feedbacksComFiltro.map((survey) => {
                          const send = allCampaignSends[survey.campaign_send_id];
                          
                          // Extrair número do pedido da mensagem
                          let numeroPedido = 'N/A';
                          if (send?.message_sent) {
                            const pedidoMatch = send.message_sent.match(/PEDIDO:\s*([^\n]+)/i);
                            if (pedidoMatch) {
                              numeroPedido = pedidoMatch[1].trim();
                            }
                          }

                          return (
                            <TableRow key={survey.id}>
                              <TableCell className="font-medium">{numeroPedido}</TableCell>
                              <TableCell>{survey.customer_name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(survey.responded_at || survey.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{send?.driver_name || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Star className={`h-4 w-4 ${getRatingColor(survey.rating || 0)} fill-current`} />
                                  <span className={`font-semibold ${getRatingColor(survey.rating || 0)}`}>
                                    {survey.rating || 'N/A'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="max-w-md">
                                <p className="text-sm line-clamp-3">{survey.feedback}</p>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
