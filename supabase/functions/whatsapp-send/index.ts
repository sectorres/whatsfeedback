import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatPhoneForWhatsApp } from "../_shared/phone-utils.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, message } = await req.json();
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      throw new Error('Evolution API credentials not configured');
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }

    console.log('Sending WhatsApp message:', { phone, messageLength: message.length });

    // Normalizar e formatar número de telefone
    const cleanPhone = formatPhoneForWhatsApp(phone);
    console.log('Normalized phone:', cleanPhone);

    // Validar se o número tem o tamanho mínimo esperado (DDD + número)
    // Formato esperado: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos
    if (cleanPhone.length < 12 || cleanPhone.length > 13) {
      console.error('Invalid phone number length:', { original: phone, cleaned: cleanPhone, length: cleanPhone.length });
      throw new Error('Telefone inválido: formato incorreto ou dígitos faltando');
    }

    // Verificar blacklist antes de enviar
    const blacklistResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/blacklist?phone=eq.${cleanPhone}`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (blacklistResponse.ok) {
      const blacklistData = await blacklistResponse.json();
      if (blacklistData && blacklistData.length > 0) {
        console.log('Phone is blacklisted:', cleanPhone);
        throw new Error('Número bloqueado pela blacklist');
      }
    }
    
    // Send message via Evolution API
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message,
        })
      }
    );

    const data = await response.json();
    console.log('Send message response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send message');
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in whatsapp-send:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
