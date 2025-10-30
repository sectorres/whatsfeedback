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

    const payload = await req.json();
    console.log('Webhook received:', JSON.stringify(payload, null, 2));

    // Detectar evento (corpo ou sufixo da URL quando "Webhook by Event" estiver ativo)
    const url = new URL(req.url);
    const pathEvent = url.pathname.split('/').pop()?.toLowerCase();
    const rawEvent = (payload?.event || pathEvent || '').toLowerCase();
    const isMessageEvent = rawEvent.includes('message') && rawEvent.includes('upsert');

    // Normalizar estrutura de mensagens
    let incoming: any[] = [];
    
    // Caso 1: payload.data.messages (array)
    if (Array.isArray(payload?.data?.messages)) {
      incoming = payload.data.messages;
    }
    // Caso 2: payload.data é a mensagem direta (Evolution com webhook by events)
    else if (payload?.data?.key && payload?.data?.message) {
      incoming = [payload.data];
    }
    // Caso 3: payload.messages (array)
    else if (Array.isArray(payload?.messages)) {
      incoming = payload.messages;
    }
    // Caso 4: payload.data.message (objeto único)
    else if (payload?.data?.message) {
      incoming = [payload.data];
    }

    console.log('Parsed event:', rawEvent, 'messages count:', incoming.length);

    if (!isMessageEvent && incoming.length === 0) {
      // Ignorar eventos não relacionados a mensagens
      return new Response(
        JSON.stringify({ success: true, ignored: rawEvent || 'no-event' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const msg of incoming) {
      try {
        // Ignorar mensagens enviadas pelo próprio bot
        if (msg.key?.fromMe) continue;

        const remoteJid = msg.key?.remoteJid || msg.remoteJid || msg.from || '';
        const customerPhone = (remoteJid || '').replace('@s.whatsapp.net', '').replace('@g.us', '');

        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.body?.text ||
          msg.body ||
          '[Mídia recebida]';

        const customerName = msg.pushName || msg.senderName || customerPhone;

        console.log(`Processing message from ${customerPhone}: ${messageText}`);

        // Buscar ou criar conversa
        let { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('customer_phone', customerPhone)
          .maybeSingle();

        if (!conversation) {
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({
              customer_phone: customerPhone,
              customer_name: customerName,
              status: 'active',
              last_message_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
            continue;
          }
          conversation = newConv;
        } else {
          // Atualizar última mensagem
          await supabase
            .from('conversations')
            .update({
              last_message_at: new Date().toISOString(),
              status: 'active',
            })
            .eq('id', conversation.id);
        }

        // Inserir mensagem
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            sender_type: 'customer',
            sender_name: customerName,
            message_text: messageText,
            message_status: 'received',
          });

        if (msgError) {
          console.error('Error inserting message:', msgError);
        }
      } catch (err) {
        console.error('Error processing single message:', err);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
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