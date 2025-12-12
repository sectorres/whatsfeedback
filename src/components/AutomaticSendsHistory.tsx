import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface AutoSend {
  id: string;
  customer_name: string | null;
  customer_phone: string;
  status: string;
  error_message: string | null;
  sent_at: string;
  driver_name: string | null;
  pedido_numero: string | null;
  nota_fiscal: string | null;
}

interface DayGroup {
  date: string;
  sends: AutoSend[];
  stats: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    confirmed: number;
    reschedule: number;
    stopped: number;
  };
}

export function AutomaticSendsHistory() {
  const [loading, setLoading] = useState(true);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  useEffect(() => {
    fetchAutoSends();

    const channel = supabase
      .channel('auto-sends-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_sends'
      }, () => {
        fetchAutoSends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAutoSends = async () => {
    try {
      // Find the automatic system campaign
      const { data: systemCampaign } = await supabase
        .from('campaigns')
        .select('id')
        .eq('name', '[Sistema] Envio Automático FATU 050')
        .single();

      if (!systemCampaign) {
        setDayGroups([]);
        setLoading(false);
        return;
      }

      const { data: sends, error } = await supabase
        .from('campaign_sends')
        .select('id, customer_name, customer_phone, status, error_message, sent_at, driver_name, pedido_numero, nota_fiscal')
        .eq('campaign_id', systemCampaign.id)
        .order('sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;

      // Group by date
      const grouped: Record<string, AutoSend[]> = {};
      
      for (const send of sends || []) {
        const dateKey = format(parseISO(send.sent_at), 'yyyy-MM-dd');
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(send as AutoSend);
      }

      // Convert to array with stats
      const groups: DayGroup[] = Object.entries(grouped).map(([date, sends]) => ({
        date,
        sends,
        stats: {
          total: sends.length,
          success: sends.filter(s => s.status === 'success').length,
          failed: sends.filter(s => s.status === 'failed').length,
          pending: sends.filter(s => s.status === 'pending').length,
          confirmed: sends.filter(s => s.status === 'confirmed').length,
          reschedule: sends.filter(s => s.status === 'reschedule_requested').length,
          stopped: sends.filter(s => s.status === 'stopped').length,
        }
      }));

      setDayGroups(groups);
    } catch (error) {
      console.error('Error fetching auto sends:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }> = {
    success: { label: "Enviado", variant: "default", className: "bg-blue-500" },
    confirmed: { label: "Confirmado", variant: "default", className: "bg-green-600" },
    failed: { label: "Falhou", variant: "destructive" },
    pending: { label: "Pendente", variant: "outline" },
    reschedule_requested: { label: "Reagendar", variant: "secondary", className: "bg-yellow-500 text-yellow-950" },
    stopped: { label: "Parado", variant: "secondary", className: "bg-gray-500" },
    blocked: { label: "Bloqueado", variant: "secondary" },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envios Automáticos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dayGroups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envios Automáticos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center p-4">
            Nenhum envio automático registrado
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Envios Automáticos por Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {dayGroups.map((group) => (
          <Collapsible
            key={group.date}
            open={expandedDate === group.date}
            onOpenChange={(open) => setExpandedDate(open ? group.date : null)}
          >
            <div className="border rounded bg-card hover:bg-accent/5 transition-colors">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-transparent h-auto"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">
                      {format(parseISO(group.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {group.stats.total} envios
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {group.stats.confirmed > 0 && (
                      <span className="text-green-600 dark:text-green-400" title="Confirmados">
                        ✓ {group.stats.confirmed}
                      </span>
                    )}
                    {group.stats.success > 0 && (
                      <span className="text-blue-600 dark:text-blue-400" title="Enviados">
                        📤 {group.stats.success}
                      </span>
                    )}
                    {group.stats.pending > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-400" title="Pendentes">
                        ⏳ {group.stats.pending}
                      </span>
                    )}
                    {group.stats.reschedule > 0 && (
                      <span className="text-orange-600 dark:text-orange-400" title="Reagendar">
                        📅 {group.stats.reschedule}
                      </span>
                    )}
                    {group.stats.stopped > 0 && (
                      <span className="text-gray-500" title="Parados">
                        🛑 {group.stats.stopped}
                      </span>
                    )}
                    {group.stats.failed > 0 && (
                      <span className="text-destructive" title="Falhou">
                        ✗ {group.stats.failed}
                      </span>
                    )}
                    {expandedDate === group.date ? (
                      <ChevronUp className="h-4 w-4 ml-2 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
                    )}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-3 pb-2 pt-1 border-t space-y-1 max-h-80 overflow-y-auto">
                  {group.sends.map((send) => (
                    <div
                      key={send.id}
                      className={`p-2 rounded border text-sm ${
                        send.status === 'confirmed'
                          ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                          : send.status === 'success'
                          ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
                          : send.status === 'failed'
                          ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                          : send.status === 'reschedule_requested'
                          ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
                          : 'bg-muted/30 border-border'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">
                              {send.customer_name || 'Cliente'}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {send.customer_phone}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {send.pedido_numero && (
                              <span className="font-medium text-foreground">
                                {send.pedido_numero}
                              </span>
                            )}
                            {send.nota_fiscal && (
                              <span>NF: {send.nota_fiscal}</span>
                            )}
                            {send.driver_name && (
                              <span>Mot: {send.driver_name}</span>
                            )}
                            <span>
                              {format(parseISO(send.sent_at), "HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant={statusConfig[send.status]?.variant || 'secondary'}
                          className={`shrink-0 text-xs ${statusConfig[send.status]?.className || ''}`}
                        >
                          {statusConfig[send.status]?.label || send.status}
                        </Badge>
                      </div>
                      {send.status === 'failed' && send.error_message && (
                        <p className="text-xs text-destructive mt-1">
                          Erro: {send.error_message}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        ))}
      </CardContent>
    </Card>
  );
}
