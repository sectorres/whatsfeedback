import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, Search, CheckSquare } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SurveyManagementItem {
  id: string;
  campaign_send_id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  sent_at: string;
  responded_at: string | null;
  rating: number | null;
  campaign_name?: string;
  pedido_numero?: string;
  driver_name?: string;
}

export function SurveyManagement() {
  const [items, setItems] = useState<SurveyManagementItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const sendingRef = useRef(false);

  // Não usar useEffect para busca automática - apenas com Enter
  const handleBarcodeSearch = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    try {
      // Buscar dados atualizados da API primeiro
      console.log('Buscando dados da API para:', searchTerm);
      
      try {
        const { data: apiData, error: apiError } = await supabase.functions.invoke('fetch-cargas', {
          body: {}
        });

        if (!apiError && apiData?.retorno?.cargas) {
          for (const carga of apiData.retorno.cargas) {
            if (carga.pedidos) {
              for (const pedido of carga.pedidos) {
                const pedidoNumero = pedido.pedido;
                
                if (pedidoNumero && pedidoNumero.toLowerCase().includes(searchTerm.toLowerCase())) {
                  console.log('Pedido encontrado na API:', pedidoNumero);
                  
                  const { data: existingSends } = await supabase
                    .from('campaign_sends')
                    .select('id')
                    .eq('pedido_numero', pedidoNumero);
                  
                  if (existingSends && existingSends.length > 0) {
                    await supabase
                      .from('campaign_sends')
                      .update({
                        driver_name: carga.nomeMotorista || 'N/A',
                        customer_name: pedido.cliente?.nome || 'N/A'
                      })
                      .eq('id', existingSends[0].id);
                  }
                }
              }
            }
          }
        }
      } catch (apiErr) {
        console.error('Erro ao buscar dados da API:', apiErr);
      }

      // Buscar no banco de dados
      const searchLower = searchTerm.toLowerCase();
      const query = supabase
        .from('campaign_sends')
        .select('id, customer_name, customer_phone, sent_at, pedido_numero, driver_name, campaign_id')
        .in('status', ['success', 'sent', 'confirmed', 'reschedule_requested'])
        .or(`pedido_numero.ilike.%${searchLower}%,customer_name.ilike.%${searchLower}%`)
        .order('sent_at', { ascending: false })
        .limit(100);
      
      const { data: sends, error: sendsError } = await query;

      if (sendsError) throw sendsError;

      if (!sends || sends.length === 0) {
        toast({
          title: "Pedido não encontrado",
          description: `Nenhum pedido encontrado para: ${searchTerm}`,
          variant: "destructive",
        });
        setSearchTerm('');
        return;
      }

      // Buscar nome da campanha
      const campaignIds = [...new Set(sends.map(s => s.campaign_id))];
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds);

      const campaignsMap = (campaignsData || []).reduce((acc, campaign) => {
        acc[campaign.id] = campaign.name;
        return acc;
      }, {} as Record<string, string>);

      // Buscar surveys existentes
      const { data: surveys } = await supabase
        .from('satisfaction_surveys')
        .select('campaign_send_id, id, status, sent_at, responded_at, rating')
        .not('status', 'in', '("cancelled","not_sent")')
        .order('sent_at', { ascending: false });

      const sendIdsSet = new Set(sends.map(s => s.id));
      const surveysMap = (surveys || [])
        .filter(survey => sendIdsSet.has(survey.campaign_send_id))
        .reduce((acc, survey) => {
          acc[survey.campaign_send_id] = survey;
          return acc;
        }, {} as Record<string, any>);

      // Combinar dados
      const combined = sends.map(send => {
        const survey = surveysMap[send.id];
        return {
          id: survey?.id || send.id,
          campaign_send_id: send.id,
          customer_name: send.customer_name,
          customer_phone: send.customer_phone,
          status: survey?.status || 'not_sent',
          sent_at: survey?.sent_at || send.sent_at,
          responded_at: survey?.responded_at || null,
          rating: survey?.rating || null,
          campaign_name: campaignsMap[send.campaign_id] || 'N/A',
          pedido_numero: send.pedido_numero || 'N/A',
          driver_name: send.driver_name || 'N/A'
        };
      });

      // Adicionar novos itens à lista existente (sem duplicar)
      setItems(prevItems => {
        const existingIds = new Set(prevItems.map(item => item.campaign_send_id));
        const newItems = combined.filter(item => !existingIds.has(item.campaign_send_id));
        return [...prevItems, ...newItems];
      });
      
      // Adicionar automaticamente pedidos elegíveis à seleção
      const selectableIds = combined
        .filter(item => item.status === 'not_sent' || item.status === 'pending' || item.status === 'failed')
        .map(item => item.campaign_send_id);
      
      setSelectedIds(prev => {
        const newSet = new Set(prev);
        selectableIds.forEach(id => newSet.add(id));
        return newSet;
      });

      toast({
        title: "Pedido adicionado",
        description: `${combined.length} pedido(s) encontrado(s) e adicionado(s)`,
      });

      // Limpar campo para próxima leitura
      setSearchTerm('');
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
      toast({
        title: "Erro ao buscar pedido",
        description: error.message,
        variant: "destructive",
      });
      setSearchTerm('');
    } finally {
      setLoading(false);
    }
  };

  const loadSurveyStatus = async () => {
    // Função mantida para o botão Atualizar, mas agora recarrega toda a lista
    setLoading(true);
    setItems([]);
    setSelectedIds(new Set());
    setLoading(false);
  };

  const sendSelectedSurveys = async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Nenhuma pesquisa selecionada",
        description: "Selecione ao menos uma pesquisa para enviar",
        variant: "destructive",
      });
      return;
    }

    // PROTEÇÃO CRÍTICA: Impedir chamadas concorrentes
    if (sendingRef.current || sending) {
      console.log('⚠️ Tentativa de envio duplicado bloqueada');
      return;
    }

    // Verificar se há pesquisas respondidas ou expiradas selecionadas
    const hasRespondedOrExpiredSurveys = items.some(
      item => selectedIds.has(item.campaign_send_id) && (item.status === 'responded' || item.status === 'expired' || item.rating != null)
    );

    if (hasRespondedOrExpiredSurveys) {
      toast({
        title: "Pesquisas inválidas selecionadas",
        description: "Não é possível reenviar pesquisas respondidas ou expiradas",
        variant: "destructive",
      });
      return;
    }

    // Marcar como enviando IMEDIATAMENTE
    sendingRef.current = true;
    setSending(true);
    
    // Evitar cliques duplicados - desabilitar seleções imediatamente
    const idsToSend = Array.from(selectedIds);
    setSelectedIds(new Set());
    
    try {
      // Filtrar itens selecionados para obter dados completos
      const selectedItems = items.filter(item => idsToSend.includes(item.campaign_send_id));
      
      // REMOVIDO: não criar registros 'pending' no cliente para evitar confusão de status
      // O backend já cria/atualiza as pesquisas conforme necessário

      const { data, error } = await supabase.functions.invoke('send-satisfaction-survey', {
        body: {
          campaignSendIds: idsToSend
        }
      });

      if (error) throw error;

      const details = [];
      if (data.new_surveys > 0) {
        details.push(`${data.new_surveys} nova${data.new_surveys > 1 ? 's' : ''}`);
      }
      if (data.resent_surveys > 0) {
        details.push(`${data.resent_surveys} reenviada${data.resent_surveys > 1 ? 's' : ''}`);
      }
      if (data.failed_surveys > 0) {
        details.push(`${data.failed_surveys} falha${data.failed_surveys > 1 ? 's' : ''}`);
      }

      toast({
        title: "Pesquisas processadas!",
        description: data.surveys_sent > 0 
          ? `${data.surveys_sent} enviada${data.surveys_sent > 1 ? 's' : ''} com sucesso (${details.join(', ')})`
          : "Nenhuma pesquisa foi enviada",
      });

      loadSurveyStatus();
    } catch (error) {
      toast({
        title: "Erro ao enviar pesquisas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSending(false);
      sendingRef.current = false; // Liberar para próximas chamadas
    }
  };

  const deleteSelectedSurveys = async () => {
    if (selectedIds.size === 0) return;

    // Filtrar apenas as pesquisas NÃO enviadas
    const surveysToDelete = items.filter(
      item => selectedIds.has(item.campaign_send_id) && 
      item.status === 'not_sent'
    );

    if (surveysToDelete.length === 0) {
      toast({
        title: "Nenhuma pesquisa elegível",
        description: "Apenas pesquisas ainda não enviadas podem ser removidas",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      // Para cada pesquisa não enviada, criar um registro com status 'cancelled'
      const surveysToCancel = surveysToDelete.map(item => ({
        campaign_send_id: item.campaign_send_id,
        customer_phone: item.customer_phone,
        customer_name: item.customer_name,
        status: 'cancelled',
        sent_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('satisfaction_surveys')
        .upsert(surveysToCancel, {
          onConflict: 'campaign_send_id'
        });

      if (error) throw error;

      toast({
        title: "Pesquisas removidas!",
        description: `${surveysToCancel.length} pesquisa${surveysToCancel.length > 1 ? 's' : ''} removida${surveysToCancel.length > 1 ? 's' : ''} com sucesso`,
      });

      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      loadSurveyStatus();
    } catch (error) {
      toast({
        title: "Erro ao remover pesquisas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelection = (campaignSendId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(campaignSendId)) {
      newSelected.delete(campaignSendId);
    } else {
      newSelected.add(campaignSendId);
    }
    setSelectedIds(newSelected);
  };

  // Usar items diretamente sem filtro adicional no cliente
  const filteredItems = items;

  const toggleAll = () => {
    // Apenas selecionar pedidos que podem ser enviados (dos itens filtrados)
    const selectableItems = filteredItems.filter(
      item => item.status === 'not_sent' || item.status === 'pending' || item.status === 'failed'
    );
    
    if (selectedIds.size === selectableItems.length && selectableItems.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableItems.map(item => item.campaign_send_id)));
    }
  };

  const markForSending = () => {
    const selectableItems = filteredItems.filter(
      item => item.status === 'not_sent' || item.status === 'pending' || item.status === 'failed'
    );
    setSelectedIds(new Set(selectableItems.map(item => item.campaign_send_id)));
  };

  const getStatusBadge = (status: string, rating: number | null) => {
    // Se já existe nota, considerar como respondida independentemente do status
    if (rating != null) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Respondida ({rating}★)
        </Badge>
      );
    }
    switch (status) {
      case 'expired':
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <XCircle className="h-3 w-3 mr-1" />
            Expirada
          </Badge>
        );
      case 'responded':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Respondida
          </Badge>
        );
      case 'awaiting_feedback':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando feedback
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            Enviada
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Falhou
          </Badge>
        );
      default:
        return (
          <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
            <AlertCircle className="h-3 w-3 mr-1" />
            Não enviada
          </Badge>
        );
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Gerenciamento de Pesquisas</CardTitle>
            <CardDescription>
              Visualize e gerencie o envio individual de pesquisas de satisfação
            </CardDescription>
          </div>
          <div className="flex gap-3 items-end">
            <div className="w-[300px]">
              <label className="text-sm font-medium mb-1.5 block">Buscar Pedido</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Bipe o código de barras do pedido..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeSearch();
                    }
                  }}
                  className="pl-9"
                  disabled={loading}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSurveyStatus}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markForSending}
              disabled={filteredItems.length === 0}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Marcar para Envio
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={selectedIds.size === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remover ({selectedIds.size})
            </Button>
            <Button
              onClick={sendSelectedSurveys}
              disabled={sending || selectedIds.size === 0}
              size="sm"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm.trim() ? 'Nenhum pedido encontrado' : 'Digite um termo de busca para visualizar pedidos'}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredItems.filter(i => i.status === 'not_sent' || i.status === 'pending' || i.status === 'failed').length > 0 &&
                        selectedIds.size === filteredItems.filter(i => i.status === 'not_sent' || i.status === 'pending' || i.status === 'failed').length
                      }
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.campaign_send_id}>
                    <TableCell>
                       <Checkbox
                         checked={selectedIds.has(item.campaign_send_id)}
                         onCheckedChange={() => toggleSelection(item.campaign_send_id)}
                         disabled={!(item.status === 'not_sent' || item.status === 'pending' || item.status === 'failed')}
                       />
                    </TableCell>
                    <TableCell className="font-medium">{item.customer_name}</TableCell>
                    <TableCell>{item.customer_phone}</TableCell>
                    <TableCell className="font-mono text-sm">{item.pedido_numero || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{item.driver_name || 'N/A'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.campaign_name}
                    </TableCell>
                    <TableCell>{getStatusBadge(item.status, item.rating)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.sent_at ? format(new Date(item.sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover pesquisas selecionadas?</AlertDialogTitle>
            <AlertDialogDescription>
              Apenas pesquisas ainda não enviadas serão removidas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteSelectedSurveys}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removendo...
                </>
              ) : (
                'Remover'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
