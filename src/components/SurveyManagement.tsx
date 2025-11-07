import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle, Trash2, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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
}

interface Campaign {
  id: string;
  name: string;
}

export function SurveyManagement() {
  const [items, setItems] = useState<SurveyManagementItem[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [campaignSearch, setCampaignSearch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const sendingRef = useRef(false); // Proteção adicional contra chamadas concorrentes

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(campaignSearch.toLowerCase())
  );

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaignId) {
      loadSurveyStatus();
    }
  }, [selectedCampaignId]);

  const loadCampaigns = async () => {
    try {
      const { data: sendsData, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('campaign_id');

      if (sendsError) throw sendsError;

      const campaignIds = [...new Set(sendsData?.map(s => s.campaign_id) || [])];

      if (campaignIds.length === 0) {
        setCampaigns([]);
        return;
      }

      const { data, error } = await supabase
        .from('campaigns')
        .select('id, name')
        .in('id', campaignIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCampaigns(data || []);
      if (data && data.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(data[0].id);
      }
    } catch (error) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadSurveyStatus = async () => {
    if (!selectedCampaignId) return;
    
    setLoading(true);
    try {
      // Buscar campaign_sends da campanha selecionada
      const { data: sends, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('*, campaigns(name)')
        .eq('campaign_id', selectedCampaignId)
        .in('status', ['success', 'sent'])
        .order('sent_at', { ascending: false });

      if (sendsError) throw sendsError;

      if (!sends || sends.length === 0) {
        setItems([]);
        return;
      }

      // Buscar surveys existentes
      const sendIds = sends.map(s => s.id);
      const { data: surveys, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('*')
        .in('campaign_send_id', sendIds);

      if (surveysError) throw surveysError;

      // Criar mapa de surveys
      const surveysMap = (surveys || []).reduce((acc, survey) => {
        acc[survey.campaign_send_id] = survey;
        return acc;
      }, {} as Record<string, any>);

      // Combinar dados e filtrar canceladas
      const combined = sends
        .map(send => {
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
            campaign_name: (send.campaigns as any)?.name || 'N/A'
          };
        })
        .filter(item => item.status !== 'cancelled'); // Não mostrar canceladas

      setItems(combined);
    } catch (error) {
      console.error('Erro ao carregar status das pesquisas:', error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map(item => item.campaign_send_id)));
    }
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
      case 'pending':
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            Enviada
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

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
          <div className="w-[280px]">
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione uma campanha" />
              </SelectTrigger>
              <SelectContent 
                className="bg-background z-50" 
                onCloseAutoFocus={(e) => e.preventDefault()}
              >
                <div className="p-2 border-b bg-background" onMouseDown={(e) => e.preventDefault()}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Buscar campanha..."
                      value={campaignSearch}
                      onChange={(e) => setCampaignSearch(e.target.value)}
                      className="pl-9 h-9"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                      }}
                    />
                  </div>
                </div>
                <ScrollArea className="h-[200px]">
                  {filteredCampaigns.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Nenhuma campanha encontrada
                    </div>
                  ) : (
                    filteredCampaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))
                  )}
                </ScrollArea>
              </SelectContent>
            </Select>
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
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum envio de campanha encontrado
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.size === items.length && items.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Envio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.campaign_send_id}>
                    <TableCell>
                       <Checkbox
                        checked={selectedIds.has(item.campaign_send_id)}
                        onCheckedChange={() => toggleSelection(item.campaign_send_id)}
                        disabled={item.status !== 'not_sent'}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{item.customer_name}</TableCell>
                    <TableCell>{item.customer_phone}</TableCell>
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
