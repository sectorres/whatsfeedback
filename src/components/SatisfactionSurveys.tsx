import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, Loader2, Send, ChevronDown, ChevronUp, List, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { SurveyManagement } from "@/components/SurveyManagement";
import { getProgressiveDelay } from "./SendDelayConfig";
import { Input } from "@/components/ui/input";

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

export function SatisfactionSurveys() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [campaignSearch, setCampaignSearch] = useState<string>("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [allCampaignSends, setAllCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [loading, setLoading] = useState(false);
  const [sendingSurveys, setSendingSurveys] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [surveyCountdown, setSurveyCountdown] = useState<number>(0);
  const pollTimerRef = useRef<number | null>(null);
  const plannedIdsRef = useRef<string[]>([]);
  const startTimeRef = useRef<string>("");
  const countdownIntervalRef = useRef<number | null>(null);
  
  const { toast } = useToast();

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  useEffect(() => {
    loadCampaigns();
    loadAllDriverData();
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
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const loadCampaigns = async () => {
    try {
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
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', selectedCampaignId);

      if (sendsError) throw sendsError;

      const sendIds = sends?.map(s => s.id) || [];
      
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setCampaignSends(sendsMap);

      const { data, error } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds)
        .not('status', 'in', '("cancelled","not_sent")')
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
    try {
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*');

      if (sendsError) throw sendsError;

      const sendIds = sends?.map(s => s.id) || [];
      
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setAllCampaignSends(sendsMap);

      const { data: allSurveysData, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds)
        .not('status', 'in', '("cancelled","not_sent")')
        .order('sent_at', { ascending: false });

      if (!surveysError && allSurveysData) {
        setAllSurveys(allSurveysData);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de motoristas:', error);
    }
  };

  const sendSurveys = async () => {
    if (!selectedCampaignId) {
      toast({
        title: "Nenhuma campanha selecionada",
        description: "Selecione uma campanha antes de enviar pesquisas",
        variant: "destructive",
      });
      return;
    }

    setSendingSurveys(true);
    setSendProgress({ current: 0, total: 0, success: 0, failed: 0 });
    setSurveyCountdown(0);
    
    try {
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('id')
        .eq('campaign_id', selectedCampaignId)
        .in('status', ['success', 'sent']);
      if (sendsError) throw sendsError;
      const sendIds = (sends || []).map((s: any) => s.id);

      const { data: existingSurveys, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('campaign_send_id, status')
        .in('campaign_send_id', sendIds);
      if (surveysError) throw surveysError;

      const excludedStatuses = ['sent', 'awaiting_feedback', 'responded', 'expired', 'cancelled'];
      const alreadyProcessedSet = new Set(
        (existingSurveys || [])
          .filter((s: any) => excludedStatuses.includes(s.status))
          .map((s: any) => s.campaign_send_id)
      );
      
      const plannedIds = sendIds.filter((id: string) => !alreadyProcessedSet.has(id));

      plannedIdsRef.current = plannedIds;
      startTimeRef.current = new Date().toISOString();

      setSendProgress({ current: 0, total: plannedIds.length, success: 0, failed: 0 });

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

        setSendProgress(prev => {
          if (current > prev.current && current < plannedIdsRef.current.length) {
            const nextDelaySeconds = getProgressiveDelay(current);
            setSurveyCountdown(nextDelaySeconds);
          }
          return { current, total: plannedIdsRef.current.length, success, failed };
        });

        if (current >= plannedIdsRef.current.length && pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          if (countdownIntervalRef.current) {
            window.clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
        }
      };
      
      countdownIntervalRef.current = window.setInterval(() => {
        setSurveyCountdown(prev => prev > 0 ? prev - 1 : 0);
      }, 1000);

      await poll();
      pollTimerRef.current = window.setInterval(() => { poll(); }, 1000);

      const { data, error } = await supabase.functions.invoke('send-satisfaction-survey');
      if (error) throw error;

      await poll();

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
      setSendingSurveys(false);
      setSurveyCountdown(0);
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const toggleCard = (surveyId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [surveyId]: !prev[surveyId]
    }));
  };

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

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma campanha" />
          </SelectTrigger>
          <SelectContent className="bg-background z-50">
            <ScrollArea className="h-[300px]">
              {filteredCampaigns.map((campaign) => {
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
            </ScrollArea>
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
                        {send.driver_name && (
                          <p className="text-[11px] text-muted-foreground truncate"><span className="font-medium">Motorista:</span> {send.driver_name}</p>
                        )}
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

            <div className="flex flex-col items-center justify-center gap-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Aguarde enquanto as pesquisas são enviadas...</span>
              </div>
              {surveyCountdown > 0 && sendProgress.current < sendProgress.total && (
                <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Próxima pesquisa em {surveyCountdown}s</span>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
