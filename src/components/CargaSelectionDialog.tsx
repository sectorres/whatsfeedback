import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Calendar, User, Truck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  target_type: string;
  sent_count: number;
  created_at: string;
  updated_at: string;
}

interface CargaSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCargaSelected: (campaignId: string) => void;
}

export function CargaSelectionDialog({ 
  open, 
  onOpenChange, 
  onCargaSelected
}: CargaSelectionDialogProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCargas();
    }
  }, [open]);

  const loadCargas = async () => {
    setLoading(true);
    try {
      // Buscar campanhas de aviso de entrega já concluídas
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('target_type', 'carga')
        .in('status', ['completed', 'completed_with_errors'])
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      if (!campaignsData || campaignsData.length === 0) {
        setCampaigns([]);
        toast({
          title: "Nenhuma campanha encontrada",
          description: "Não há campanhas de aviso de entrega disponíveis",
        });
        return;
      }

      const campaignIds = campaignsData.map(c => c.id);

      // Buscar sends dessas campanhas
      const { data: sendsData, error: sendsError } = await supabase
        .from('campaign_sends')
        .select('id, campaign_id')
        .in('campaign_id', campaignIds)
        .in('status', ['success', 'sent']);

      if (sendsError) throw sendsError;

      const sendsByCampaign = new Map<string, string[]>();
      const allSendIds: string[] = [];
      (sendsData || []).forEach((s) => {
        allSendIds.push(s.id);
        const arr = sendsByCampaign.get(s.campaign_id) || [];
        arr.push(s.id);
        sendsByCampaign.set(s.campaign_id, arr);
      });

      if (allSendIds.length === 0) {
        setCampaigns([]);
        return;
      }

      // Buscar pesquisas existentes para esses sends
      const { data: surveysData, error: surveysError } = await supabase
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('campaign_send_id', allSendIds);

      if (surveysError) throw surveysError;

      const surveyedSendIds = new Set((surveysData || []).map(s => s.campaign_send_id));

      // Manter apenas campanhas que ainda tenham ao menos um send sem pesquisa criada
      const withPending = campaignsData.filter((c) => {
        const sendIds = sendsByCampaign.get(c.id) || [];
        return sendIds.some((id) => !surveyedSendIds.has(id));
      });

      setCampaigns(withPending);
    } catch (error: any) {
      console.error('Erro ao carregar campanhas:', error);
      toast({
        title: "Erro ao carregar campanhas",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCampaignId) {
      onCargaSelected(selectedCampaignId);
      onOpenChange(false);
      setSelectedCampaignId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'completed': { label: 'Concluída', variant: 'default' },
      'completed_with_errors': { label: 'Concluída com erros', variant: 'outline' },
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Selecionar Campanha de Aviso de Entrega
          </DialogTitle>
          <DialogDescription>
            Escolha a campanha de aviso de entrega para enviar pesquisas de satisfação aos clientes
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              {campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma campanha de aviso de entrega disponível
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <Card
                    key={campaign.id}
                    className={`cursor-pointer transition-all hover:border-primary ${
                      selectedCampaignId === campaign.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg">
                              {campaign.name}
                            </div>
                            {getStatusBadge(campaign.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(campaign.created_at)}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Package className="h-4 w-4" />
                              <span>{campaign.sent_count} envio(s)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedCampaignId(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCampaignId || loading}
          >
            Confirmar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
