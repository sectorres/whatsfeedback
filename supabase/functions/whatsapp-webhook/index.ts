import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone, comparePhones } from "../_shared/phone-utils.ts";

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

        // Extrair telefone (suporta diferentes estruturas)
        const remoteJid = msg.key?.remoteJid || msg.remoteJid || msg.from || '';
        const rawPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        const customerPhone = normalizePhone(rawPhone);
        
        console.log('Raw phone from webhook:', rawPhone, '-> Normalized:', customerPhone);

        // Extrair texto da mensagem
        const messageText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          msg.body?.text ||
          msg.body ||
          '[Mídia recebida]';

        // Extrair nome do remetente
        const customerName = msg.pushName || msg.senderName || customerPhone;

        console.log(`Processing message from ${customerPhone}: ${messageText}`);

        // Verificar se é uma resposta a pesquisa de satisfação (número de 1 a 5)
        const ratingMatch = messageText.trim().match(/^[1-5]$/);
        if (ratingMatch) {
          const rating = parseInt(ratingMatch[0]);
          
          console.log(`Detected rating ${rating} from ${customerPhone} (remoteJid: ${remoteJid})`);
          
          // Buscar pesquisa pendente para este telefone
          const { data: surveys, error: surveyError } = await supabase
            .from('satisfaction_surveys')
            .select('*')
            .eq('status', 'sent')
            .is('rating', null)
            .order('sent_at', { ascending: false });

          console.log(`Found ${surveys?.length || 0} pending surveys`);

          // Encontrar a pesquisa que corresponde ao telefone usando comparação normalizada
          const pendingSurvey = surveys?.find(s => {
            const match = comparePhones(s.customer_phone || '', customerPhone);
            console.log(`Comparing DB phone: ${s.customer_phone} with remote: ${customerPhone} -> ${match ? 'MATCH' : 'NO MATCH'}`);
            return match;
          });

          console.log(`Pending survey found:`, pendingSurvey ? `ID ${pendingSurvey.id}` : 'None');

          if (pendingSurvey) {
            console.log(`Updating survey ${pendingSurvey.id} with rating ${rating}`);
            
            // Atualizar a pesquisa com a nota
            const { error: updateError } = await supabase
              .from('satisfaction_surveys')
              .update({
                rating: rating,
                status: 'responded',
                responded_at: new Date().toISOString()
              })
              .eq('id', pendingSurvey.id);

            if (updateError) {
              console.error('Error updating survey:', updateError);
            } else {
              console.log(`Survey response recorded: ${customerPhone} rated ${rating}`);
              
              // Enviar mensagem de agradecimento
              try {
                await supabase.functions.invoke('whatsapp-send', {
                  body: {
                    phone: customerPhone,
                    message: `Obrigado pela sua avaliação! Sua opinião é muito importante para nós. 🙏`
                  }
                });
              } catch (thankError) {
                console.error('Error sending thank you message:', thankError);
              }
            }
          } else {
            console.log(`No pending survey found for ${customerPhone}`);
          }
        }

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
              unread_count: 1
            })
            .select()
            .single();

          if (convError) {
            console.error('Error creating conversation:', convError);
            continue;
          }
          conversation = newConv;
        } else {
          // Atualizar última mensagem e incrementar contador de não lidas
          const { data: currentConv } = await supabase
            .from('conversations')
            .select('unread_count')
            .eq('id', conversation.id)
            .single();

          await supabase
            .from('conversations')
            .update({
              last_message_at: new Date().toISOString(),
              status: 'active',
              unread_count: (currentConv?.unread_count || 0) + 1
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