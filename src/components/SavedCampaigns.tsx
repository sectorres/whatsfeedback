import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string;
  sent_count: number;
  created_at: string;
  scheduled_at: string | null;
}

export function SavedCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
                onOpenChange={(open) => setExpandedId(open ? campaign.id : null)}
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
                    <div className="pt-2 border-t space-y-2">
                      <div>
                        <p className="text-sm font-medium mb-1">Mensagem:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line bg-background p-3 rounded">
                          {campaign.message}
                        </p>
                      </div>
                      {campaign.scheduled_at && (
                        <div>
                          <p className="text-sm font-medium">Agendada para:</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(campaign.scheduled_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      )}
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
