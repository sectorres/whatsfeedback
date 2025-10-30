import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, TrendingUp, TrendingDown, Minus, Loader2, BarChart3, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

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
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [insights, setInsights] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [sendingSurveys, setSendingSurveys] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadSurveys();
      loadInsights();
    }
  }, [selectedCampaignId]);

  const loadCampaigns = async () => {
    // Buscar todas as campanhas que têm envios
    const { data: sendsData, error: sendsError } = await supabase
      .from('campaign_sends')
      .select('campaign_id');

    if (sendsError) {
      console.error('Erro ao buscar envios:', sendsError);
      return;
    }

    const campaignIds = [...new Set(sendsData?.map(s => s.campaign_id) || [])];

    if (campaignIds.length === 0) {
      setCampaigns([]);
      return;
    }

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .in('id', campaignIds)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampaigns(data);
      if (data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(data[0].id);
      }
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

  const loadInsights = async () => {
    const { data, error } = await supabase
      .from('satisfaction_insights')
      .select('*')
      .eq('campaign_id', selectedCampaignId)
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

      toast({
        title: "Pesquisas enviadas!",
        description: data.message,
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
    if (!selectedCampaignId) return;

    setGeneratingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-satisfaction-insights', {
        body: { campaignId: selectedCampaignId }
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

  const responsesCount = surveys.filter(s => s.rating !== null).length;
  const responseRate = surveys.length > 0 ? (responsesCount / surveys.length) * 100 : 0;

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
                    return (
                      <div
                        key={survey.id}
                        className="flex flex-col gap-3 p-4 border rounded-lg"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-lg">
                                {survey.customer_name || sendDetails?.customer_name || 'Cliente'}
                              </p>
                              {survey.rating && (
                                <div className="flex items-center gap-1">
                                  <span className={`text-xl font-bold ${getRatingColor(survey.rating)}`}>
                                    {survey.rating}
                                  </span>
                                  <Star className={`h-5 w-5 ${getRatingColor(survey.rating)}`} />
                                </div>
                              )}
                            </div>
                            
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p className="flex items-center gap-2">
                                <span className="font-medium">Telefone:</span>
                                {survey.customer_phone || sendDetails?.customer_phone}
                              </p>
                              <p className="flex items-center gap-2">
                                <span className="font-medium">Enviado em:</span>
                                {new Date(survey.sent_at).toLocaleString('pt-BR')}
                              </p>
                              {survey.responded_at && (
                                <p className="flex items-center gap-2">
                                  <span className="font-medium">Respondido em:</span>
                                  {new Date(survey.responded_at).toLocaleString('pt-BR')}
                                </p>
                              )}
                            </div>

                            {sendDetails?.message_sent && (
                              <div className="mt-2 p-3 bg-muted rounded-md">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Mensagem da campanha:
                                </p>
                                <p className="text-sm">{sendDetails.message_sent}</p>
                              </div>
                            )}

                            {survey.feedback && (
                              <div className="mt-2 p-3 bg-primary/5 border border-primary/20 rounded-md">
                                <p className="text-xs font-medium text-primary mb-1">
                                  Feedback do cliente:
                                </p>
                                <p className="text-sm italic">&quot;{survey.feedback}&quot;</p>
                              </div>
                            )}
                          </div>
                          
                          {!survey.rating && (
                            <Badge variant="outline" className="ml-4">
                              {survey.status === 'sent' ? 'Pendente' : 'Enviado'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Análise de Insights</CardTitle>
                <CardDescription>
                  Análise detalhada gerada por IA
                </CardDescription>
              </div>
              <Button 
                onClick={generateInsights} 
                disabled={generatingInsights || responsesCount === 0}
                className="gap-2"
              >
                {generatingInsights ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Gerar Insights
              </Button>
            </CardHeader>
            <CardContent>
              {insights ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-2">Distribuição de Notas</h3>
                    <div className="space-y-2">
                      {Object.entries(insights.rating_distribution).map(([rating, count]) => {
                        const countNum = Number(count);
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <span className="w-12 text-sm">{rating} ⭐</span>
                            <Progress value={(countNum / insights.total_responses) * 100} className="flex-1" />
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {countNum}
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
                  {responsesCount === 0 
                    ? "Aguardando respostas dos clientes para gerar insights"
                    : "Clique em 'Gerar Insights' para analisar os dados"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}