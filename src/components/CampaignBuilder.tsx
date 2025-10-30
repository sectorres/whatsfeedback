import { useState, useEffect } from "react";
import { Plus, Send, Filter, Users, MessageSquare } from "lucide-react";
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
}

interface PedidoWithEditablePhone extends Pedido {
  editedPhone?: string;
}

interface CampaignBuilderProps {
  whatsappConnected: boolean;
}

export const CampaignBuilder = ({ whatsappConnected }: CampaignBuilderProps) => {
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState(
    "Olá {cliente}! Seu pedido {pedido} no valor de R$ {valor} está {status}."
  );
  
  const defaultTemplates = [
    {
      id: "default",
      name: "Padrão - Atualização de Status",
      template: "Olá {cliente}! Seu pedido {pedido} no valor de R$ {valor} está {status}."
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
  }, []);

  const fetchCargas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("fetch-cargas");

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
    return phone.replace(/\D/g, "");
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

    if (!campaignName || !messageTemplate) {
      toast.error("Preencha o nome e a mensagem da campanha");
      return;
    }

    if (selectedPedidos.size === 0) {
      toast.error("Selecione pelo menos um pedido");
      return;
    }

    setSending(true);
    
    const pedidosParaEnviar = selectedCarga?.pedidos.filter(p => 
      selectedPedidos.has(p.id)
    ) || [];

    toast.success(`Enviando ${pedidosParaEnviar.length} mensagens...`);
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < pedidosParaEnviar.length; i++) {
      const pedido = pedidosParaEnviar[i];
      const rawPhone = getPhone(pedido);
      const phone = formatPhone(rawPhone); // Limpa o telefone antes de enviar

      if (!phone || phone.length < 10) {
        errorCount++;
        console.error(`✗ Telefone inválido para ${pedido.cliente?.nome}: ${rawPhone}`);
        continue;
      }

      try {
        const formattedMessage = messageTemplate
          .replace(/{cliente}/g, pedido.cliente?.nome || "Cliente")
          .replace(/{pedido}/g, pedido.pedido || "")
          .replace(/{valor}/g, `${pedido.valor?.toFixed(2) || "0.00"}`)
          .replace(/{status}/g, statusMap[selectedCarga?.status || ""] || "")
          .replace(/{notaFiscal}/g, pedido.notaFiscal || "");

        const { error } = await supabase.functions.invoke('whatsapp-send', {
          body: { 
            phone,
            message: formattedMessage
          }
        });

        if (error) throw error;

        successCount++;
        console.log(`✓ Enviado para ${pedido.cliente?.nome}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Erro ao enviar para ${pedido.cliente?.nome}:`, error);
      }

      if (i < pedidosParaEnviar.length - 1) {
        const delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setSending(false);
    
    if (errorCount === 0) {
      toast.success(`Campanha enviada com sucesso! ${successCount} mensagens enviadas`);
    } else {
      toast.error(`Campanha concluída com erros: ${successCount} enviadas, ${errorCount} falharam`);
    }
    
    setCampaignName("");
    setSelectedPedidos(new Set());
    setEditedPhones({});
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
          {/* Nome da Campanha */}
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da Campanha</Label>
            <Input
              id="campaign-name"
              placeholder="Ex: Atualização de Status - Setembro 2025"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
            />
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

          {/* Prévia da Mensagem */}
          {selectedCarga && selectedPedidos.size > 0 && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <Label className="text-sm font-medium">Prévia da Mensagem</Label>
              <div className="bg-background p-3 rounded border text-sm">
                {messageTemplate
                  .replace("{cliente}", selectedCarga.pedidos[0]?.cliente?.nome || "Cliente")
                  .replace("{pedido}", selectedCarga.pedidos[0]?.pedido || "000/000000-P")
                  .replace("{valor}", `${selectedCarga.pedidos[0]?.valor?.toFixed(2) || "0.00"}`)
                  .replace("{status}", statusMap[selectedCarga.status] || selectedCarga.status)
                  .replace("{notaFiscal}", selectedCarga.pedidos[0]?.notaFiscal || "N/A")}
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-2">
            <Button
              onClick={handleSendCampaign}
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
