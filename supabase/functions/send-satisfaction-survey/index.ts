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

    console.log('Buscando envios de campanha elegíveis para pesquisa de satisfação...');

    // Buscar envios de campanha que foram enviados há mais de 1 dia e ainda não têm pesquisa
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Primeiro, buscar IDs que já têm pesquisa
    const { data: existingSurveys, error: existingSurveysError } = await supabaseClient
      .from('satisfaction_surveys')
      .select('campaign_send_id');

    if (existingSurveysError) {
      console.error('Erro ao buscar pesquisas existentes:', existingSurveysError);
      throw existingSurveysError;
    }

    const existingSurveyIds = existingSurveys?.map(s => s.campaign_send_id) || [];

    // Buscar envios elegíveis
    let query = supabaseClient
      .from('campaign_sends')
      .select('*')
      .eq('status', 'sent')
      .lt('sent_at', oneDayAgo.toISOString());

    // Se houver pesquisas existentes, excluir esses IDs
    if (existingSurveyIds.length > 0) {
      query = query.not('id', 'in', `(${existingSurveyIds.join(',')})`);
    }

    const { data: eligibleSends, error: sendsError } = await query;

    if (sendsError) {
      console.error('Erro ao buscar envios:', sendsError);
      throw sendsError;
    }

    console.log(`Encontrados ${eligibleSends?.length || 0} envios elegíveis`);

    const surveysSent = [];

    for (const send of eligibleSends || []) {
      // Criar registro de pesquisa
      const { data: survey, error: surveyError } = await supabaseClient
        .from('satisfaction_surveys')
        .insert({
          campaign_send_id: send.id,
          customer_phone: send.customer_phone,
          customer_name: send.customer_name,
          status: 'sent'
        })
        .select()
        .single();

      if (surveyError) {
        console.error('Erro ao criar pesquisa:', surveyError);
        continue;
      }

      // Enviar mensagem via WhatsApp
      const surveyMessage = `Olá${send.customer_name ? ' ' + send.customer_name : ''}! 

Gostaríamos de saber sua opinião sobre a entrega dos seus produtos.

Por favor, avalie de 1 a 5:
1️⃣ - Muito insatisfeito
2️⃣ - Insatisfeito  
3️⃣ - Neutro
4️⃣ - Satisfeito
5️⃣ - Muito satisfeito

*Responda apenas com o número da sua avaliação.*`;

      try {
        const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('whatsapp-send', {
          body: {
            number: send.customer_phone,
            message: surveyMessage
          }
        });

        if (whatsappError) {
          console.error('Erro ao enviar WhatsApp:', whatsappError);
          await supabaseClient
            .from('satisfaction_surveys')
            .update({ status: 'failed' })
            .eq('id', survey.id);
        } else {
          console.log(`Pesquisa enviada para ${send.customer_phone}`);
          surveysSent.push(survey);
        }
      } catch (error) {
        console.error('Erro no envio WhatsApp:', error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        surveys_sent: surveysSent.length,
        message: `${surveysSent.length} pesquisas enviadas com sucesso`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função send-satisfaction-survey:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});