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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Buscando pesquisas pendentes há mais de 48 horas...');
    
    // Calcular 48 horas atrás
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Buscar pesquisas enviadas há mais de 48 horas que ainda não foram respondidas
    const { data: expiredSurveys, error: fetchError } = await supabaseClient
      .from('satisfaction_surveys')
      .select('*')
      .in('status', ['sent', 'pending'])
      .lte('sent_at', fortyEightHoursAgo);

    if (fetchError) throw fetchError;

    console.log(`Encontradas ${expiredSurveys?.length || 0} pesquisas para expirar`);

    if (!expiredSurveys || expiredSurveys.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          expired_count: 0,
          message: 'Nenhuma pesquisa para expirar'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar status para expirado
    const { error: updateError } = await supabaseClient
      .from('satisfaction_surveys')
      .update({ status: 'expired' })
      .in('id', expiredSurveys.map(s => s.id));

    if (updateError) throw updateError;

    console.log(`${expiredSurveys.length} pesquisas marcadas como expiradas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired_count: expiredSurveys.length,
        message: `${expiredSurveys.length} pesquisas expiradas`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro ao expirar pesquisas:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
