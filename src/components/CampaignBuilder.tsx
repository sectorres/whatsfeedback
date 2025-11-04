import { useState, useEffect } from "react";
import { Plus, Send, Filter, Users, MessageSquare, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Checkbox } from "./ui/checkbox";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone-utils";
import { getSendDelayConfig } from "./SendDelayConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
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
  cliente: {
    nome: string;
    telefone: string;
    celular: string;
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

export const CampaignBuilder = ({ whatsappConnected }: CampaignBuilderProps) => {
  const [messageTemplate, setMessageTemplate] = useState(
    "TORRES CABRAL - LOGÍSTICA\n\n🚨🚨🚨 *ATENÇÃO* 🚨🚨🚨\n\nOlá {cliente},\n\n*Seu pedido será entregue amanhã no horário comercial.*\n\nIMPORTANTE:\n✅ Ter alguém maior de 18 anos para receber\n✅ Conferir a mercadoria no ato da entrega\n✅ Em caso de dúvida, entre em contato conosco ou responda esta mensagem.\n\nPEDIDO: {pedido}\n\n⚠️ Caso esta mensagem tenha sido enviada para o número errado, responda \"NÃO\"\n\n\n📞 114206-5500"
  );
  
  const defaultTemplates = [
    {
      id: "default",
      name: "Padrão - Notificação de Entrega",
      template: "TORRES CABRAL - LOGÍSTICA\n\n🚨🚨🚨 *ATENÇÃO* 🚨🚨🚨\n\nOlá {cliente},\n\n*Seu pedido será entregue amanhã no horário comercial.*\n\nIMPORTANTE:\n✅ Ter alguém maior de 18 anos para receber\n✅ Conferir a mercadoria no ato da entrega\n✅ Em caso de dúvida, entre em contato conosco ou responda esta mensagem.\n\nPEDIDO: {pedido}\n\n⚠️ Caso esta mensagem tenha sido enviada para o número errado, responda \"NÃO\"\n\n\n📞 114206-5500"
    }
  ];

  const [savedTemplates, setSavedTemplates] = useState<Array<{id: string, name: string, template: string}>>(defaultTemplates);
  const [selectedTemplateId, setSelectedTemplateId] = useState("default");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCargaId, setSelectedCargaId] = useState<string>("");
  const [selectedPedidos, setSelectedPedidos] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editedPhones, setEditedPhones] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0, success: 0, failed: 0, blocked: 0 });
  
  // Datas padrão: primeiro e último dia do mês corrente
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  });

  // Load templates from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem('whatsapp-templates');
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setSavedTemplates(parsed);
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('whatsapp-templates', JSON.stringify(savedTemplates));
  }, [savedTemplates]);

  useEffect(() => {
    fetchCargas();
  }, [startDate, endDate]);

  const formatDateForAPI = (date: Date) => {
    return format(date, 'yyyyMMdd');
  };

  const fetchCargas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("fetch-cargas", {
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

  const filteredCargas = statusFilter === "all" 
    ? cargas 
    : cargas.filter(c => c.status === statusFilter);

  const selectedCarga = cargas.find(c => c.id.toString() === selectedCargaId);

  // Selecionar automaticamente todos os pedidos quando uma carga é escolhida
  useEffect(() => {
    if (selectedCarga && selectedCarga.pedidos) {
      const allIds = new Set(selectedCarga.pedidos.map(p => p.id));
      setSelectedPedidos(allIds);
    }
  }, [selectedCargaId, selectedCarga]);

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

    setShowConfirmDialog(false);
    setSending(true);
    setShowProgressDialog(true);
    
    const pedidosParaEnviar = selectedCarga?.pedidos.filter(p => 
      selectedPedidos.has(p.id)
    ) || [];

    setSendProgress({ current: 0, total: pedidosParaEnviar.length, success: 0, failed: 0, blocked: 0 });

    // Gerar nome automático: Carga #numero - data hora
    const now = new Date();
    const campaignName = `Carga #${selectedCarga.id} - ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    // Salvar campanha no banco
    try {
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert({
          name: campaignName,
          message: messageTemplate,
          status: 'sending',
          target_type: 'carga',
          sent_count: 0
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      toast.success(`Enviando ${pedidosParaEnviar.length} mensagens...`);
      
      let successCount = 0;
      let errorCount = 0;
      let blockedCount = 0;

      for (let i = 0; i < pedidosParaEnviar.length; i++) {
        const pedido = pedidosParaEnviar[i];
        const rawPhone = getPhone(pedido);
        const phone = formatPhone(rawPhone); // normalizado sem DDI e sem zeros à esquerda

        const formattedMessage = messageTemplate
          .replace(/{cliente}/g, pedido.cliente?.nome || "Cliente")
          .replace(/{pedido}/g, pedido.pedido || "")
          .replace(/{valor}/g, `${pedido.valor?.toFixed(2) || "0.00"}`)
          .replace(/{status}/g, statusMap[selectedCarga?.status || ""] || "")
          .replace(/{notaFiscal}/g, pedido.notaFiscal || "");

        if (!phone || phone.length < 10) {
          errorCount++;
          console.error(`✗ Telefone inválido para ${pedido.cliente?.nome}: ${rawPhone}`);
          
          // Registrar envio com erro de telefone inválido
          await supabase.from('campaign_sends').insert({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: rawPhone || 'Não informado',
            message_sent: formattedMessage,
            status: 'failed',
            error_message: 'Telefone inválido',
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0
          });
          
          setSendProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
          continue;
        }

        // Verificar se o número está na blacklist
        const { data: blacklisted } = await supabase
          .from('blacklist')
          .select('id')
          .eq('phone', phone)
          .maybeSingle();

        if (blacklisted) {
          blockedCount++;
          console.log(`⊘ Bloqueado por blacklist: ${pedido.cliente?.nome}`);
          
          // Registrar como bloqueado pela blacklist
          await supabase.from('campaign_sends').insert({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: phone,
            message_sent: formattedMessage,
            status: 'blocked',
            error_message: 'Bloqueado pela blacklist',
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0
          });
          
          setSendProgress(prev => ({ ...prev, current: i + 1, blocked: prev.blocked + 1 }));
          continue;
        }

        try {
          const { error } = await supabase.functions.invoke('whatsapp-send', {
            body: { 
              phone,
              message: formattedMessage
            }
          });

          if (error) throw error;

          // Registrar envio bem-sucedido
          await supabase.from('campaign_sends').insert({
            campaign_id: campaign.id,
            customer_name: pedido.cliente?.nome || "Cliente",
            customer_phone: phone,
            message_sent: formattedMessage,
            status: 'success',
            driver_name: selectedCarga?.nomeMotorista || null,
            peso_total: pedido.pesoBruto || 0,
            valor_total: pedido.valor || 0,
            quantidade_entregas: 1,
            quantidade_skus: pedido.produtos?.length || 0,
            quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0
          });

          successCount++;
          setSendProgress(prev => ({ ...prev, current: i + 1, success: prev.success + 1 }));
          console.log(`✓ Enviado para ${pedido.cliente?.nome}`);
        } catch (error) {
          errorCount++;
          console.error(`✗ Erro ao enviar para ${pedido.cliente?.nome}:`, error);
          
          // Registrar envio com erro - não propagar o erro
          try {
            await supabase.from('campaign_sends').insert({
              campaign_id: campaign.id,
              customer_name: pedido.cliente?.nome || "Cliente",
              customer_phone: phone,
              message_sent: formattedMessage,
              status: 'failed',
              error_message: error instanceof Error ? error.message : String(error),
              driver_name: selectedCarga?.nomeMotorista || null,
              peso_total: pedido.pesoBruto || 0,
              valor_total: pedido.valor || 0,
              quantidade_entregas: 1,
              quantidade_skus: pedido.produtos?.length || 0,
              quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0
            });
          } catch (dbError) {
            console.error('Erro ao salvar registro de falha:', dbError);
          }
          
          setSendProgress(prev => ({ ...prev, current: i + 1, failed: prev.failed + 1 }));
        }

        if (i < pedidosParaEnviar.length - 1) {
          // Delay aleatório configurável
          const delayConfig = getSendDelayConfig();
          const minMs = delayConfig.min * 1000;
          const maxMs = delayConfig.max * 1000;
          const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // Atualizar campanha com status final
      await supabase
        .from('campaigns')
        .update({
          status: errorCount === 0 ? 'completed' : 'completed_with_errors',
          sent_count: successCount
        })
        .eq('id', campaign.id);

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
      console.error('Error saving campaign:', error);
      toast.error('Erro ao salvar campanha');
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
    FATU: "Faturada",
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
    const updatedTemplates = savedTemplates.map(t => 
      t.id === selectedTemplateId 
        ? { ...t, template: messageTemplate }
        : t
    );
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Criar Nova Campanha
          </CardTitle>
          <CardDescription>
            Configure campanhas de atualização de status para seus clientes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtro de Datas */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy") : <span>Selecione a data</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => startDate ? date < startDate : false}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Filtros de Carga */}
          <div className="grid md:grid-cols-3 gap-4">
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
              <Label>Filtrar por Número</Label>
              <Input
                placeholder="Digite o número da carga"
                type="number"
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    const found = cargas.find(c => c.id.toString() === value);
                    if (found) {
                      setSelectedCargaId(value);
                    }
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label>Selecionar Carga</Label>
              <Select value={selectedCargaId} onValueChange={setSelectedCargaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma carga" />
                </SelectTrigger>
                <SelectContent>
                  {loading ? (
                    <div className="p-4 text-center">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    </div>
                  ) : (
                    filteredCargas.map((carga) => (
                      <SelectItem key={carga.id} value={carga.id.toString()}>
                        Carga #{carga.id} - {formatDate(carga.data)} - {statusMap[carga.status]} ({carga.pedidos?.length || 0} pedidos)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Lista de Pedidos */}
          {selectedCarga && selectedCarga.pedidos && selectedCarga.pedidos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Pedidos da Carga (selecionados: {selectedPedidos.size})
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllPedidos}
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllPedidos}
                  >
                    Limpar
                  </Button>
                </div>
              </div>

              <div className="border rounded-lg max-h-96 overflow-auto">
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
                    {selectedCarga.pedidos.map((pedido) => (
                      <TableRow key={pedido.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedPedidos.has(pedido.id)}
                            onCheckedChange={() => togglePedido(pedido.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {pedido.pedido}
                        </TableCell>
                        <TableCell>{pedido.cliente?.nome || "N/A"}</TableCell>
                        <TableCell>
                          <Input
                            value={getPhone(pedido)}
                            onChange={(e) => updatePhone(pedido.id, e.target.value)}
                            placeholder="Telefone"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>R$ {pedido.valor?.toFixed(2) || "0.00"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Templates de Mensagem */}
          <div className="space-y-4 border-t pt-4">
            <Label>Templates de Mensagem</Label>
            
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Selecionar Template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolha um template" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Salvar Novo Template</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome do template"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                  <Button onClick={handleSaveTemplate} variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleUpdateTemplate} 
                variant="outline" 
                size="sm"
                disabled={selectedTemplateId === "default"}
              >
                Atualizar Template Atual
              </Button>
              <Button 
                onClick={handleDeleteTemplate} 
                variant="outline" 
                size="sm"
                disabled={selectedTemplateId === "default"}
              >
                Deletar Template
              </Button>
            </div>
          </div>

          {/* Template de Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message-template">Mensagem da Campanha</Label>
            <Textarea
              id="message-template"
              placeholder="Digite sua mensagem..."
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={4}
            />
            <div className="flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground w-full">
                Variáveis disponíveis:
              </p>
              {["{cliente}", "{pedido}", "{valor}", "{status}", "{notaFiscal}"].map((v) => (
                <Badge key={v} variant="outline" className="text-xs">
                  {v}
                </Badge>
              ))}
            </div>
          </div>


          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button
              onClick={() => setShowConfirmDialog(true)}
              className="flex-1"
              disabled={!whatsappConnected || selectedPedidos.size === 0 || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar Campanha ({selectedPedidos.size} mensagens)
                </>
              )}
            </Button>
          </div>

          {/* Diálogo de Confirmação */}
          <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirma o envio da campanha?</AlertDialogTitle>
                <AlertDialogDescription>
                  Serão enviadas {selectedPedidos.size} mensagens para os clientes selecionados.
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleSendCampaign}>
                  Confirmar Envio
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Diálogo de Progresso */}
          <Dialog open={showProgressDialog} onOpenChange={setShowProgressDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Enviando Campanha</DialogTitle>
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
                  <Progress value={(sendProgress.current / sendProgress.total) * 100} />
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

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Aguarde enquanto as mensagens são enviadas...</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {!whatsappConnected && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-sm text-warning">
                ⚠️ Conecte o WhatsApp primeiro para poder enviar campanhas
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
