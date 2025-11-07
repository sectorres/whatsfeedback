import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SendCounters() {
  const [campaignSent, setCampaignSent] = useState(0);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [surveySent, setSurveySent] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);
  const [activeCampaignRunId, setActiveCampaignRunId] = useState<string | null>(null);
  const [activeSurveyRunId, setActiveSurveyRunId] = useState<string | null>(null);
  const [activeSurveyCampaignId, setActiveSurveyCampaignId] = useState<string | null>(null);

  useEffect(() => {
    loadCounts();

    // Escutar mudanças nas runs ativas (pesquisa)
    const runsChannel = supabase
      .channel('survey-runs-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'survey_send_runs' },
        () => { loadCounts(); }
      )
      .subscribe();

    // Escutar mudanças nos envios de campanha (progresso X)
    const campaignChannel = supabase
      .channel('campaign-sends-progress')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaign_sends' },
        () => { if (activeCampaignRunId) { loadCampaignProgress(); } }
      )
      .subscribe();

    // Escutar mudanças no status das campanhas (para reset ao finalizar)
    const campaignsStatusChannel = supabase
      .channel('campaigns-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns' },
        () => { loadCounts(); }
      )
      .subscribe();

    // Escutar mudanças nas pesquisas (progresso X)
    const surveyChannel = supabase
      .channel('satisfaction-surveys-progress')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'satisfaction_surveys' },
        () => { if (activeSurveyCampaignId) { loadSurveyProgress(); } }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(runsChannel);
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(campaignsStatusChannel);
      supabase.removeChannel(surveyChannel);
    };
  }, [activeCampaignRunId, activeSurveyCampaignId]);

  const loadCounts = async () => {
    // Verificar se há runs ativos de campanha
    const { data: activeCampaignRun } = await supabase
      .from('campaigns')
      .select('id, status, name')
      .eq('status', 'sending')
      .maybeSingle();

    if (activeCampaignRun) {
      setActiveCampaignRunId(activeCampaignRun.id);

      // Determinar total planejado a partir do nome da campanha ("Carga #<id>")
      try {
        const match = activeCampaignRun.name?.match(/Carga\s#(\d+)/i);
        if (match) {
          const cargaId = parseInt(match[1], 10);
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - 30);
          const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
          const { data } = await supabase.functions.invoke('fetch-cargas', {
            body: { dataInicial: fmt(start), dataFinal: fmt(end) }
          });
          const cargas = (data as any)?.retorno?.cargas || [];
          const carga = cargas.find((c: any) => c.id === cargaId);
          if (carga) {
            setCampaignTotal(Array.isArray(carga.pedidos) ? carga.pedidos.length : 0);
          }
        }
      } catch (e) {
        // ignora falhas e mantém total 0
      }

      await loadCampaignProgress(activeCampaignRun.id);
    } else {
      setActiveCampaignRunId(null);
      setCampaignSent(0);
      setCampaignTotal(0);
    }

    // Verificar se há runs ativos de pesquisa
    const { data: activeSurveyRun } = await supabase
      .from('survey_send_runs')
      .select('id, campaign_id')
      .eq('status', 'running')
      .maybeSingle();

    if (activeSurveyRun) {
      setActiveSurveyRunId(activeSurveyRun.id);
      setActiveSurveyCampaignId(activeSurveyRun.campaign_id);
      await loadSurveyProgress(activeSurveyRun.campaign_id);
    } else {
      setActiveSurveyRunId(null);
      setActiveSurveyCampaignId(null);
      setSurveySent(0);
      setSurveyTotal(0);
    }
  };

  const loadCampaignProgress = async (campaignId?: string) => {
    const targetCampaignId = campaignId || activeCampaignRunId;
    if (!targetCampaignId) return;

    // Contar quantos disparos já foram registrados (X)
    const { count: sentCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', targetCampaignId);

    setCampaignSent(sentCount || 0);
  };

  const loadSurveyProgress = async (campaignId?: string) => {
    const targetCampaignId = campaignId || activeSurveyCampaignId;
    if (!targetCampaignId) return;

    // Total de pesquisas a enviar = total de disparos da campanha (Y)
    const { count: totalCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', targetCampaignId);

    // Pesquisas já processadas (status != 'pending') (X)
    const { count: sentCount } = await supabase
      .from('satisfaction_surveys')
      .select('*, campaign_sends!inner(campaign_id)', { count: 'exact', head: true })
      .eq('campaign_sends.campaign_id', targetCampaignId)
      .neq('status', 'pending');

    setSurveyTotal(totalCount || 0);
    setSurveySent(sentCount || 0);
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-0.5">
        <Send className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium">{campaignSent}/{campaignTotal}</span>
      </Badge>
      
      <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-0.5">
        <MessageSquare className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium">{surveySent}/{surveyTotal}</span>
      </Badge>
    </div>
  );
}
