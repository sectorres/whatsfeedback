import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone-utils.ts";

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
    } = body || {};

    if (!campaignId || !customerPhone || !message) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios ausentes (campaignId, customerPhone, message)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalizar telefone para garantir formato consistente
    const normalizedPhone = normalizePhone(customerPhone);

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

    return new Response(
      JSON.stringify({ success: true, send_id: sendRow.id, status: 'success' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro em campaign-send:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});