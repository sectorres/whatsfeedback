import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting finalize pending surveys job...');

    // Buscar pesquisas que estão aguardando feedback há mais de 24 horas
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data: pendingSurveys, error: fetchError } = await supabase
      .from('satisfaction_surveys')
      .select('*')
      .eq('status', 'awaiting_feedback')
      .lt('responded_at', twentyFourHoursAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching pending surveys:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingSurveys?.length || 0} surveys to finalize`);

    if (pendingSurveys && pendingSurveys.length > 0) {
      // Atualizar status para 'responded' (finalizado sem feedback)
      const surveyIds = pendingSurveys.map(s => s.id);
      
      const { error: updateError } = await supabase
        .from('satisfaction_surveys')
        .update({ status: 'responded' })
        .in('id', surveyIds);

      if (updateError) {
        console.error('Error updating surveys:', updateError);
        throw updateError;
      }

      console.log(`Successfully finalized ${surveyIds.length} surveys`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        finalized: pendingSurveys?.length || 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in finalize pending surveys:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
