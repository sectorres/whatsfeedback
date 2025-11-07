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

  useEffect(() => {
    loadCounts();

    // Escutar mudanças nas runs ativas
    const runsChannel = supabase
      .channel('survey-runs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'survey_send_runs'
        },
        () => {
          loadCounts();
        }
      )
      .subscribe();

    // Escutar mudanças nos envios de campanha
    const campaignChannel = supabase
      .channel('campaign-sends-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_sends'
        },
        () => {
          if (activeCampaignRunId) {
            loadCampaignProgress();
          }
        }
      )
      .subscribe();

    // Escutar mudanças nas pesquisas
    const surveyChannel = supabase
      .channel('satisfaction-surveys-progress')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satisfaction_surveys'
        },
        () => {
          if (activeSurveyRunId) {
            loadSurveyProgress();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(runsChannel);
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(surveyChannel);
    };
  }, [activeCampaignRunId, activeSurveyRunId]);

  const loadCounts = async () => {
    // Verificar se há runs ativos de campanha
    const { data: activeCampaignRun } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('status', 'sending')
      .maybeSingle();

    if (activeCampaignRun) {
      setActiveCampaignRunId(activeCampaignRun.id);
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
      await loadSurveyProgress(activeSurveyRun.campaign_id);
    } else {
      setActiveSurveyRunId(null);
      setSurveySent(0);
      setSurveyTotal(0);
    }
  };

  const loadCampaignProgress = async (campaignId?: string) => {
    const targetCampaignId = campaignId || activeCampaignRunId;
    if (!targetCampaignId) return;

    // Contar total de envios planejados
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('sent_count')
      .eq('id', targetCampaignId)
      .single();

    // Contar quantos já foram enviados
    const { count: sentCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', targetCampaignId);

    setCampaignTotal(campaign?.sent_count || 0);
    setCampaignSent(sentCount || 0);
  };

  const loadSurveyProgress = async (campaignId?: string) => {
    const targetCampaignId = campaignId || activeSurveyRunId;
    if (!targetCampaignId) return;

    // Contar total de pesquisas a enviar (baseado em campaign_sends)
    const { count: totalCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', targetCampaignId);

    // Contar quantas pesquisas já foram enviadas
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
