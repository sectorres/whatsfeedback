import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
}

export function SavedCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [campaignSends, setCampaignSends] = useState<Record<string, CampaignSend[]>>({});
  const [loadingSends, setLoadingSends] = useState<Record<string, boolean>>({});
  const [resending, setResending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchCampaigns();

    // Realtime para campanhas
    const campaignsChannel = supabase
      .channel('campaigns-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaigns'
        },
        () => {
          fetchCampaigns();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignsChannel);
    };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaignSends = async (campaignId: string) => {
    setLoadingSends(prev => ({ ...prev, [campaignId]: true }));
    try {
      const { data, error } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setCampaignSends(prev => ({ ...prev, [campaignId]: data || [] }));
    } catch (error) {
      console.error('Error fetching campaign sends:', error);
    } finally {
      setLoadingSends(prev => ({ ...prev, [campaignId]: false }));
    }
  };

  const handleExpandChange = async (campaignId: string, open: boolean) => {
    setExpandedId(open ? campaignId : null);
    if (open && !campaignSends[campaignId]) {
      await fetchCampaignSends(campaignId);
    }
  };

  const handleResendFailed = async (campaignId: string) => {
    const failedSends = campaignSends[campaignId]?.filter(send => send.status === 'failed') || [];
    
    if (failedSends.length === 0) {
      toast.error('Não há envios falhados para reenviar');
      return;
    }

    setResending(prev => ({ ...prev, [campaignId]: true }));
    
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < failedSends.length; i++) {
      const send = failedSends[i];
      
      try {
        const { error } = await supabase.functions.invoke('whatsapp-send', {
          body: { 
            phone: send.customer_phone,
            message: send.message_sent
          }
        });

        if (error) throw error;

        // Atualizar status para sucesso
        await supabase
          .from('campaign_sends')
          .update({ status: 'success', error_message: null, sent_at: new Date().toISOString() })
          .eq('id', send.id);

        successCount++;
        console.log(`✓ Reenviado para ${send.customer_name}`);
      } catch (error) {
        errorCount++;
        console.error(`✗ Erro ao reenviar para ${send.customer_name}:`, error);
        
        // Atualizar mensagem de erro
        await supabase
          .from('campaign_sends')
          .update({ 
            error_message: error instanceof Error ? error.message : String(error),
            sent_at: new Date().toISOString()
          })
          .eq('id', send.id);
      }

      // Delay entre envios
      if (i < failedSends.length - 1) {
        const delay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Atualizar contador da campanha
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      const newSentCount = campaign.sent_count + successCount;
      await supabase
        .from('campaigns')
        .update({ sent_count: newSentCount })
        .eq('id', campaignId);
    }

    setResending(prev => ({ ...prev, [campaignId]: false }));
    
    if (errorCount === 0) {
      toast.success(`${successCount} mensagens reenviadas com sucesso!`);
    } else {
      toast.error(`${successCount} enviadas, ${errorCount} falharam`);
    }
    
    // Recarregar envios
    await fetchCampaignSends(campaignId);
    await fetchCampaigns();
  };

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    draft: { label: "Rascunho", variant: "secondary" },
    scheduled: { label: "Agendada", variant: "outline" },
    sending: { label: "Enviando", variant: "default" },
    completed: { label: "Concluída", variant: "default" },
    completed_with_errors: { label: "Concluída c/ Erros", variant: "destructive" }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campanhas Salvas</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center p-8">
            Nenhuma campanha criada ainda
          </p>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <Collapsible
                key={campaign.id}
                open={expandedId === campaign.id}
                onOpenChange={(open) => handleExpandChange(campaign.id, open)}
              >
                <div className="bg-muted rounded-lg">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/80"
                    >
                      <div className="flex-1 text-left">
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {campaign.sent_count} mensagens enviadas
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(campaign.created_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusMap[campaign.status]?.variant || "secondary"}>
                          {statusMap[campaign.status]?.label || campaign.status}
                        </Badge>
                        {expandedId === campaign.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3">
                    <div className="pt-2 border-t space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Envios ({campaign.sent_count} total):</p>
                        {campaignSends[campaign.id]?.some(send => send.status === 'failed') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResendFailed(campaign.id)}
                            disabled={resending[campaign.id]}
                            className="gap-2"
                          >
                            {resending[campaign.id] ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Reenviar Falhados
                          </Button>
                        )}
                      </div>
                      <div>
                        {loadingSends[campaign.id] ? (
                          <div className="flex justify-center p-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : campaignSends[campaign.id]?.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {campaignSends[campaign.id].map((send) => (
                              <div
                                key={send.id}
                                className={`p-2 rounded text-sm ${
                                  send.status === 'success'
                                    ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                                    : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">
                                      {send.customer_name || 'Cliente sem nome'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {send.customer_phone}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {formatDistanceToNow(new Date(send.sent_at), {
                                        addSuffix: true,
                                        locale: ptBR
                                      })}
                                    </p>
                                  </div>
                                  <Badge
                                    variant={send.status === 'success' ? 'default' : 'destructive'}
                                    className="shrink-0"
                                  >
                                    {send.status === 'success' ? '✓ Enviado' : '✗ Falhou'}
                                  </Badge>
                                </div>
                                {send.status === 'failed' && send.error_message && (
                                  <p className="text-xs text-destructive mt-2">
                                    Erro: {send.error_message}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center p-4">
                            Nenhum envio registrado
                          </p>
                        )}
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
