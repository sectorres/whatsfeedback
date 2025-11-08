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
        // Primeiro tentar o remoteJid limpo
        let remoteJid = msg.key?.remoteJid || msg.remoteJid || msg.from || '';
        remoteJid = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
        
        // Se o remoteJid não parece um número de telefone válido (muito curto/longo ou não numérico)
        // tentar extrair do pushName, participant ou outros campos
        let rawPhone = remoteJid;
        
        // Validar se parece um número de telefone brasileiro válido (10-13 dígitos após normalização)
        const digitsOnly = rawPhone.replace(/\D/g, '');
        
        // Se não for um número válido (muito curto, muito longo, ou parece CPF/CNPJ), pular mensagem
        if (!digitsOnly || digitsOnly.length < 10 || digitsOnly.length > 15) {
          console.log(`Skipping message with invalid phone: ${rawPhone} (${digitsOnly?.length || 0} digits)`);
          continue;
        }
        
        const customerPhone = normalizePhone(rawPhone);
        
        // Validação final: se o telefone normalizado estiver vazio ou for inválido, pular mensagem
        if (!customerPhone || customerPhone.length < 10 || customerPhone.length > 13) {
          console.log(`Skipping message with invalid normalized phone: ${customerPhone} from raw: ${rawPhone}`);
          continue;
        }
        
        console.log('Raw phone from webhook:', rawPhone, '-> Normalized:', customerPhone);

        // Detectar tipo de mídia e URL
        let mediaType = 'text';
        let mediaUrl = null;

        // Verificar tipos de mídia
        if (msg.message?.audioMessage) {
          mediaType = 'audio';
          mediaUrl = msg.message.audioMessage.url;
          console.log('Audio detected:', mediaUrl);
        } else if (msg.message?.imageMessage) {
          mediaType = 'image';
          mediaUrl = msg.message.imageMessage.url;
          console.log('Image detected:', mediaUrl);
        } else if (msg.message?.videoMessage) {
          mediaType = 'video';
          mediaUrl = msg.message.videoMessage.url;
          console.log('Video detected:', mediaUrl);
        } else if (msg.message?.documentMessage) {
          mediaType = 'document';
          mediaUrl = msg.message.documentMessage.url;
          console.log('Document detected:', mediaUrl);
        }

        // Extrair texto da mensagem
        let messageText = '';
        if (mediaType === 'image') {
          const caption = msg.message?.imageMessage?.caption || '';
          messageText = caption || '[Imagem]';
        } else if (mediaType === 'audio') {
          messageText = '[Áudio]';
        } else if (mediaType === 'video') {
          messageText = msg.message?.videoMessage?.caption || '[Vídeo]';
        } else if (mediaType === 'document') {
          const fileName = msg.message?.documentMessage?.fileName || 'documento';
          messageText = msg.message?.documentMessage?.caption || fileName;
        } else {
          messageText =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.body?.text ||
            msg.body ||
            '';
        }

        // Extrair nome do remetente
        const customerName = msg.pushName || msg.senderName || customerPhone;

        console.log(`Processing message from ${customerPhone}: ${messageText}`);

        // Verificar se há pesquisa pendente para este cliente
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

        // Se há pesquisa pendente, validar se é uma nota de 1 a 5
        let isSurveyRatingOnly = false;
        
        if (pendingSurvey) {
          const ratingMatch = messageText.trim().match(/^[1-5]$/);
          
          if (ratingMatch) {
            const rating = parseInt(ratingMatch[0]);
            
            console.log(`Detected rating ${rating} from ${customerPhone} (remoteJid: ${remoteJid})`);
            console.log(`Updating survey ${pendingSurvey.id} with rating ${rating}`);
            
            // Marcar que é apenas nota de pesquisa (não deve criar conversa)
            isSurveyRatingOnly = true;
            
            // Atualizar a pesquisa com a nota e marcar como aguardando feedback
            const { error: updateError } = await supabase
              .from('satisfaction_surveys')
              .update({
                rating: rating,
                status: 'awaiting_feedback',
                responded_at: new Date().toISOString()
              })
              .eq('id', pendingSurvey.id);

            if (updateError) {
              console.error('Error updating survey:', updateError);
            } else {
              console.log(`Survey rating recorded: ${customerPhone} rated ${rating}`);
              
              // Pedir feedback opcional
              try {
                await supabase.functions.invoke('whatsapp-send', {
                  body: {
                    phone: customerPhone,
                    message: `Obrigado pela sua nota! 🙏\n\nGostaria de deixar uma avaliação ou comentário adicional? Se sim, por favor escreva abaixo. Caso contrário, pode ignorar esta mensagem.`
                  }
                });
              } catch (feedbackError) {
                console.error('Error sending feedback request:', feedbackError);
              }
            }
            
            // Pular criação de conversa/mensagem quando for apenas nota
            continue;
          } else {
            // Mensagem não é uma nota válida, informar o cliente
            console.log(`Invalid rating received from ${customerPhone}: "${messageText}"`);
            try {
              await supabase.functions.invoke('whatsapp-send', {
                body: {
                  phone: customerPhone,
                  message: `Por favor, responda apenas com um número de 1 a 5 para avaliar sua entrega:\n\n1️⃣ - Muito insatisfeito\n2️⃣ - Insatisfeito\n3️⃣ - Neutro\n4️⃣ - Satisfeito\n5️⃣ - Muito satisfeito`
                }
              });
            } catch (sendError) {
              console.error('Error sending invalid rating message:', sendError);
            }
            
            // Pular criação de conversa quando for resposta inválida à pesquisa
            continue;
          }
        }

        // Verificar se é um feedback para pesquisa que já tem nota
        let isSurveyFeedback = false;
        const { data: surveyAwaitingFeedback } = await supabase
          .from('satisfaction_surveys')
          .select('*')
          .eq('status', 'awaiting_feedback')
          .order('responded_at', { ascending: false })
          .limit(100);

        const feedbackSurvey = surveyAwaitingFeedback?.find(s => 
          comparePhones(s.customer_phone || '', customerPhone)
        );

        // Verificar se não é uma nota (1-5) antes de processar como feedback
        const isRating = messageText.trim().match(/^[1-5]$/);

        if (feedbackSurvey && !isRating) {
          console.log(`Processing feedback for survey ${feedbackSurvey.id}`);
          isSurveyFeedback = true;
          
          // Atualizar com o feedback
          const { error: feedbackError } = await supabase
            .from('satisfaction_surveys')
            .update({
              feedback: messageText,
              status: 'responded'
            })
            .eq('id', feedbackSurvey.id);

          if (!feedbackError) {
            console.log(`Feedback recorded for survey ${feedbackSurvey.id}`);
            
            // Agradecer pelo feedback
            try {
              await supabase.functions.invoke('whatsapp-send', {
                body: {
                  phone: customerPhone,
                  message: `Muito obrigado pela sua avaliação! Sua opinião é muito importante para nós. 🙏✨`
                }
              });
            } catch (thankError) {
              console.error('Error sending thank you message:', thankError);
            }
          }
          
          // Pular criação de conversa quando for feedback de pesquisa
          continue;
        }
        
        
        // Apenas criar conversa se NÃO for nota de pesquisa
        if (!isSurveyRatingOnly) {

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

          // Tentar baixar e armazenar mídia (quando houver)
          let finalMediaUrl = mediaUrl;
          if (mediaType !== 'text' && mediaUrl) {
            try {
              const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
              const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
              const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');
              if (EVOLUTION_API_URL && EVOLUTION_API_KEY && EVOLUTION_INSTANCE_NAME) {
                // Tentativas de endpoints conhecidos para obter a mídia como base64
                let evoResp: Response | null = null;
                // Tentativa 1: downloadMediaMessage com a mensagem completa
                try {
                  evoResp = await fetch(`${EVOLUTION_API_URL}/message/downloadMediaMessage/${EVOLUTION_INSTANCE_NAME}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                    body: JSON.stringify({ message: msg })
                  });
                } catch (_) {}

                if (!evoResp || !evoResp.ok) {
                  // Tentativa 2: getBase64FromMediaMessage
                  try {
                    evoResp = await fetch(`${EVOLUTION_API_URL}/chat/getBase64FromMediaMessage/${EVOLUTION_INSTANCE_NAME}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
                      body: JSON.stringify({ message: msg })
                    });
                  } catch (_) {}
                }

                if (evoResp && evoResp.ok) {
                  const evoData = await evoResp.json();
                  // Normaliza possíveis formatos: {base64, mimetype} ou {mimetype, data: 'data:<mimetype>;base64,<...>'}
                  let base64Data = '';
                  let mime = '';
                  if (evoData?.base64 && evoData?.mimetype) {
                    base64Data = evoData.base64;
                    mime = evoData.mimetype;
                  } else if (typeof evoData?.data === 'string') {
                    const dataUrl: string = evoData.data;
                    const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
                    if (match) {
                      mime = match[1];
                      base64Data = match[2];
                    }
                  }
                  if (base64Data && mime) {
                    // Upload para bucket público
                    const bytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                    const ext = mime.split('/')[1] || 'bin';
                    const filePath = `incoming/${Date.now()}_${msg.key?.id || crypto.randomUUID()}.${ext}`;
                    const uploadRes = await supabase.storage.from('whatsapp-media').upload(filePath, bytes, {
                      contentType: mime,
                      upsert: true
                    });
                    if (!uploadRes.error) {
                      const pub = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);
                      finalMediaUrl = pub.data.publicUrl;
                      console.log('Media stored to bucket:', finalMediaUrl);
                    } else {
                      console.error('Upload error:', uploadRes.error);
                    }
                  } else {
                    console.error('Evolution download returned no base64/mimetype');
                  }
                } else {
                  try {
                    const txt = await evoResp?.text();
                    console.error('Evolution download failed', evoResp?.status, txt);
                  } catch (_) {
                    console.error('Evolution download failed with unknown error');
                  }
                }
              } else {
                console.warn('Evolution API env vars not set; skipping media download');
              }
            } catch (err) {
              console.error('Error downloading media via Evolution:', err);
            }
          }

          // Inserir mensagem com dados de mídia
          const { error: msgError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              sender_type: 'customer',
              sender_name: customerName,
              message_text: messageText,
              message_status: 'received',
              media_type: mediaType,
              media_url: finalMediaUrl
            });

          if (msgError) {
            console.error('Error inserting message:', msgError);
          } else {
            console.log('Message inserted successfully with media:', { mediaType, mediaUrl });
          }
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