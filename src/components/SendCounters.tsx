import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SendCounters() {
  const [campaignCount, setCampaignCount] = useState(0);
  const [surveyCount, setSurveyCount] = useState(0);

  useEffect(() => {
    loadCounts();

    const campaignChannel = supabase
      .channel('campaign-sends-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'campaign_sends'
        },
        () => {
          loadCampaignCount();
        }
      )
      .subscribe();

    const surveyChannel = supabase
      .channel('satisfaction-surveys-count')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'satisfaction_surveys'
        },
        () => {
          loadSurveyCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(campaignChannel);
      supabase.removeChannel(surveyChannel);
    };
  }, []);

  const loadCounts = async () => {
    await Promise.all([loadCampaignCount(), loadSurveyCount()]);
  };

  const loadCampaignCount = async () => {
    const { count } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    setCampaignCount(count || 0);
  };

  const loadSurveyCount = async () => {
    const { count } = await supabase
      .from('satisfaction_surveys')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    setSurveyCount(count || 0);
  };

  return (
    <div className="flex items-center gap-4">
      <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
        <Send className="h-4 w-4 text-primary" />
        <div className="flex flex-col items-start">
          <span className="text-xs text-muted-foreground">Campanhas</span>
          <span className="text-sm font-semibold">{campaignCount.toLocaleString()}</span>
        </div>
      </Badge>
      
      <Badge variant="outline" className="flex items-center gap-2 px-3 py-1.5">
        <MessageSquare className="h-4 w-4 text-primary" />
        <div className="flex flex-col items-start">
          <span className="text-xs text-muted-foreground">Pesquisas</span>
          <span className="text-sm font-semibold">{surveyCount.toLocaleString()}</span>
        </div>
      </Badge>
    </div>
  );
}
