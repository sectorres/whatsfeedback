import { useState, useEffect } from "react";
import { Plus, Send, Filter, Users, MessageSquare, CalendarIcon, Search } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone-utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Progress } from "./ui/progress";
interface Carga {
  id: number;
  data: string;
  motorista: number;
  nomeMotorista: string;
  status: string;
  pedidos: Pedido[];
}
interface Pedido {
  id: number;
  pedido: string;
  notaFiscal: string;
  data?: string;
  rota?: string;
  cliente: {
    nome: string;
    telefone: string;
    celular: string;
    endereco?: string;
    bairro?: string;
    cep?: string;
    cidade?: string;
    estado?: string;
    referencia?: string;
  };
  valor: number;
  pesoBruto?: number;
  produtos?: Array<{
    id: number;
    descricao: string;
    pesoBruto: number;
    quantidade: number;
  }>;
}
interface PedidoWithEditablePhone extends Pedido {
  editedPhone?: string;
}
interface CampaignBuilderProps {
  whatsappConnected: boolean;
}

// Novo template padrão com a variável de data
const DEFAULT_MESSAGE_TEMPLATE = "Olá {cliente},\n\nSeu pedido *{pedido}* será entregue dia *{data_entrega}*.\n\nIMPORTANTE:\n✅ Ter alguém maior de 18 anos para receber\n✅ Conferir a mercadoria no ato da entrega\n\nPor favor, confirme se poderá receber sua mercadoria:\n\n1️⃣  Confirmar\n2️⃣  Reagendar\n3️⃣  Parar de enviar notificação";
export const CampaignBuilder = ({
  whatsappConnected
}: CampaignBuilderProps) => {
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const defaultTemplates = [{
    id: "default",
    name: "Padrão - Notificação de Entrega",
    template: DEFAULT_MESSAGE_TEMPLATE
  }];
  const [savedTemplates, setSavedTemplates] = useState<Array<{
    id: string;
    name: string;
    template: string;
  }>>(defaultTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("default");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCargaId, setSelectedCargaId] = useState<string>("");
  const [cargaSearch, setCargaSearch] = useState<string>("");
  const [selectedPedidos, setSelectedPedidos] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editedPhones, setEditedPhones] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    blocked: 0
  });
  const [countdown, setCountdown] = useState<number>(0);

  // Novo estado para a data de entrega (em branco por padrão, mas obrigatório)
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);

  // Estado para saber se está usando API oficial (template)
  const [isOfficialApi, setIsOfficialApi] = useState(false);

  // Estado para o template body_text da Meta
  const [officialTemplateBody, setOfficialTemplateBody] = useState("");
  const [officialTemplateName, setOfficialTemplateName] = useState("");

  // Estado para controle de criação de campanhas
  const [campaignCreationEnabled, setCampaignCreationEnabled] = useState(true);

  // Estado para dados de preview
  const [previewData, setPreviewData] = useState({
    cliente: "João da Silva",
    pedido: "000/0000000-P",
    data_entrega: "XX/XX/XXXX"
  });

  // Datas padrão: primeiro dia do mês corrente até o último dia do mês
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(1); // Primeiro dia do mês
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1, 0); // Último dia do mês
    return date;
  });

  // Load templates from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem("whatsapp-templates");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSavedTemplates(parsed);
      } catch (error) {
        console.error("Error loading templates:", error);
      }
    }
  }, []);

  // Verificar se está usando API oficial e carregar o template
  useEffect(() => {
    const checkApiType = async () => {
      try {
        const {
          data
        } = await supabase.from("evolution_api_config").select("config_type, template_name").eq("is_active", true).maybeSingle();
        const isOfficial = data?.config_type === "official" && !!data?.template_name;
        setIsOfficialApi(isOfficial);
        if (isOfficial && data?.template_name) {
          setOfficialTemplateName(data.template_name);

          // Buscar o body_text do template selecionado
          const {
            data: templateData
          } = await supabase.from("whatsapp_templates").select("body_text").eq("template_name", data.template_name).maybeSingle();
          if (templateData?.body_text) {
            setOfficialTemplateBody(templateData.body_text);
          }
        }
      } catch (error) {
        console.error("Erro ao verificar tipo de API:", error);
      }
    };
    checkApiType();
  }, []);

  // Verificar se criação de campanhas está habilitada
  useEffect(() => {
    const checkCampaignCreationEnabled = async () => {
      try {
        const { data } = await supabase
          .from("app_config")
          .select("config_value")
          .eq("config_key", "campaign_creation_enabled")
          .maybeSingle();

        if (data?.config_value !== undefined) {
          setCampaignCreationEnabled(data.config_value === "true");
        }
      } catch (error) {
        console.error("Erro ao verificar config de criação de campanhas:", error);
      }
    };
    checkCampaignCreationEnabled();
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("whatsapp-templates", JSON.stringify(savedTemplates));
  }, [savedTemplates]);
  useEffect(() => {
    fetchCargas();
  }, [startDate, endDate]);
  const formatDateForAPI = (date: Date) => {
    return format(date, "yyyyMMdd");
  };
  const fetchCargas = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.functions.invoke("fetch-cargas", {
        body: {
          dataInicial: formatDateForAPI(startDate),
          dataFinal: formatDateForAPI(endDate)
        }
      });
      if (error) throw error;
      if (data && data.status === "SUCESSO" && data.retorno?.cargas) {
        setCargas(data.retorno.cargas);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Erro ao carregar cargas");
    } finally {
      setLoading(false);
    }
  };
  const filteredCargas = statusFilter === "all" ? cargas : cargas.filter(c => c.status === statusFilter);
  const selectedCarga = cargas.find(c => c.id.toString() === selectedCargaId);

  // Atualizar preview e selecionar todos os pedidos quando uma carga é escolhida
  useEffect(() => {
    if (selectedCarga && selectedCarga.pedidos) {
      const allIds = new Set(selectedCarga.pedidos.map(p => p.id));
      setSelectedPedidos(allIds);
      const firstPedido = selectedCarga.pedidos[0];
      if (firstPedido) {
        setPreviewData({
          cliente: firstPedido.cliente?.nome || "Cliente Exemplo",
          pedido: firstPedido.pedido || "000/0000000-P",
          data_entrega: deliveryDate ? format(deliveryDate, "dd/MM/yyyy", {
            locale: ptBR
          }) : "XX/XX/XXXX"
        });
      }
    } else {
      setPreviewData({
        cliente: "João da Silva",
        pedido: "000/0000000-P",
        data_entrega: deliveryDate ? format(deliveryDate, "dd/MM/yyyy", {
          locale: ptBR
        }) : "XX/XX/XXXX"
      });
    }
  }, [selectedCargaId, selectedCarga, deliveryDate]);
  const togglePedido = (pedidoId: number) => {
    const newSelected = new Set(selectedPedidos);
    if (newSelected.has(pedidoId)) {
      newSelected.delete(pedidoId);
    } else {
      newSelected.add(pedidoId);
    }
    setSelectedPedidos(newSelected);
  };
  const selectAllPedidos = () => {
    if (!selectedCarga) return;
    const allIds = new Set(selectedCarga.pedidos.map(p => p.id));
    setSelectedPedidos(allIds);
  };
  const deselectAllPedidos = () => {
    setSelectedPedidos(new Set());
  };
  const formatPhone = (phone: string) => {
    // Usar normalização consistente em toda a aplicação
    return normalizePhone(phone);
  };
  const updatePhone = (pedidoId: number, phone: string) => {
    setEditedPhones(prev => ({
      ...prev,
      [pedidoId]: phone
    }));
  };
  const getPhone = (pedido: Pedido) => {
    return editedPhones[pedido.id] || pedido.cliente?.celular || pedido.cliente?.telefone || "";
  };
  const handleSendCampaign = async () => {
    if (!whatsappConnected) {
      toast.error("Conecte o WhatsApp primeiro para enviar campanhas");
      return;
    }
    if (!messageTemplate) {
      toast.error("Preencha a mensagem da campanha");
      return;
    }
    if (!selectedCarga) {
      toast.error("Selecione uma carga");
      return;
    }
    if (selectedPedidos.size === 0) {
      toast.error("Selecione pelo menos um pedido");
      return;
    }
    if (!deliveryDate) {
      toast.error("Selecione a data de entrega");
      return;
    }
    setShowConfirmDialog(false);
    setSending(true);
    setShowProgressDialog(true);

    // Helper para gravar envios com retentativas (melhora confiabilidade)
    const insertCampaignSendWithRetry = async (payload: {
      campaign_id: string;
      customer_name: string | null;
      customer_phone: string;
      message_sent: string;
      status: string;
      error_message?: string | null;
      driver_name?: string | null;
      peso_total?: number | null;
      valor_total?: number | null;
      quantidade_entregas?: number | null;
      quantidade_skus?: number | null;
      quantidade_itens?: number | null;
      pedido_id?: number | null;
      pedido_numero?: string | null;
      carga_id?: number | null;
    }, retries = 2, delayMs = 500) => {
      let attempt = 0;
      let lastError: any = null;
      while (attempt <= retries) {
        const {
          error
        } = await supabase.from("campaign_sends").insert(payload);
        if (!error) return true;
        lastError = error;
        attempt++;
        if (attempt <= retries) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }
      console.error("Falha ao inserir campaign_sends após retentativas:", lastError, payload);
      return false;
    };
    const pedidosParaEnviar = selectedCarga?.pedidos.filter(p => selectedPedidos.has(p.id)) || [];
    setSendProgress({
      current: 0,
      total: pedidosParaEnviar.length,
      success: 0,
      failed: 0,
      blocked: 0
    });

    // Gerar nome automático: Carga #numero - data hora
    const now = new Date();
    const campaignName = `Carga #${selectedCarga.id} - ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit"
    })}`;

    // Salvar campanha no banco
    try {
      const {
        data: campaign,
        error: campaignError
      } = await supabase.from("campaigns").insert({
        name: campaignName,
        message: messageTemplate,
        status: "sending",
        target_type: "carga",
        sent_count: 0
      }).select().single();
      if (campaignError) throw campaignError;
      toast.success(`Iniciando envio de ${pedidosParaEnviar.length} mensagens...`);
      let successCount = 0;
      let errorCount = 0;
      let blockedCount = 0;

      // Formatar a data de entrega para o template
      const formattedDeliveryDate = format(deliveryDate, "dd/MM/yyyy", {
        locale: ptBR
      });
      for (let i = 0; i < pedidosParaEnviar.length; i++) {
        const pedido = pedidosParaEnviar[i];
        const rawPhone = getPhone(pedido);
        const phone = formatPhone(rawPhone); // normalizado sem DDI e sem zeros à esquerda

        // Substituir variáveis na mensagem para salvar no banco (para histórico)
        const formattedMessage = messageTemplate.replace(/{cliente}/g, pedido.cliente?.nome || "Cliente").replace(/{pedido}/g, pedido.pedido || "").replace(/{data_entrega}/g, formattedDeliveryDate) // Nova variável
        .replace(/{valor}/g, `${pedido.valor?.toFixed(2) || "0.00"}`).replace(/{status}/g, statusMap[selectedCarga?.status || ""] || "").replace(/{notaFiscal}/g, pedido.notaFiscal || "");
        if (!phone || phone.length < 10) {
          errorCount++;
          console.error(`✗ Telefone inválido para ${pedido.cliente?.nome}: ${rawPhone}`);

          // Registrar envio com erro de telefone inválido
          await insertCampaignSendWithRetry({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: rawPhone || "Não informado",
            message_sent: formattedMessage,
            status: "failed",
            error_message: "Telefone inválido",
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0,
            pedido_id: pedido.id,
            pedido_numero: pedido.pedido,
            carga_id: selectedCarga.id
          });
          setSendProgress(prev => ({
            ...prev,
            current: i + 1,
            failed: prev.failed + 1
          }));
          continue;
        }

        // Verificar se o número está na blacklist
        const {
          data: blacklisted
        } = await supabase.from("blacklist").select("id").eq("phone", phone).maybeSingle();
        if (blacklisted) {
          blockedCount++;
          console.log(`⊘ Bloqueado por blacklist: ${pedido.cliente?.nome}`);

          // Registrar como bloqueado pela blacklist
          await insertCampaignSendWithRetry({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: phone,
            message_sent: formattedMessage,
            status: "blocked",
            error_message: "Bloqueado pela blacklist",
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0,
            pedido_id: pedido.id,
            pedido_numero: pedido.pedido,
            carga_id: selectedCarga.id
          });
          setSendProgress(prev => ({
            ...prev,
            current: i + 1,
            blocked: prev.blocked + 1
          }));
          continue;
        }
        try {
          // Enviar e registrar de forma atômica no backend com dados completos
          const {
            data,
            error
          } = await supabase.functions.invoke("campaign-send", {
            body: {
              campaignId: campaign.id,
              customerName: pedido.cliente?.nome || "Cliente",
              customerPhone: phone,
              message: formattedMessage,
              // Mensagem completa para histórico
              driverName: selectedCarga?.nomeMotorista || null,
              peso_total: pedido.pesoBruto || 0,
              valor_total: pedido.valor || 0,
              quantidade_entregas: 1,
              quantidade_skus: pedido.produtos?.length || 0,
              quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0,
              pedido_id: pedido.id,
              pedido_numero: pedido.pedido,
              carga_id: selectedCarga.id,
              // Nova variável de data de entrega
              deliveryDate: formattedDeliveryDate,
              // Dados completos do pedido
              nota_fiscal: pedido.notaFiscal || null,
              data_pedido: pedido.data || null,
              rota: pedido.rota || null,
              endereco_completo: pedido.cliente?.endereco || null,
              bairro: pedido.cliente?.bairro || null,
              cep: pedido.cliente?.cep || null,
              cidade: pedido.cliente?.cidade || null,
              estado: pedido.cliente?.estado || null,
              referencia: pedido.cliente?.referencia || null,
              produtos: pedido.produtos || []
            }
          });
          if (error) throw error;
          if (data?.status !== "success") {
            throw new Error(data?.error || "Falha no envio");
          }
          successCount++;
          setSendProgress(prev => ({
            ...prev,
            current: i + 1,
            success: prev.success + 1
          }));
          console.log(`✓ Enviado para ${pedido.cliente?.nome}`);
        } catch (error) {
          errorCount++;
          console.error(`✗ Erro ao enviar para ${pedido.cliente?.nome}:`, error);

          // Registrar envio com erro - não propagar o erro
          const inserted = await insertCampaignSendWithRetry({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: phone,
            message_sent: formattedMessage,
            status: "failed",
            error_message: error instanceof Error ? error.message : String(error),
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0,
            pedido_id: pedido.id,
            pedido_numero: pedido.pedido,
            carga_id: selectedCarga.id
          });
          if (!inserted) {
            console.error("Erro ao salvar registro de falha (após retentativas).");
          }
          setSendProgress(prev => ({
            ...prev,
            current: i + 1,
            failed: prev.failed + 1
          }));
        }
        if (i < pedidosParaEnviar.length - 1) {
          // Delay de 5 segundos entre envios
          const delaySeconds = 5;
          setCountdown(delaySeconds);

          // Countdown visual
          for (let sec = delaySeconds; sec > 0; sec--) {
            setCountdown(sec);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          setCountdown(0);
        }
      }

      // Atualizar campanha com status final
      await supabase.from("campaigns").update({
        status: errorCount === 0 ? "completed" : "completed_with_errors",
        sent_count: successCount
      }).eq("id", campaign.id);
      setSending(false);
      setShowProgressDialog(false);
      if (errorCount === 0 && blockedCount === 0) {
        toast.success(`Campanha enviada com sucesso! ${successCount} mensagens enviadas`);
      } else {
        toast.error(`Campanha concluída: ${successCount} enviadas, ${blockedCount} bloqueadas, ${errorCount} falharam`);
      }
      setSelectedPedidos(new Set());
      setEditedPhones({});
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
      setSending(false);
      setShowProgressDialog(false);
    }
  };
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const day = dateStr.slice(6, 8);
    const month = dateStr.slice(4, 6);
    const year = dateStr.slice(0, 4);
    return `${day}/${month}/${year}`;
  };
  const statusMap: Record<string, string> = {
    ABER: "Aberta",
    SEPA: "Em Separação",
    FATU: "Faturada"
  };
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = savedTemplates.find(t => t.id === templateId);
    if (template) {
      setMessageTemplate(template.template);
    }
  };
  const handleSaveTemplate = () => {
    if (!newTemplateName.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }
    const newTemplate = {
      id: Date.now().toString(),
      name: newTemplateName,
      template: messageTemplate
    };
    setSavedTemplates([...savedTemplates, newTemplate]);
    setSelectedTemplateId(newTemplate.id);
    setNewTemplateName("");
    toast.success("Template salvo com sucesso!");
  };
  const handleUpdateTemplate = () => {
    const updatedTemplates = savedTemplates.map(t => t.id === selectedTemplateId ? {
      ...t,
      template: messageTemplate
    } : t);
    setSavedTemplates(updatedTemplates);
    toast.success("Template atualizado!");
  };
  const handleDeleteTemplate = () => {
    if (selectedTemplateId === "default") {
      toast.error("Não é possível deletar o template padrão");
      return;
    }
    setSavedTemplates(savedTemplates.filter(t => t.id !== selectedTemplateId));
    setSelectedTemplateId("default");
    setMessageTemplate(savedTemplates[0].template);
    toast.success("Template deletado!");
  };

  // Gerar preview com base no template real
  const getPreviewMessage = () => {
    if (isOfficialApi && officialTemplateBody) {
      return officialTemplateBody.replace(/\{\{1\}\}/g, previewData.cliente).replace(/\{\{2\}\}/g, previewData.pedido).replace(/\{\{3\}\}/g, previewData.data_entrega);
    }
    return `Olá ${previewData.cliente},\n\n*Seu pedido ${previewData.pedido} será entregue dia ${previewData.data_entrega}*`;
  };
  return <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Criar Nova Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ResizablePanelGroup direction="horizontal" className="min-h-[600px]">
            {/* Coluna Esquerda - Mensagem */}
            <ResizablePanel defaultSize={30} minSize={20}>
              <div className="h-full p-6 space-y-6 overflow-auto">
                {/* Data de Entrega */}
                <div className="space-y-2">
                  <Label htmlFor="delivery-date" className="text-base font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Data de Entrega
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deliveryDate ? format(deliveryDate, "PPP", {
                        locale: ptBR
                      }) : <span>Selecione a data</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={deliveryDate} onSelect={setDeliveryDate} initialFocus locale={ptBR} />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    Esta data será usada na variável {"{data_entrega}"}
                  </p>
                </div>

                {/* Mensagem da Campanha */}
                <div className="space-y-2">
                  <Label htmlFor="message-template" className="text-base font-semibold">
                    {isOfficialApi ? `Template Meta: ${officialTemplateName}` : "Mensagem da Campanha"}
                  </Label>
                  {isOfficialApi ?
                // API Oficial: Mostrar preview do template sem edição
                <div className="space-y-2">
                      <div className="bg-muted/50 border rounded-lg p-4 text-sm whitespace-pre-wrap">
                        <p className="text-muted-foreground mb-2 text-xs font-medium">
                          Preview do template que será enviado:
                        </p>
                        <div className="bg-background rounded p-3 border">
                          {getPreviewMessage()}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ℹ️ Usando API oficial da Meta. O template "{officialTemplateName}" será enviado automaticamente.
                      </p>
                    </div> :
                // API Não Oficial: Textarea editável
                <>
                      <Textarea id="message-template" placeholder="Digite sua mensagem..." value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={15} className="resize-none" />
                      <div className="flex flex-wrap gap-2">
                        <p className="text-xs text-muted-foreground w-full">Variáveis disponíveis:</p>
                        {["{cliente}", "{pedido}", "{data_entrega}", "{valor}", "{status}", "{notaFiscal}"].map(v => <Badge key={v} variant="outline" className="text-xs">
                            {v}
                          </Badge>)}
                      </div>
                    </>}
                </div>

                {/* Botão de Enviar Campanha */}
                <Button onClick={() => setShowConfirmDialog(true)} className="w-full" size="lg" disabled={!whatsappConnected || selectedPedidos.size === 0 || sending || !deliveryDate || !campaignCreationEnabled}>
                  {sending ? <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </> : <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar Campanha ({selectedPedidos.size} mensagens)
                    </>}
                </Button>

                {!campaignCreationEnabled && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <p className="text-sm text-destructive">🚫 Criação de campanhas desativada nas configurações</p>
                  </div>}

                {!whatsappConnected && <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                    <p className="text-sm text-warning">⚠️ Conecte o WhatsApp primeiro para poder enviar campanhas</p>
                  </div>}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Coluna Direita - Seleções e Templates */}
            <ResizablePanel defaultSize={70} minSize={35}>
              <div className="h-full p-6 space-y-6 overflow-auto border-l">
                {/* Filtros de Carga */}
                <div className="space-y-4 pb-6 border-b">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Status da Carga
                    </Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Filtrar por status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os Status</SelectItem>
                        <SelectItem value="ABER">Aberta</SelectItem>
                        <SelectItem value="SEPA">Em Separação</SelectItem>
                        <SelectItem value="FATU">Faturada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Selecionar Carga</Label>
                    <Select value={selectedCargaId} onValueChange={setSelectedCargaId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha uma carga" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-[400px] max-w-[500px]" onCloseAutoFocus={e => e.preventDefault()} position="popper">
                        <div className="p-2 border-b bg-background" onPointerDown={e => e.stopPropagation()}>
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input placeholder="Buscar carga..." value={cargaSearch} onChange={e => setCargaSearch(e.target.value)} className="pl-9 h-9" onKeyDown={e => {
                            e.stopPropagation();
                          }} onPointerDown={e => {
                            e.stopPropagation();
                          }} />
                          </div>
                        </div>
                        {loading ? <div className="p-4 text-center">
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                          </div> : <ScrollArea className="h-[300px]">
                            {filteredCargas.filter(carga => cargaSearch === "" || carga.id.toString().includes(cargaSearch) || formatDate(carga.data).includes(cargaSearch) || statusMap[carga.status].toLowerCase().includes(cargaSearch.toLowerCase()) || carga.nomeMotorista?.toLowerCase().includes(cargaSearch.toLowerCase())).length === 0 ? <div className="p-4 text-center text-sm text-muted-foreground">
                                Nenhuma carga encontrada
                              </div> : filteredCargas.filter(carga => cargaSearch === "" || carga.id.toString().includes(cargaSearch) || formatDate(carga.data).includes(cargaSearch) || statusMap[carga.status].toLowerCase().includes(cargaSearch.toLowerCase()) || carga.nomeMotorista?.toLowerCase().includes(cargaSearch.toLowerCase())).map(carga => <SelectItem key={carga.id} value={carga.id.toString()} className="text-xs">
                                    Carga #{carga.id} - {formatDate(carga.data)} - {statusMap[carga.status]} (
                                    {carga.pedidos?.length || 0} pedidos)
                                  </SelectItem>)}
                          </ScrollArea>}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Templates de Mensagem */}
                

                {/* Lista de Pedidos */}
                {selectedCarga && selectedCarga.pedidos && selectedCarga.pedidos.length > 0 && <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Pedidos da Carga (selecionados: {selectedPedidos.size})
                      </Label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={selectAllPedidos}>
                          Selecionar Todos
                        </Button>
                        <Button variant="outline" size="sm" onClick={deselectAllPedidos}>
                          Limpar
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-lg max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>Valor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCarga.pedidos.map(pedido => <TableRow key={pedido.id}>
                              <TableCell>
                                <Checkbox checked={selectedPedidos.has(pedido.id)} onCheckedChange={() => togglePedido(pedido.id)} />
                              </TableCell>
                              <TableCell className="font-medium">{pedido.pedido}</TableCell>
                              <TableCell>{pedido.cliente?.nome || "N/A"}</TableCell>
                              <TableCell>
                                <Input value={getPhone(pedido)} onChange={e => updatePhone(pedido.id, e.target.value)} placeholder="Telefone" className="h-8" />
                              </TableCell>
                              <TableCell>R$ {pedido.valor?.toFixed(2) || "0.00"}</TableCell>
                            </TableRow>)}
                        </TableBody>
                      </Table>
                    </div>
                  </div>}
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>

          {/* Diálogo de Confirmação */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirma o envio da campanha?</AlertDialogTitle>
                <AlertDialogDescription>
                  Serão enviadas {selectedPedidos.size} mensagens para os clientes selecionados. Esta ação não pode ser
                  desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendCampaign}>Confirmar Envio</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Diálogo de Progresso */}
          <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Enviando Campanha</DialogTitle>
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
                  <Progress value={sendProgress.current / sendProgress.total * 100} />
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-green-600">{sendProgress.success}</div>
                    <div className="text-xs text-muted-foreground">Enviadas</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-orange-600">{sendProgress.blocked}</div>
                    <div className="text-xs text-muted-foreground">Bloqueadas</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-red-600">{sendProgress.failed}</div>
                    <div className="text-xs text-muted-foreground">Falharam</div>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Aguarde enquanto as mensagens são enviadas...</span>
                  </div>
                  {countdown > 0 && <div className="flex items-center gap-2 text-primary font-medium">
                      <span>Próxima mensagem em {countdown}s</span>
                    </div>}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>;
};