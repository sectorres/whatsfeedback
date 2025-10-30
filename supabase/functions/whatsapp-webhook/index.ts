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

    // Processar mensagens recebidas do WhatsApp
    if (payload.event === 'messages.upsert' && payload.data?.messages) {
      const messages = payload.data.messages;

      for (const msg of messages) {
        // Ignorar mensagens enviadas por nós
        if (msg.key?.fromMe) continue;

        const customerPhone = msg.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';
        const messageText = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          '[Mídia recebida]';
        const customerName = msg.pushName || customerPhone;

        console.log(`Processing message from ${customerPhone}: ${messageText}`);

        // Buscar ou criar conversa
        let { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('customer_phone', customerPhone)
          .single();

        if (!conversation) {
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({
              customer_phone: customerPhone,
              customer_name: customerName,
              status: 'active',
              last_message_at: new Date().toISOString()
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
              status: 'active'
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
            message_status: 'received'
          });

        if (msgError) {
          console.error('Error inserting message:', msgError);
        }
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