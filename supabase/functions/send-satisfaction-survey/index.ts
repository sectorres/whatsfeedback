import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Sequência progressiva de delays entre mensagens (em segundos)
const DELAY_STAGES = [2, 5, 7, 9, 11, 13, 17];

const getProgressiveDelay = (messageIndex: number): number => {
  const stageIndex = messageIndex % DELAY_STAGES.length;
  return DELAY_STAGES[stageIndex];
};

const surveySendSchema = z.object({
  campaignSendIds: z.array(z.string().uuid()).optional(),
  campaignId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
});

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
    
    // Validate input
    const validationResult = surveySendSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { campaignSendIds, campaignId, runId: providedRunId } = validationResult.data;

    console.log('=== INÍCIO SEND-SATISFACTION-SURVEY ===');
    console.log('campaignSendIds recebidos:', JSON.stringify(campaignSendIds));
    console.log('campaignId recebido:', campaignId || null);
    console.log('Quantidade de IDs:', campaignSendIds?.length || 0);
    console.log('Buscando envios de campanha elegíveis para pesquisa de satisfação...');

    // Usar runId fornecido ou criar um novo
    let runId = providedRunId as string | undefined;
    if (!runId) {
      const { data: runData, error: runError } = await supabaseClient
        .from('survey_send_runs')
        .insert({
          campaign_id: campaignId || null,
          status: 'running'
        })
        .select()
        .single();

      if (runError) {
        console.error('Erro ao criar run:', runError);
        throw runError;
      }

      runId = runData.id;
    }
    console.log(`Run em uso: ${runId}`);

    // Se o payload incluir campaignSendIds mas estiver vazio, NÃO deve enviar para todos
    if (Array.isArray(campaignSendIds) && campaignSendIds.length === 0) {
      console.log('Nenhum envio elegível — recebidos 0 IDs; abortando.');
      return new Response(
        JSON.stringify({ 
          success: false, 
          surveys_sent: 0,
          new_surveys: 0,
          resent_surveys: 0,
          failed_surveys: 0,
          errors: [],
          message: 'Nenhum envio elegível para a campanha selecionada'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Mensagem da pesquisa
    const getSurveyMessage = (customerName?: string) => `Olá${customerName ? ' ' + customerName : ''}!

De uma nota de 1 a 5 para a entrega de seus produtos.

1️⃣ - Muito insatisfeito
2️⃣ - Insatisfeito  
3️⃣ - Neutro
4️⃣ - Satisfeito
5️⃣ - Muito satisfeito

Responda apenas com o número da sua avaliação.`;

    // Função auxiliar para verificar e atualizar motorista via API usando pedido_id
    const checkAndUpdateDriver = async (send: any) => {
      try {
        // Verificar se tem pedido_id
        if (!send.pedido_id) {
          console.log(`⚠️ Pedido sem pedido_id para ${send.customer_phone}`);
          return send;
        }

        console.log(`🔍 Verificando motorista para pedido_id: ${send.pedido_id}`);

        // Consultar API com range de 90 dias
        const dataFinal = new Date();
        const dataInicial = new Date();
        dataInicial.setDate(dataInicial.getDate() - 90);

        const dataInicialFormatada = dataInicial.toISOString().split('T')[0].replace(/-/g, '');
        const dataFinalFormatada = dataFinal.toISOString().split('T')[0].replace(/-/g, '');

        console.log(`Buscando cargas de ${dataInicialFormatada} até ${dataFinalFormatada}`);

        const { data: apiData, error: apiError } = await supabaseClient.functions.invoke('fetch-cargas', {
          body: {
            dataInicial: dataInicialFormatada,
            dataFinal: dataFinalFormatada
          }
        });

        if (apiError) {
          console.error('❌ Erro ao consultar API:', apiError);
          return send;
        }

        const totalCargas = apiData?.retorno?.cargas?.length || 0;
        console.log(`API retornou ${totalCargas} cargas`);

        // Procurar o pedido específico pelo ID
        let pedidoEncontrado = null;
        let motoristaAtual = null;
        let cargaId = null;

        if (apiData?.retorno?.cargas) {
          for (const carga of apiData.retorno.cargas) {
            if (carga.pedidos && Array.isArray(carga.pedidos)) {
              const pedido = carga.pedidos.find((p: any) => p.id === send.pedido_id);
              
              if (pedido) {
                pedidoEncontrado = pedido;
                motoristaAtual = carga.nomeMotorista;
                cargaId = carga.id;
                console.log(`✅ Pedido ${send.pedido_id} encontrado na carga ${cargaId}`);
                console.log(`   Motorista na API: "${motoristaAtual}"`);
                console.log(`   Motorista no registro: "${send.driver_name}"`);
                break;
              }
            }
          }
        }

        // Se encontrou o pedido e o motorista mudou, atualizar
        if (pedidoEncontrado && motoristaAtual && motoristaAtual !== send.driver_name) {
          console.log(`🔄 Atualizando motorista de "${send.driver_name}" para "${motoristaAtual}"`);
          
          const { error: updateError } = await supabaseClient
            .from('campaign_sends')
            .update({ driver_name: motoristaAtual })
            .eq('id', send.id);

          if (updateError) {
            console.error('❌ Erro ao atualizar motorista:', updateError);
          } else {
            console.log(`✅ Motorista atualizado com sucesso para ${send.customer_phone}`);
            return { ...send, driver_name: motoristaAtual };
          }
        } else if (!pedidoEncontrado) {
          console.log(`❌ Pedido ID ${send.pedido_id} não encontrado após buscar ${totalCargas} cargas`);
        } else if (motoristaAtual === send.driver_name) {
          console.log(`✓ Motorista não mudou (mantém: ${motoristaAtual})`);
        }

        return send;
      } catch (error) {
        console.error('❌ Erro ao verificar motorista:', error);
        return send;
      }
    };

    // Função auxiliar para enviar uma pesquisa
    const sendSingleSurvey = async (send: any) => {
      try {
        // Verificar e atualizar motorista antes de enviar
        const updatedSend = await checkAndUpdateDriver(send);
        
        // Verificar se já existe pesquisa para este envio
        const { data: existingSurvey } = await supabaseClient
          .from('satisfaction_surveys')
          .select('*')
          .eq('campaign_send_id', updatedSend.id)
          .maybeSingle();

        let survey = existingSurvey;
        let isNew = false;

        if (!existingSurvey) {
          // Criar nova pesquisa
          const { data: newSurvey, error: surveyError } = await supabaseClient
            .from('satisfaction_surveys')
            .insert({
              campaign_send_id: updatedSend.id,
              customer_phone: updatedSend.customer_phone,
              customer_name: updatedSend.customer_name,
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
            phone: updatedSend.customer_phone,
            message: getSurveyMessage(updatedSend.customer_name)
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

        console.log(`Pesquisa enviada para ${updatedSend.customer_phone}`);
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
      
      // Verificar se algum desses envios já tem pesquisa enviada, respondida, expirada OU cancelada (bloqueio por campaign_send_id)
      const { data: existingSurveys, error: existingError } = await supabaseClient
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('campaign_send_id', campaignSendIds)
        .in('status', ['sent', 'responded', 'expired', 'cancelled']);

      if (existingError) throw existingError;

      const existingSurveyIds = existingSurveys?.map(s => s.campaign_send_id) || [];
      
      if (existingSurveyIds.length > 0) {
        console.log(`Bloqueando ${existingSurveyIds.length} pesquisas já enviadas, respondidas, expiradas ou canceladas para mesma carga`);
      }

      // Filtrar apenas os IDs que NÃO foram enviados ou respondidos para mesma carga
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
            message: 'Todas as pesquisas selecionadas já foram enviadas, respondidas, expiradas ou removidas'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar dados dos envios permitidos
      console.log('Buscando campaign_sends com IDs permitidos:', allowedIds);
      const { data: selectedSends, error: selectedError } = await supabaseClient
        .from('campaign_sends')
        .select('id, customer_phone, campaign_id, status, customer_name')
        .in('id', allowedIds)
        .in('status', ['success', 'sent']);
      if (selectedError) throw selectedError;
      console.log('campaign_sends encontrados:', selectedSends?.length || 0);
      if (selectedSends && selectedSends.length > 0) {
        const uniqueCampaignIds = [...new Set(selectedSends.map(s => s.campaign_id))];
        console.log('IDs de campanhas nos envios:', uniqueCampaignIds);
      }

      if (!selectedSends || selectedSends.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            surveys_sent: 0,
            new_surveys: 0,
            resent_surveys: 0,
            failed_surveys: 0,
            errors: [],
            message: 'Nenhum envio elegível encontrado'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Janela de segurança: bloquear reenvio para o mesmo telefone nos últimos 5 minutos
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const uniquePhones = Array.from(new Set(selectedSends.map(s => s.customer_phone)));
      let filteredByTimeWindow = selectedSends;
      
      if (uniquePhones.length > 0) {
        const { data: recentSurveys, error: recentErr } = await supabaseClient
          .from('satisfaction_surveys')
          .select('customer_phone')
          .in('customer_phone', uniquePhones)
          .in('status', ['sent', 'responded', 'expired'])
          .gte('sent_at', fiveMinutesAgo);
        
        if (recentErr) throw recentErr;

        const recentPhones = new Set((recentSurveys || []).map(s => s.customer_phone));
        const beforeCount = filteredByTimeWindow.length;
        filteredByTimeWindow = filteredByTimeWindow.filter(s => !recentPhones.has(s.customer_phone));
        
        if (beforeCount > filteredByTimeWindow.length) {
          console.log(`Bloqueados ${beforeCount - filteredByTimeWindow.length} envios por janela de 5 minutos (mesmo telefone)`);
        }
      }

      sendsToProcess = filteredByTimeWindow || [];
    } else {
      // Buscar pesquisas já enviadas, respondidas, expiradas OU canceladas para mesma carga (bloqueio por campaign_send_id)
      const { data: existingSurveys, error: existingError } = await supabaseClient
        .from('satisfaction_surveys')
        .select('campaign_send_id')
        .in('status', ['sent', 'responded', 'expired', 'cancelled']);

      if (existingError) throw existingError;

      const existingSurveyIds = existingSurveys?.map(s => s.campaign_send_id) || [];
      console.log(`Encontradas ${existingSurveys?.length || 0} pesquisas já enviadas, respondidas, expiradas ou canceladas (bloqueio por carga)`);

      // Buscar envios elegíveis (status success ou sent)
      const { data: eligibleSends, error: sendsError } = await supabaseClient
        .from('campaign_sends')
        .select('*')
        .in('status', ['success', 'sent']);

      if (sendsError) throw sendsError;

      console.log(`Encontrados ${eligibleSends?.length || 0} envios com status success/sent`);

      // Filtrar envios que não têm pesquisa enviada/respondida para mesma carga
      let filteredSends = (eligibleSends || []).filter((s) => !existingSurveyIds.includes(s.id));
      // Se campaignId foi enviado, restringir à campanha selecionada
      if (campaignId) {
        const before = filteredSends.length;
        filteredSends = filteredSends.filter((s) => s.campaign_id === campaignId);
        console.log(`Aplicado filtro por campaignId=${campaignId}. Antes: ${before}, depois: ${filteredSends.length}`);
      }

      // Janela de segurança: bloquear reenvio para o mesmo telefone nos últimos 5 minutos
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const uniquePhones = Array.from(new Set(filteredSends.map(s => s.customer_phone)));
      
      if (uniquePhones.length > 0) {
        const { data: recentSurveys, error: recentErr } = await supabaseClient
          .from('satisfaction_surveys')
          .select('customer_phone')
          .in('customer_phone', uniquePhones)
          .in('status', ['sent', 'responded', 'expired'])
          .gte('sent_at', fiveMinutesAgo);
        
        if (recentErr) throw recentErr;

        const recentPhones = new Set((recentSurveys || []).map(s => s.customer_phone));
        const beforeCount = filteredSends.length;
        filteredSends = filteredSends.filter(s => !recentPhones.has(s.customer_phone));
        
        if (beforeCount > filteredSends.length) {
          console.log(`Bloqueados ${beforeCount - filteredSends.length} envios por janela de 5 minutos (mesmo telefone)`);
        }
      }

      sendsToProcess = filteredSends;
      console.log(`Encontrados ${sendsToProcess.length || 0} envios elegíveis após filtros`);
    }

    const results = {
      sent: 0,
      new: 0,
      resent: 0,
      failed: 0,
      errors: [] as any[]
    };

    // Processar envios com delay, verificando cancelamento
    for (let i = 0; i < sendsToProcess.length; i++) {
      // Verificar se o run foi cancelado
      const { data: currentRun } = await supabaseClient
        .from('survey_send_runs')
        .select('status')
        .eq('id', runId)
        .single();

      if (currentRun?.status === 'cancelled') {
        console.log(`Run ${runId} foi cancelado - abortando envios`);
        
        // Atualizar status final
        await supabaseClient
          .from('survey_send_runs')
          .update({ status: 'cancelled' })
          .eq('id', runId);

        return new Response(
          JSON.stringify({ 
            success: false, 
            cancelled: true,
            surveys_sent: results.sent,
            new_surveys: results.new,
            resent_surveys: results.resent,
            failed_surveys: results.failed,
            message: `Envio cancelado após ${results.sent} pesquisas enviadas`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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

      // Delay progressivo: 2s → 5s → 7s → 9s → 11s → 13s → 17s
      if (i < sendsToProcess.length - 1) {
        const delaySeconds = getProgressiveDelay(i);
        console.log(`Aguardando ${delaySeconds} segundos antes do próximo envio...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // Marcar run como completo
    await supabaseClient
      .from('survey_send_runs')
      .update({ status: 'completed' })
      .eq('id', runId);

    return new Response(
      JSON.stringify({ 
        success: true,
        runId: runId,
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
