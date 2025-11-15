import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const campaignSendSchema = z.object({
  campaignId: z.string().uuid(),
  customerPhone: z.string().min(10).max(20),
  message: z.string().min(1).max(4096),
  customerName: z.string().max(255).nullish(),
  driverName: z.string().max(255).nullish(),
  quantidade_entregas: z.number().min(0).max(10000).transform(val => Math.round(val)).nullish(),
  quantidade_skus: z.number().min(0).max(10000).transform(val => Math.round(val)).nullish(),
  quantidade_itens: z.number().min(0).max(100000).transform(val => Math.round(val)).nullish(),
  peso_total: z.number().min(0).max(1000000).nullish(),
  valor_total: z.number().min(0).max(10000000).nullish(),
  pedido_id: z.number().int().positive().nullish(),
  pedido_numero: z.string().max(50).nullish(),
  carga_id: z.number().int().positive().nullish(),
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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Backend credentials not configured');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json();
    
    // Validate input
    const validationResult = campaignSendSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      campaignId,
      customerName,
      customerPhone,
      message,
      driverName,
      peso_total,
      valor_total,
      quantidade_entregas,
      quantidade_skus,
      quantidade_itens,
      pedido_id,
      pedido_numero,
      carga_id,
    } = validationResult.data;


    if (!campaignId || !customerPhone || !message) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios ausentes (campaignId, customerPhone, message)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone para garantir formato consistente
    const normalizedPhone = normalizePhone(customerPhone);

    console.log('campaign-send: prepared insert', {
      campaignId,
      customerPhone,
      normalizedPhone,
      quantidade_entregas,
      quantidade_skus,
      quantidade_itens,
      peso_total,
      valor_total,
    });

    // 1) Inserir registro como pending
    const { data: sendRow, error: insertError } = await supabase
      .from('campaign_sends')
      .insert({
        campaign_id: campaignId,
        customer_name: customerName ?? 'Cliente',
        customer_phone: normalizedPhone,
        message_sent: message,
        status: 'pending',
        driver_name: driverName ?? null,
        peso_total: peso_total ?? 0,
        valor_total: valor_total ?? 0,
        quantidade_entregas: quantidade_entregas ?? 1,
        quantidade_skus: quantidade_skus ?? 0,
        quantidade_itens: quantidade_itens ?? 0,
        pedido_id: pedido_id ?? null,
        pedido_numero: pedido_numero ?? null,
        carga_id: carga_id ?? null,
      })
      .select()
      .single();

    if (insertError || !sendRow) {
      throw insertError || new Error('Falha ao criar registro de envio');
    }

    // 2) Disparar WhatsApp via função dedicada (reaproveita normalização e blacklist)
    const { error: sendError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        phone: normalizedPhone,
        message,
      },
    });

    if (sendError) {
      // 3a) Atualizar para failed
      await supabase
        .from('campaign_sends')
        .update({ status: 'failed', error_message: sendError.message || String(sendError) })
        .eq('id', sendRow.id);

      return new Response(
        JSON.stringify({ success: false, send_id: sendRow.id, status: 'failed', error: sendError.message || String(sendError) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3b) Atualizar para success
    await supabase
      .from('campaign_sends')
      .update({ status: 'success', error_message: null, sent_at: new Date().toISOString() })
      .eq('id', sendRow.id);

    // 3c) Enviar mensagem de confirmação
    try {
      await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: normalizedPhone,
          message: `Por favor, confirme se poderá receber sua mercadoria:\n\n1️⃣ - Confirmado\n2️⃣ - Reagendar\n3️⃣ - Não é meu número`,
        },
      });
      console.log('Confirmation message sent successfully');
    } catch (confirmError) {
      console.error('Error sending confirmation message:', confirmError);
      // Não bloqueia o fluxo se falhar
    }

    // 4) Registrar no chat de atendimento
    try {
      // Buscar ou criar conversa
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_phone', normalizedPhone)
        .maybeSingle();

      let conversationId = existingConv?.id;

      if (!existingConv) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            customer_phone: normalizedPhone,
            customer_name: customerName ?? 'Cliente',
            status: 'active',
            last_message_at: new Date().toISOString()
          })
          .select()
          .single();
        
        conversationId = newConv?.id;
      } else {
        // Atualizar última mensagem
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', existingConv.id);
      }

      // Criar mensagem no chat
      if (conversationId) {
        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            sender_type: 'operator',
            sender_name: 'Sistema - Campanha',
            message_text: message,
            message_status: 'sent'
          });
      }
    } catch (chatError) {
      console.error('Erro ao registrar no chat:', chatError);
      // Não bloqueia o envio se falhar o registro no chat
    }

    return new Response(
      JSON.stringify({ success: true, send_id: sendRow.id, status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em campaign-send:', error);
    const message = (error && typeof error === 'object' && 'message' in (error as any))
      ? (error as any).message
      : (error instanceof Error ? error.message : 'Erro desconhecido');
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});