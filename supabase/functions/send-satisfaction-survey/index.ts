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

    // 1. Buscar pesquisas existentes que já foram respondidas (não reenviar)
    const { data: respondedSurveys, error: respondedError } = await supabaseClient
      .from('satisfaction_surveys')
      .select('campaign_send_id')
      .eq('status', 'responded');

    if (respondedError) {
      console.error('Erro ao buscar pesquisas respondidas:', respondedError);
      throw respondedError;
    }

    const respondedSurveyIds = respondedSurveys?.map(s => s.campaign_send_id) || [];
    console.log(`Encontradas ${respondedSurveys?.length || 0} pesquisas respondidas (não reenviar)`);

    // 2. Buscar pesquisas falhadas ou sem resposta há mais de 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: retryableSurveys, error: retryError } = await supabaseClient
      .from('satisfaction_surveys')
      .select('*')
      .or(`status.eq.failed,and(status.eq.sent,sent_at.lt.${thirtyMinutesAgo})`);

    if (retryError) {
      console.error('Erro ao buscar pesquisas para reenvio:', retryError);
      throw retryError;
    }

    console.log(`Encontradas ${retryableSurveys?.length || 0} pesquisas para reenvio (falhadas ou sem resposta há 30+ min)`);

    // 3. Buscar envios elegíveis (status success ou sent) sem pesquisa
    const { data: eligibleSends, error: sendsError } = await supabaseClient
      .from('campaign_sends')
      .select('*')
      .in('status', ['success', 'sent']);

    if (sendsError) {
      console.error('Erro ao buscar envios:', sendsError);
      throw sendsError;
    }

    console.log(`Encontrados ${eligibleSends?.length || 0} envios com status success/sent`);

    // Filtrar envios que não têm pesquisa respondida
    const sendsToProcess = (eligibleSends || []).filter((s) => !respondedSurveyIds.includes(s.id));

    console.log(`Encontrados ${sendsToProcess.length || 0} envios elegíveis (sem pesquisa respondida)`);

    const surveysSent: any[] = [];
    const surveysResent: any[] = [];
    const newSurveys: any[] = [];

    // Processar novos envios
    for (const send of sendsToProcess) {
      // Verificar se já existe pesquisa para este envio
      const { data: existingSurvey } = await supabaseClient
        .from('satisfaction_surveys')
        .select('*')
        .eq('campaign_send_id', send.id)
        .maybeSingle();

      let survey = existingSurvey;

      if (!existingSurvey) {
        // Criar nova pesquisa
        const { data: newSurvey, error: surveyError } = await supabaseClient
          .from('satisfaction_surveys')
          .insert({
            campaign_send_id: send.id,
            customer_phone: send.customer_phone,
            customer_name: send.customer_name,
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .select()
          .single();

        if (surveyError) {
          console.error('Erro ao criar pesquisa:', surveyError);
          continue;
        }
        survey = newSurvey;
        newSurveys.push(survey);
      } else {
        // Atualizar pesquisa existente para reenvio
        const { data: updatedSurvey, error: updateError } = await supabaseClient
          .from('satisfaction_surveys')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', existingSurvey.id)
          .select()
          .single();

        if (updateError) {
          console.error('Erro ao atualizar pesquisa:', updateError);
          continue;
        }
        survey = updatedSurvey;
        surveysResent.push(survey);
      }

      // Enviar mensagem via WhatsApp
      const surveyMessage = `Olá${send.customer_name ? ' ' + send.customer_name : ''}!

De uma nota de 1 a 5 para a entrega de seus produtos.

1️⃣ - Muito insatisfeito
2️⃣ - Insatisfeito  
3️⃣ - Neutro
4️⃣ - Satisfeito
5️⃣ - Muito satisfeito

Responda apenas com o número da sua avaliação.`;

      try {
        const { data: whatsappResponse, error: whatsappError } = await supabaseClient.functions.invoke('whatsapp-send', {
          body: {
            phone: send.customer_phone, // Corrigido: a função espera "phone"
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
        await supabaseClient
          .from('satisfaction_surveys')
          .update({ status: 'failed' })
          .eq('id', survey.id);
      }

      // Delay aleatório entre 5 e 60 segundos entre envios
      const delay = Math.floor(Math.random() * (60000 - 5000 + 1)) + 5000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const totalSent = surveysSent.length;
    const totalNew = newSurveys.length;
    const totalResent = surveysResent.length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        surveys_sent: totalSent,
        new_surveys: totalNew,
        resent_surveys: totalResent,
        message: `${totalSent} pesquisas enviadas (${totalNew} novas, ${totalResent} reenviadas)`
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
