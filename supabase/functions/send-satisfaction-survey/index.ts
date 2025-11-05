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

    // Aceitar envio individual ou em lote
    const body = await req.json().catch(() => ({}));
    const campaignSendIds = body.campaignSendIds as string[] | undefined;

    console.log('Buscando envios de campanha elegíveis para pesquisa de satisfação...');
    
    // Mensagem da pesquisa
    const getSurveyMessage = (customerName?: string) => `Olá${customerName ? ' ' + customerName : ''}!

De uma nota de 1 a 5 para a entrega de seus produtos.

1️⃣ - Muito insatisfeito
2️⃣ - Insatisfeito  
3️⃣ - Neutro
4️⃣ - Satisfeito
5️⃣ - Muito satisfeito

Responda apenas com o número da sua avaliação.`;

    // Função auxiliar para enviar uma pesquisa
    const sendSingleSurvey = async (send: any) => {
      try {
        // Verificar se já existe pesquisa para este envio
        const { data: existingSurvey } = await supabaseClient
          .from('satisfaction_surveys')
          .select('*')
          .eq('campaign_send_id', send.id)
          .maybeSingle();

        let survey = existingSurvey;
        let isNew = false;

        if (!existingSurvey) {
          // Criar nova pesquisa
          const { data: newSurvey, error: surveyError } = await supabaseClient
            .from('satisfaction_surveys')
            .insert({
              campaign_send_id: send.id,
              customer_phone: send.customer_phone,
              customer_name: send.customer_name,
              status: 'pending',
              sent_at: new Date().toISOString()
            })
            .select()
            .single();

          if (surveyError) throw surveyError;
          survey = newSurvey;
          isNew = true;
        } else {
          // Atualizar pesquisa existente para reenvio
          const { data: updatedSurvey, error: updateError } = await supabaseClient
            .from('satisfaction_surveys')
            .update({ 
              status: 'pending',
              sent_at: new Date().toISOString()
            })
            .eq('id', existingSurvey.id)
            .select()
            .single();

          if (updateError) throw updateError;
          survey = updatedSurvey;
        }

        // Enviar mensagem via WhatsApp
        const { error: whatsappError } = await supabaseClient.functions.invoke('whatsapp-send', {
          body: {
            phone: send.customer_phone,
            message: getSurveyMessage(send.customer_name)
          }
        });

        if (whatsappError) {
          await supabaseClient
            .from('satisfaction_surveys')
            .update({ status: 'failed' })
            .eq('id', survey.id);
          throw whatsappError;
        }

        // Atualizar status para enviado
        await supabaseClient
          .from('satisfaction_surveys')
          .update({ status: 'sent' })
          .eq('id', survey.id);

        console.log(`Pesquisa enviada para ${send.customer_phone}`);
        return { success: true, isNew, survey };
      } catch (error) {
        console.error(`Erro ao enviar pesquisa para ${send.customer_phone}:`, error);
        return { success: false, error, send };
      }
    };

    let sendsToProcess: any[] = [];

    // Se foram especificados IDs, buscar apenas esses envios
    if (campaignSendIds && campaignSendIds.length > 0) {
      console.log(`Processando ${campaignSendIds.length} envios específicos`);
      
      // Primeiro, verificar se algum desses envios já tem pesquisa enviada ou respondida
      const { data: existingSurveys, error: existingError } = await supabaseClient
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('campaign_send_id', campaignSendIds)
        .in('status', ['sent', 'responded']);

      if (existingError) throw existingError;

      const existingSurveyIds = existingSurveys?.map(s => s.campaign_send_id) || [];
      
      if (existingSurveyIds.length > 0) {
        console.log(`Bloqueando ${existingSurveyIds.length} pesquisas já enviadas ou respondidas`);
      }

      // Filtrar apenas os IDs que NÃO foram enviados ou respondidos
      const allowedIds = campaignSendIds.filter(id => !existingSurveyIds.includes(id));

      if (allowedIds.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            surveys_sent: 0,
            new_surveys: 0,
            resent_surveys: 0,
            failed_surveys: 0,
            errors: [],
            message: 'Todas as pesquisas selecionadas já foram enviadas ou respondidas'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: specificSends, error: sendsError } = await supabaseClient
        .from('campaign_sends')
        .select('*')
        .in('id', allowedIds)
        .in('status', ['success', 'sent']);

      if (sendsError) throw sendsError;
      sendsToProcess = specificSends || [];
    } else {
      // Buscar pesquisas já enviadas ou respondidas (não reenviar)
      const { data: existingSurveys, error: existingError } = await supabaseClient
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('status', ['sent', 'responded']);

      if (existingError) throw existingError;

      const existingSurveyIds = existingSurveys?.map(s => s.campaign_send_id) || [];
      console.log(`Encontradas ${existingSurveys?.length || 0} pesquisas já enviadas ou respondidas (não reenviar)`);

      // Buscar envios elegíveis (status success ou sent) sem pesquisa
      const { data: eligibleSends, error: sendsError } = await supabaseClient
        .from('campaign_sends')
        .select('*')
        .in('status', ['success', 'sent']);

      if (sendsError) throw sendsError;

      console.log(`Encontrados ${eligibleSends?.length || 0} envios com status success/sent`);

      // Filtrar envios que não têm pesquisa enviada ou respondida
      sendsToProcess = (eligibleSends || []).filter((s) => !existingSurveyIds.includes(s.id));
      console.log(`Encontrados ${sendsToProcess.length || 0} envios elegíveis (sem pesquisa enviada ou respondida)`);
    }

    const results = {
      sent: 0,
      new: 0,
      resent: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Processar envios com delay
    for (let i = 0; i < sendsToProcess.length; i++) {
      const result = await sendSingleSurvey(sendsToProcess[i]);
      
      if (result.success) {
        results.sent++;
        if (result.isNew) {
          results.new++;
        } else {
          results.resent++;
        }
      } else {
        results.failed++;
        results.errors.push({
          phone: result.send?.customer_phone,
          error: result.error instanceof Error ? result.error.message : 'Erro desconhecido'
        });
      }

      // Delay fixo de 10 segundos entre envios
      if (i < sendsToProcess.length - 1) {
        console.log('Aguardando 10 segundos antes do próximo envio...');
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        surveys_sent: results.sent,
        new_surveys: results.new,
        resent_surveys: results.resent,
        failed_surveys: results.failed,
        errors: results.errors,
        message: `${results.sent} pesquisas enviadas (${results.new} novas, ${results.resent} reenviadas, ${results.failed} falhas)`
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
