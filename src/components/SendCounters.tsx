import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SendCounters() {
  const [campaignToday, setCampaignToday] = useState(0);
  const [campaignTotal, setCampaignTotal] = useState(0);
  const [surveyToday, setSurveyToday] = useState(0);
  const [surveyTotal, setSurveyTotal] = useState(0);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: totalCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    const { count: todayCount } = await supabase
      .from('campaign_sends')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    setCampaignTotal(totalCount || 0);
    setCampaignToday(todayCount || 0);
  };

  const loadSurveyCount = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count: totalCount } = await supabase
      .from('satisfaction_surveys')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent');

    const { count: todayCount } = await supabase
      .from('satisfaction_surveys')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', today.toISOString());

    setSurveyTotal(totalCount || 0);
    setSurveyToday(todayCount || 0);
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-0.5">
        <Send className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium">{campaignToday}/{campaignTotal}</span>
      </Badge>
      
      <Badge variant="outline" className="flex items-center gap-1.5 px-2 py-0.5">
        <MessageSquare className="h-3 w-3 text-primary" />
        <span className="text-xs font-medium">{surveyToday}/{surveyTotal}</span>
      </Badge>
    </div>
  );
}
