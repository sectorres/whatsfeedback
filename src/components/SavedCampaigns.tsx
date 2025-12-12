import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ChevronDown, ChevronUp, RefreshCw, Edit2, Check, X } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { normalizePhone } from "@/lib/phone-utils";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { AutomaticSendsHistory } from "./AutomaticSendsHistory";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  sent_count: number;
  created_at: string;
  scheduled_at: string | null;
}
interface CampaignSend {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  message_sent: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  driver_name: string | null;
  pedido_numero: string | null;
}
interface CampaignCounts {
  success: number;
  failed: number;
}
export function SavedCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend[]>>({});
  const [campaignCounts, setCampaignCounts] = useState<Record<string, CampaignCounts>>({});
  const [loadingSends, setLoadingSends] = useState<Record<string, boolean>>({});
  const [resending, setResending] = useState<Record<string, boolean>>({});
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editedPhone, setEditedPhone] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  useEffect(() => {
    fetchCampaigns();

    // Realtime para campanhas - atualiza automaticamente quando uma nova é criada
    const campaignsChannel = supabase.channel('campaigns-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'campaigns'
    }, payload => {
      console.log('Campaign change detected:', payload);
      fetchCampaigns();
    }).subscribe();

    // Realtime para campaign_sends - atualiza quando há novos envios
    const sendsChannel = supabase.channel('campaign-sends-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'campaign_sends'
    }, payload => {
      console.log('Campaign send change detected:', payload);
      // Recarregar envios da campanha específica se estiver expandida
      if (expandedId && payload.new && 'campaign_id' in payload.new) {
        const campaignId = (payload.new as any).campaign_id;
        if (campaignId === expandedId) {
          fetchCampaignSends(campaignId);
        }
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(campaignsChannel);
      supabase.removeChannel(sendsChannel);
    };
  }, [expandedId, currentPage]);
  const fetchCampaigns = async () => {
    try {
      // Get total count (excluding automatic system campaigns)
      const {
        count
      } = await supabase.from('campaigns').select('*', {
        count: 'exact',
        head: true
      }).not('name', 'like', '[Sistema]%');
      if (count) {
        setTotalPages(Math.ceil(count / itemsPerPage));
      }

      // Get paginated data (excluding automatic system campaigns)
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const {
        data,
        error
      } = await supabase.from('campaigns').select('*').not('name', 'like', '[Sistema]%').order('created_at', {
        ascending: false
      }).range(from, to);
      if (error) throw error;
      setCampaigns(data || []);

      // Fetch counts for all campaigns
      if (data && data.length > 0) {
        await fetchAllCampaignCounts(data.map(c => c.id));
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchCampaignSends = async (campaignId: string) => {
    setLoadingSends(prev => ({
      ...prev,
      [campaignId]: true
    }));
    try {
      const {
        data,
        error
      } = await supabase.from('campaign_sends').select('id, customer_name, customer_phone, message_sent, status, error_message, sent_at, driver_name, pedido_numero').eq('campaign_id', campaignId).order('sent_at', {
        ascending: false
      }).limit(1000);
      if (error) throw error;
      setCampaignSends(prev => ({
        ...prev,
        [campaignId]: (data || []) as CampaignSend[]
      }));
    } catch (error) {
      console.error('Error fetching campaign sends:', error);
    } finally {
      setLoadingSends(prev => ({
        ...prev,
        [campaignId]: false
      }));
    }
  };
  const fetchAllCampaignCounts = async (campaignIds: string[]) => {
    try {
      const {
        data,
        error
      } = await supabase.from('campaign_sends').select('campaign_id, status').in('campaign_id', campaignIds);
      if (error) throw error;
      const counts: Record<string, CampaignCounts> = {};
      for (const id of campaignIds) {
        counts[id] = {
          success: 0,
          failed: 0
        };
      }
      for (const send of data || []) {
        if (send.status === 'success' || send.status === 'confirmed') {
          counts[send.campaign_id].success++;
        } else if (send.status === 'failed') {
          counts[send.campaign_id].failed++;
        }
      }
      setCampaignCounts(counts);
    } catch (error) {
      console.error('Error fetching campaign counts:', error);
    }
  };
  const handleExpandChange = async (campaignId: string, open: boolean) => {
    setExpandedId(open ? campaignId : null);
    if (open && !campaignSends[campaignId]) {
      await fetchCampaignSends(campaignId);
    }
  };
  const startEditPhone = (sendId: string, currentPhone: string) => {
    setEditingPhone(sendId);
    setEditedPhone(currentPhone);
  };
  const cancelEditPhone = () => {
    setEditingPhone(null);
    setEditedPhone("");
  };
  const saveEditedPhone = async (sendId: string, campaignId: string) => {
    if (!editedPhone.trim()) {
      toast.error("Número não pode ser vazio");
      return;
    }
    try {
      // Normalizar telefone ao salvar
      const normalizedPhone = normalizePhone(editedPhone);
      const {
        error
      } = await supabase.from('campaign_sends').update({
        customer_phone: normalizedPhone
      }).eq('id', sendId);
      if (error) throw error;
      toast.success("Número atualizado");
      setEditingPhone(null);
      setEditedPhone("");
      await fetchCampaignSends(campaignId);
    } catch (error) {
      console.error('Error updating phone:', error);
      toast.error("Erro ao atualizar número");
    }
  };
  const handleResendFailed = async (campaignId: string) => {
    const failedSends = campaignSends[campaignId]?.filter(send => send.status === 'failed') || [];
    if (failedSends.length === 0) {
      toast.error('Não há envios falhados para reenviar');
      return;
    }
    setResending(prev => ({
      ...prev,
      [campaignId]: true
    }));
    let successCount = 0;
    let errorCount = 0;
    for (let i = 0; i < failedSends.length; i++) {
      const send = failedSends[i];
      try {
        const {
          error
        } = await supabase.functions.invoke('whatsapp-send', {
          body: {
            phone: send.customer_phone,
            message: send.message_sent
          }
        });
        if (error) throw error;

        // Atualizar status para sucesso
        await supabase.from('campaign_sends').update({
          status: 'success',
          error_message: null,
          sent_at: new Date().toISOString()
        }).eq('id', send.id);
        successCount++;
        console.log(`✓ Reenviado para ${send.customer_name}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Erro ao reenviar para ${send.customer_name}:`, error);

        // Atualizar mensagem de erro - não propagar
        try {
          await supabase.from('campaign_sends').update({
            error_message: error instanceof Error ? error.message : String(error),
            sent_at: new Date().toISOString()
          }).eq('id', send.id);
        } catch (dbError) {
          console.error('Erro ao atualizar registro:', dbError);
        }
      }

      // Delay de 5 segundos entre envios
      if (i < failedSends.length - 1) {
        const delaySeconds = 5;
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // Atualizar contador da campanha
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      const newSentCount = campaign.sent_count + successCount;
      await supabase.from('campaigns').update({
        sent_count: newSentCount
      }).eq('id', campaignId);
    }
    setResending(prev => ({
      ...prev,
      [campaignId]: false
    }));
    if (errorCount === 0) {
      toast.success(`${successCount} mensagens reenviadas com sucesso!`);
    } else {
      toast.error(`${successCount} enviadas, ${errorCount} falharam`);
    }

    // Recarregar envios
    await fetchCampaignSends(campaignId);
    await fetchCampaigns();
  };
  const statusMap: Record<string, {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }> = {
    draft: {
      label: "Rascunho",
      variant: "secondary"
    },
    scheduled: {
      label: "Agendada",
      variant: "outline"
    },
    sending: {
      label: "Enviando",
      variant: "default"
    },
    completed: {
      label: "Concluída",
      variant: "default"
    },
    completed_with_errors: {
      label: "Concluída c/ Erros",
      variant: "destructive"
    }
  };
  const sendStatusMap: Record<string, {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }> = {
    success: {
      label: "✓ Enviado",
      variant: "default"
    },
    confirmed: {
      label: "✓ Confirmado",
      variant: "default"
    },
    failed: {
      label: "✗ Falhou",
      variant: "destructive"
    },
    blocked: {
      label: "⊘ Bloqueado",
      variant: "secondary"
    }
  };
  return (
    <div className="space-y-4">
      <AutomaticSendsHistory />
      <Card>
        <CardHeader>
          <CardTitle>Campanhas Manuais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-8">
              Nenhuma campanha criada ainda
            </p>
          ) : (
            <>
            <div className="space-y-1.5">
              {campaigns.map(campaign => <Collapsible key={campaign.id} open={expandedId === campaign.id} onOpenChange={open => handleExpandChange(campaign.id, open)}>
                  <div className="border rounded bg-card hover:bg-accent/5 transition-colors">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full flex items-center justify-between px-3 py-2 hover:bg-transparent h-auto">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2">
                              <h3 className="font-medium text-sm truncate">{campaign.name}</h3>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {format(new Date(campaign.created_at), "dd/MM/yy HH:mm", {
                            locale: ptBR
                          })}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs shrink-0">
                            <span className="text-muted-foreground">
                              {campaign.sent_count} envios
                            </span>
                            <span className="text-green-600 dark:text-green-400">
                              ✓ {campaignSends[campaign.id] ? campaignSends[campaign.id].filter(s => s.status === 'success' || s.status === 'confirmed').length : campaignCounts[campaign.id]?.success || 0}
                            </span>
                            <span className="text-destructive">
                              ✗ {campaignSends[campaign.id] ? campaignSends[campaign.id].filter(s => s.status === 'failed').length : campaignCounts[campaign.id]?.failed || 0}
                            </span>
                          </div>
                          <Badge variant={statusMap[campaign.status]?.variant || "secondary"} className="text-xs px-2 py-0">
                            {statusMap[campaign.status]?.label || campaign.status}
                          </Badge>
                        </div>
                        {expandedId === campaign.id ? <ChevronUp className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 ml-2 shrink-0 text-muted-foreground" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-2 pt-1.5 border-t space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Detalhes dos Envios</p>
                          {campaignSends[campaign.id]?.some(send => send.status === 'failed') && <Button size="sm" variant="outline" onClick={() => handleResendFailed(campaign.id)} disabled={resending[campaign.id]} className="gap-1.5 h-7 text-xs">
                              {resending[campaign.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                              Reenviar Falhados
                            </Button>}
                        </div>
                        <div>
                          {loadingSends[campaign.id] ? <div className="flex justify-center p-4">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div> : campaignSends[campaign.id]?.length > 0 ? <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
                              {campaignSends[campaign.id].map(send => <div key={send.id} className={`p-2 rounded border ${send.status === 'success' || send.status === 'confirmed' ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : send.status === 'blocked' ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800' : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-medium text-sm truncate">
                                            {send.customer_name || 'Cliente sem nome'}
                                          </p>
                                          {editingPhone === send.id ? <div className="flex items-center gap-0.5">
                                              <Input value={editedPhone} onChange={e => setEditedPhone(e.target.value)} className="h-6 text-xs w-28" autoFocus />
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => saveEditedPhone(send.id, campaign.id)}>
                                                <Check className="h-3 w-3 text-green-600" />
                                              </Button>
                                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={cancelEditPhone}>
                                                <X className="h-3 w-3 text-red-600" />
                                              </Button>
                                            </div> : <>
                                              <p className="text-xs text-muted-foreground font-mono">
                                                {send.customer_phone}
                                              </p>
                                              <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => startEditPhone(send.id, send.customer_phone)}>
                                                <Edit2 className="h-2.5 w-2.5" />
                                              </Button>
                                            </>}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                          {send.pedido_numero && <span className="font-medium text-foreground">Pedido: {send.pedido_numero}</span>}
                                          {send.driver_name && <span>Mot: {send.driver_name}</span>}
                                          <span>
                                            {format(new Date(send.sent_at), "dd/MM/yy HH:mm", {
                                    locale: ptBR
                                  })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                    <Badge variant={sendStatusMap[send.status]?.variant || 'secondary'} className="shrink-0 text-xs px-2 py-0">
                                      {sendStatusMap[send.status]?.label || send.status}
                                    </Badge>
                                  </div>
                                  {(send.status === 'failed' || send.status === 'blocked') && send.error_message && <p className={`text-xs mt-1 ${send.status === 'blocked' ? 'text-yellow-700 dark:text-yellow-500' : 'text-destructive'}`}>
                                      {send.status === 'blocked' ? '⊘ ' : 'Erro: '}{send.error_message}
                                    </p>}
                                </div>)}
                            </div> : <p className="text-sm text-muted-foreground text-center p-4">
                              Nenhum envio registrado
                            </p>}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>)}
            </div>

            {totalPages > 1 && <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                  
                  {Array.from({
              length: totalPages
            }, (_, i) => i + 1).map(page => {
              // Show first page, last page, current page, and pages around current
              const showPage = page === 1 || page === totalPages || page >= currentPage - 1 && page <= currentPage + 1;
              if (!showPage) {
                // Show ellipsis
                if (page === currentPage - 2 || page === currentPage + 2) {
                  return <PaginationItem key={page}>
                            <span className="px-2">...</span>
                          </PaginationItem>;
                }
                return null;
              }
              return <PaginationItem key={page}>
                        <PaginationLink onClick={() => setCurrentPage(page)} isActive={currentPage === page} className="cursor-pointer">
                          {page}
                        </PaginationLink>
                      </PaginationItem>;
            })}

                  <PaginationItem>
                    <PaginationNext onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}