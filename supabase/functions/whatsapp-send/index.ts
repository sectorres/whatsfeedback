import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatPhoneForWhatsApp } from "../_shared/phone-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const whatsappSendSchema = z.object({
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4096),
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
    const body = await req.json();
    
    // Validate input
    const validationResult = whatsappSendSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { phone, message } = validationResult.data;
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
      // Verificar se é erro de número não existente
      if (data.response?.message && Array.isArray(data.response.message)) {
        const notFound = data.response.message.find((m: any) => m.exists === false);
        if (notFound) {
          throw new Error(`Número ${notFound.number} não possui WhatsApp ativo`);
        }
      }
      
      // Verificar se é timeout
      if (data.response?.message === 'Timed Out') {
        throw new Error('Timeout ao enviar mensagem. Tente novamente em alguns segundos.');
      }
      
      throw new Error(data.response?.message || data.message || 'Failed to send message');
    }

    // Registrar mensagem no chat de atendimento
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Buscar ou criar conversa
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_phone', cleanPhone)
        .maybeSingle();

      let conversationId = existingConv?.id;

      if (!existingConv) {
        const { data: newConv } = await supabase
          .from('conversations')
          .insert({
            customer_phone: cleanPhone,
            customer_name: 'Cliente',
            status: 'active',
            last_message_at: new Date().toISOString(),
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
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          sender_type: 'operator',
          sender_name: 'Sistema',
          message_text: message,
          message_status: 'sent',
        });
      }
    } catch (chatError) {
      console.error('Erro ao registrar mensagem no chat:', chatError);
      // Não bloqueia o envio se falhar o registro no chat
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
