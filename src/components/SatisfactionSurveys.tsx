import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, Loader2, Send, List, Search, X, CalendarIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { SurveyManagement } from "@/components/SurveyManagement";
import { getProgressiveDelay } from "./SendDelayConfig";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
interface PedidoItem {
  pedido_numero: string;
  campaign_send_id: string;
  customer_name: string | null;
  carga_id: number | null;
  sent_at: string;
  survey_sent: boolean;
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
  pedido_numero: string | null;
}
export function SatisfactionSurveys() {
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [selectedPedidoId, setSelectedPedidoId] = useState<string>("");
  const [pedidoSearch, setPedidoSearch] = useState<string>("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [allSurveys, setAllSurveys] = useState<Survey[]>([]);
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [allCampaignSends, setAllCampaignSends] = useState<Record<string, CampaignSend>>({});
  const [loading, setLoading] = useState(false);
  const [sendingSurveys, setSendingSurveys] = useState(false);
  const [showManagementDialog, setShowManagementDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0
  });
  const [surveyCountdown, setSurveyCountdown] = useState<number>(0);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const pollTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const plannedIdsRef = useRef<string[]>([]);
  const startTimeRef = useRef<string>("");
  const countdownIntervalRef = useRef<number | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const {
    toast
  } = useToast();
  const filteredPedidos = pedidos.filter(pedido => pedido.pedido_numero.toLowerCase().includes(pedidoSearch.toLowerCase()) || pedido.customer_name && pedido.customer_name.toLowerCase().includes(pedidoSearch.toLowerCase()));
  useEffect(() => {
    loadPedidos();
    loadAllDriverData();
  }, []);
  useEffect(() => {
    loadSurveys();
  }, [selectedPedidoId, dateFrom, dateTo]);
  const handleAbortSurveys = async () => {
    if (!currentRunIdRef.current) {
      toast({
        title: "Nenhum envio em andamento",
        variant: "destructive"
      });
      return;
    }
    try {
      const {
        error
      } = await supabase.functions.invoke("abort-survey-send", {
        body: {
          runId: currentRunIdRef.current
        }
      });
      if (error) throw error;

      // Parar timers e atualizar UI imediatamente
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setSendingSurveys(false);
      setSurveyCountdown(0);
      toast({
        title: "Envio cancelado",
        description: "O processo de envio foi cancelado com sucesso"
      });
      currentRunIdRef.current = null;
    } catch (error: any) {
      console.error("Erro ao abortar envio:", error);
      toast({
        title: "Erro ao cancelar",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    }
  };
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
  const loadPedidos = async () => {
    try {
      // Primeiro, buscar dados atualizados da API externa
      const { data: apiData, error: apiError } = await supabase.functions.invoke("fetch-cargas");
      
      if (!apiError && apiData?.retorno?.cargas) {
        // Atualizar campaign_sends com dados mais recentes da API
        const cargas = apiData.retorno.cargas;
        
        for (const carga of cargas) {
          if (carga.pedidos && Array.isArray(carga.pedidos)) {
            for (const pedido of carga.pedidos) {
              // Buscar campaign_send existente para este pedido
              const { data: existingSend } = await supabase
                .from("campaign_sends")
                .select("id")
                .eq("pedido_numero", pedido.pedido)
                .maybeSingle();
              
              if (existingSend) {
                // Atualizar com dados mais recentes da API
                await supabase
                  .from("campaign_sends")
                  .update({
                    driver_name: carga.nomeMotorista || null,
                    customer_name: pedido.cliente?.nome || null,
                  })
                  .eq("id", existingSend.id);
              }
            }
          }
        }
      }
      
      // Agora buscar os pedidos atualizados do banco de dados
      const {
        data: sendsData,
        error: sendsError
      } = await supabase.from("campaign_sends").select("id, pedido_numero, customer_name, carga_id, sent_at").in("status", ["success", "sent"]).not("pedido_numero", "is", null).order("sent_at", {
        ascending: false
      });
      if (sendsError) {
        console.error("Erro ao buscar pedidos:", sendsError);
        toast({
          title: "Erro ao carregar pedidos",
          description: sendsError.message,
          variant: "destructive"
        });
        return;
      }
      const sendIds = (sendsData || []).map(s => s.id);
      const {
        data: existingSurveys,
        error: surveysError
      } = await supabase.from("satisfaction_surveys").select("campaign_send_id, status").in("campaign_send_id", sendIds);
      if (surveysError) {
        console.error("Erro ao buscar pesquisas:", surveysError);
        toast({
          title: "Erro ao carregar pedidos",
          description: surveysError.message,
          variant: "destructive"
        });
        return;
      }
      const sentStatuses = ["sent", "awaiting_feedback", "responded", "expired"];
      const sentSurveyIds = new Set((existingSurveys || []).filter(s => sentStatuses.includes(s.status)).map(s => s.campaign_send_id));
      const pedidosList: PedidoItem[] = (sendsData || []).map(send => ({
        pedido_numero: send.pedido_numero || "N/A",
        campaign_send_id: send.id,
        customer_name: send.customer_name,
        carga_id: send.carga_id,
        sent_at: send.sent_at,
        survey_sent: sentSurveyIds.has(send.id)
      }));
      setPedidos(pedidosList);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast({
        title: "Erro ao carregar pedidos",
        description: "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    }
  };
  const loadSurveys = async () => {
    setLoading(true);
    try {
      if (selectedPedidoId) {
        // Filtro por pedido específico
        const {
          data: send,
          error: sendError
        } = await supabase.from("campaign_sends").select("*").eq("id", selectedPedidoId).single();
        if (sendError) throw sendError;
        
        const sendsMap: Record<string, CampaignSend> = {
          [send.id]: send
        };
        setCampaignSends(sendsMap);
        
        let query = supabase.from("satisfaction_surveys").select("*").eq("campaign_send_id", selectedPedidoId).not("status", "in", '("cancelled","not_sent")').order("sent_at", {
          ascending: false
        });

        // Aplicar filtros de data se definidos
        if (dateFrom) {
          query = query.gte('sent_at', dateFrom.toISOString());
        }
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('sent_at', endOfDay.toISOString());
        }
        
        const {
          data,
          error
        } = await query;
        if (!error && data) {
          setSurveys(data);
        }
      } else {
        // Sem filtro - mostrar todas as surveys enviadas
        let query = supabase.from("satisfaction_surveys").select("*").not("status", "in", '("cancelled","not_sent")').order("sent_at", {
          ascending: false
        });

        // Aplicar filtros de data se definidos
        if (dateFrom) {
          query = query.gte('sent_at', dateFrom.toISOString());
        }
        if (dateTo) {
          const endOfDay = new Date(dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          query = query.lte('sent_at', endOfDay.toISOString());
        }
        
        const {
          data,
          error
        } = await query;
        if (!error && data) {
          setSurveys(data);
          
          // Carregar os campaign_sends relacionados
          const sendIds = data.map(s => s.campaign_send_id);
          if (sendIds.length > 0) {
            const {
              data: sends,
              error: sendsError
            } = await supabase.from("campaign_sends").select("*").in("id", sendIds);
            if (!sendsError && sends) {
              const sendsMap: Record<string, CampaignSend> = {};
              sends.forEach(send => {
                sendsMap[send.id] = send;
              });
              setCampaignSends(sendsMap);
            }
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar pesquisas:", error);
    } finally {
      setLoading(false);
    }
  };
  const loadAllDriverData = async () => {
    try {
      const {
        data: sends,
        error: sendsError
      } = await supabase.from("campaign_sends").select("*");
      if (sendsError) throw sendsError;
      const sendIds = sends?.map(s => s.id) || [];
      const sendsMap: Record<string, CampaignSend> = {};
      sends?.forEach(send => {
        sendsMap[send.id] = send;
      });
      setAllCampaignSends(sendsMap);
      const {
        data: allSurveysData,
        error: surveysError
      } = await supabase.from("satisfaction_surveys").select("*").in("campaign_send_id", sendIds).not("status", "in", '("cancelled","not_sent")').order("sent_at", {
        ascending: false
      });
      if (!surveysError && allSurveysData) {
        setAllSurveys(allSurveysData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados de motoristas:", error);
    }
  };
  const handleSendSurveysClick = async () => {
    if (!selectedPedidoId) {
      toast({
        title: "Nenhum pedido selecionado",
        description: "Selecione um pedido antes de enviar pesquisas",
        variant: "destructive"
      });
      return;
    }
    await sendSurveyForPedido(selectedPedidoId);
  };
  const sendSurveyForPedido = async (campaignSendId: string) => {
    if (!campaignSendId) return;
    setSendingSurveys(true);
    setSendProgress({
      current: 0,
      total: 0,
      success: 0,
      failed: 0
    });
    setSurveyCountdown(0);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const {
        data: send,
        error: sendError
      } = await supabase.from("campaign_sends").select("id, customer_phone, campaign_id").eq("id", campaignSendId).single();
      if (sendError) throw sendError;
      const sendIds = [send.id];
      const {
        data: existingSurveys,
        error: surveysError
      } = await supabase.from("satisfaction_surveys").select("campaign_send_id, status, customer_phone, sent_at").in("campaign_send_id", sendIds);
      if (surveysError) throw surveysError;
      const excludedStatuses = ["sent", "awaiting_feedback", "responded", "expired", "cancelled"];
      const alreadyProcessedSet = new Set((existingSurveys || []).filter((s: any) => excludedStatuses.includes(s.status)).map((s: any) => s.campaign_send_id));
      const plannedIds = sendIds.filter((id: string) => !alreadyProcessedSet.has(id));

      // Verificar cooldown de 1 minuto para o telefone
      if (plannedIds.length > 0) {
        const plannedPhones = [send.customer_phone];
        const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
        const {
          data: recentSurveys,
          error: recentError
        } = await supabase.from("satisfaction_surveys").select("customer_phone").in("customer_phone", plannedPhones).in("status", ["sent", "responded", "expired"]).gte("sent_at", oneMinuteAgo);
        if (recentError) throw recentError;
        if (recentSurveys && recentSurveys.length > 0) {
          toast({
            title: "Aguarde para reenviar",
            description: `${recentSurveys.length} cliente(s) receberam pesquisa há menos de 1 minuto. Aguarde antes de tentar novamente.`,
            variant: "destructive"
          });
          setSendingSurveys(false);
          return;
        }
      }
      if (plannedIds.length === 0) {
        toast({
          title: "Nenhuma pesquisa para enviar",
          description: "Todas as pesquisas desta campanha já foram enviadas ou estão processadas.",
          variant: "destructive"
        });
        setSendingSurveys(false);
        return;
      }

      // REMOVIDO: não precriar pesquisas 'pending' no cliente para evitar que itens sumam da lista sem envio real
      // O backend criará/atualizará as pesquisas conforme cada envio for realmente processado

      plannedIdsRef.current = plannedIds;
      startTimeRef.current = new Date().toISOString();
      setSendProgress({
        current: 0,
        total: plannedIds.length,
        success: 0,
        failed: 0
      });
      const poll = async () => {
        if (plannedIdsRef.current.length === 0) return;
        const {
          data: rows
        } = await supabase.from("satisfaction_surveys").select("id,status,sent_at,campaign_send_id").in("campaign_send_id", plannedIdsRef.current).gte("sent_at", startTimeRef.current);
        const statuses = (rows || []).map(r => r.status);
        const failed = statuses.filter(s => s === "failed").length;
        const success = statuses.filter(s => s === "sent" || s === "awaiting_feedback" || s === "responded").length;
        const current = Math.min(success + failed, plannedIdsRef.current.length);
        setSendProgress(prev => {
          if (current > prev.current && current < plannedIdsRef.current.length) {
            const nextDelaySeconds = getProgressiveDelay(current);
            setSurveyCountdown(nextDelaySeconds);
          }
          return {
            current,
            total: plannedIdsRef.current.length,
            success,
            failed
          };
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

      // Iniciar polling de progresso
      await poll();
      pollTimerRef.current = window.setInterval(() => {
        poll();
      }, 1000);

      // Criar run antes de invocar a função (para poder abortar)
      const {
        data: run,
        error: runErr
      } = await supabase.from("survey_send_runs").insert({
        campaign_id: send.campaign_id
      }).select().single();
      if (runErr) throw runErr;
      currentRunIdRef.current = run.id;
      const {
        data,
        error
      } = await supabase.functions.invoke("send-satisfaction-survey", {
        body: {
          campaignSendIds: plannedIds,
          campaignId: send.campaign_id,
          runId: run.id
        }
      });
      if (error) throw error;

      // Salvar runId retornado (backup)
      if (data?.runId) {
        currentRunIdRef.current = data.runId;
      }
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
      if (data?.new_surveys > 0) details.push(`${data.new_surveys} nova${data.new_surveys > 1 ? "s" : ""}`);
      if (data?.resent_surveys > 0) details.push(`${data.resent_surveys} reenviada${data.resent_surveys > 1 ? "s" : ""}`);
      if (data?.failed_surveys > 0) details.push(`${data.failed_surveys} falha${data.failed_surveys > 1 ? "s" : ""}`);
      toast({
        title: "Pesquisas enviadas!",
        description: data?.surveys_sent > 0 ? `${data.surveys_sent} pesquisa${data.surveys_sent > 1 ? "s" : ""} enviada${data.surveys_sent > 1 ? "s" : ""} (${details.join(", ")})` : "Nenhuma pesquisa pendente para enviar"
      });
      loadSurveys();
    } catch (error: any) {
      console.error("Erro ao enviar pesquisas:", error);
      if (abortController.signal.aborted) {
        toast({
          title: "Envio cancelado",
          description: "O processo de envio foi abortado"
        });
      } else {
        toast({
          title: "Erro ao enviar pesquisas",
          description: error.message || "Erro desconhecido",
          variant: "destructive"
        });
      }
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
      abortControllerRef.current = null;
      currentRunIdRef.current = null;
      loadPedidos();
      loadSurveys();
    }
  };
  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };
  return <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Pesquisas de Satisfação</h2>
          <p className="text-muted-foreground">Acompanhe e analise o feedback dos seus clientes</p>
        </div>
        <div className="flex flex-col gap-2">
          
          <Button onClick={() => setShowManagementDialog(true)} variant="outline" className="gap-2">
            <List className="h-4 w-4" />
            Gerenciamento de Envios
          </Button>
          <Button onClick={handleAbortSurveys} variant="destructive" disabled={!sendingSurveys && !pollTimerRef.current && !currentRunIdRef.current} className="gap-2">
            <X className="h-4 w-4" />
            Abortar Envio
          </Button>
        </div>
      </div>

      <Select value={selectedPedidoId} onValueChange={setSelectedPedidoId}>
        <SelectTrigger className="w-full max-w-md">
          <SelectValue placeholder="Selecione um pedido" />
        </SelectTrigger>
        <SelectContent className="bg-background z-50" onCloseAutoFocus={e => e.preventDefault()} side="bottom" align="start" sideOffset={4} position="popper">
          <div className="p-2 border-b bg-background" onPointerDown={e => e.stopPropagation()}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input placeholder="Buscar pedido ou cliente..." value={pedidoSearch} onChange={e => setPedidoSearch(e.target.value)} className="pl-9 h-9" onKeyDown={e => {
              e.stopPropagation();
            }} onPointerDown={e => {
              e.stopPropagation();
            }} />
            </div>
          </div>
          <ScrollArea className="h-[300px]">
            {filteredPedidos.length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">Nenhum pedido encontrado</div> : filteredPedidos.map(pedido => <SelectItem key={pedido.campaign_send_id} value={pedido.campaign_send_id}>
                  <div className="flex items-center gap-2">
                    <span>{pedido.pedido_numero}</span>
                    {pedido.customer_name && <span className="text-xs text-muted-foreground">- {pedido.customer_name}</span>}
                    {pedido.survey_sent ? <Badge variant="default" className="ml-2 text-[10px] h-4 px-1">
                        Enviada
                      </Badge> : <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                        Não Enviada
                      </Badge>}
                  </div>
                </SelectItem>)}
          </ScrollArea>
        </SelectContent>
      </Select>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Respostas Recebidas</CardTitle>
              <CardDescription>Acompanhe as avaliações dos clientes</CardDescription>
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-2", dateFrom && "border-primary")}>
                    <CalendarIcon className="h-4 w-4" />
                    De
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus locale={ptBR} />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-2", dateTo && "border-primary")}>
                    <CalendarIcon className="h-4 w-4" />
                    Até
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus locale={ptBR} />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && <Button variant="ghost" size="sm" onClick={() => {
              setDateFrom(undefined);
              setDateTo(undefined);
            }}>
                  <X className="h-4 w-4" />
                </Button>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div> : surveys.length === 0 ? <p className="text-center text-muted-foreground py-8">Nenhuma pesquisa enviada ainda</p> : <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Pedido</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Cliente</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Motorista</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Avaliação</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Enviado</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Status</th>
                    <th className="h-10 px-4 text-left align-middle font-medium text-muted-foreground text-xs">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {surveys.map(survey => {
                const sendDetails = campaignSends[survey.campaign_send_id];
                const driverName = sendDetails?.driver_name;
                return <tr key={survey.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="p-4 align-middle text-sm font-medium">
                          {sendDetails?.pedido_numero || "N/A"}
                        </td>
                        <td className="p-4 align-middle text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">{survey.customer_name || sendDetails?.customer_name || "Cliente"}</span>
                            <span className="text-xs text-muted-foreground">{survey.customer_phone || sendDetails?.customer_phone}</span>
                          </div>
                        </td>
                        <td className="p-4 align-middle text-sm">
                          {driverName || "-"}
                        </td>
                        <td className="p-4 align-middle">
                          {survey.rating ? <div className="flex items-center gap-1">
                              <Star className={`h-4 w-4 ${getRatingColor(survey.rating)} fill-current`} />
                              <span className={`text-sm font-bold ${getRatingColor(survey.rating)}`}>
                                {survey.rating}/5
                              </span>
                            </div> : <span className="text-sm text-muted-foreground">-</span>}
                        </td>
                        <td className="p-4 align-middle text-xs text-muted-foreground">
                          {new Date(survey.sent_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                        </td>
                        <td className="p-4 align-middle">
                          {survey.responded_at ? <Badge variant="default" className="text-xs">Respondido</Badge> : <Badge variant="outline" className="text-xs">Pendente</Badge>}
                        </td>
                        <td className="p-4 align-middle text-sm max-w-xs">
                          {survey.feedback ? <div className="truncate" title={survey.feedback}>
                              {survey.feedback}
                            </div> : <span className="text-muted-foreground">-</span>}
                        </td>
                      </tr>;
              })}
                </tbody>
              </table>
            </div>}
        </CardContent>
      </Card>

      {/* Dialog de Gerenciamento */}
      <Dialog open={showManagementDialog} onOpenChange={setShowManagementDialog}>
        <DialogContent className="sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciamento de Envios</DialogTitle>
            <DialogDescription>Selecione e envie pesquisas individualmente</DialogDescription>
          </DialogHeader>
          <SurveyManagement />
        </DialogContent>
      </Dialog>

      {/* Dialog de Progresso */}
      <Dialog open={sendingSurveys} onOpenChange={open => !open && setSendingSurveys(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviando Pesquisas</DialogTitle>
            <DialogDescription>Acompanhe o progresso do envio em tempo real</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span className="font-medium">
                  {sendProgress.current} / {sendProgress.total}
                </span>
              </div>
              <Progress value={sendProgress.total > 0 ? sendProgress.current / sendProgress.total * 100 : 0} />
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
              {surveyCountdown > 0 && sendProgress.current < sendProgress.total && <div className="flex items-center gap-2 text-primary font-medium">
                  <span>Próxima pesquisa em {surveyCountdown}s</span>
                </div>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>;
}