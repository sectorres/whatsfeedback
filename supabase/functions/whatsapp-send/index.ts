import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatPhoneForWhatsApp, normalizePhone } from "../_shared/phone-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const whatsappSendSchema = z.object({
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4096),
  skip_message_save: z.boolean().optional(),
  conversation_id: z.string().optional(),
  replied_to_id: z.string().optional(), // ID da mensagem sendo respondida
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

    const { phone, message, skip_message_save, conversation_id, replied_to_id } = validationResult.data;
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

    console.log('Sending WhatsApp message:', { phone, messageLength: message.length, skipSave: skip_message_save });

    // Normalizar telefone para uso no banco (SEM código do país)
    const normalizedPhone = normalizePhone(phone);
    
    // Formatar número de telefone para WhatsApp (COM código do país)
    const cleanPhone = formatPhoneForWhatsApp(phone);
    console.log('Phones:', { normalized: normalizedPhone, formatted: cleanPhone });

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
    
    // Preparar payload para envio
    const sendPayload: any = {
      number: cleanPhone,
      text: message,
    };

    // Se for uma resposta a outra mensagem, adicionar contexto de quoted
    if (replied_to_id) {
      sendPayload.quoted = {
        key: {
          id: replied_to_id
        }
      };
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
        body: JSON.stringify(sendPayload)
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

    // Buscar nome real do contato no WhatsApp
    let realContactName = 'Cliente';
    try {
      console.log(`Fetching contact info for ${cleanPhone}...`);
      const contactResponse = await fetch(
        `${EVOLUTION_API_URL}/chat/findContacts/${EVOLUTION_INSTANCE_NAME}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY
          },
          body: JSON.stringify({
            where: {
              remoteJid: `${cleanPhone}@s.whatsapp.net`
            }
          })
        }
      );

      if (contactResponse.ok) {
        const contacts = await contactResponse.json();
        if (contacts && contacts.length > 0 && contacts[0].pushName) {
          realContactName = contacts[0].pushName;
          console.log(`Real contact name found: ${realContactName}`);
        }
      }
    } catch (contactError) {
      console.error('Error fetching contact name:', contactError);
      // Continuar com o nome 'Cliente'
    }

    // Registrar mensagem no chat de atendimento usando telefone NORMALIZADO (sem 55)
    // Apenas se não for mensagem de operador (skip_message_save = true)
    if (!skip_message_save) {
      try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        let conversationId = conversation_id;

        // Buscar ou criar conversa com telefone normalizado (sem 55)
        if (!conversationId) {
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('*')
            .eq('customer_phone', normalizedPhone)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
            
            // SEMPRE atualizar o nome se conseguimos buscar o nome real do WhatsApp
            // O nome do WhatsApp é sempre mais preciso que o nome da API
            if (realContactName && realContactName !== 'Cliente') {
              await supabase
                .from('conversations')
                .update({ 
                  customer_name: realContactName,
                  last_message_at: new Date().toISOString() 
                })
                .eq('id', conversationId);
              console.log('Updated conversation name to:', realContactName);
            } else {
              // Apenas atualizar última mensagem
              await supabase
                .from('conversations')
                .update({ last_message_at: new Date().toISOString() })
                .eq('id', existingConv.id);
            }
          } else {
            // Criar nova conversa com nome real
            const { data: newConv } = await supabase
              .from('conversations')
              .insert({
                customer_phone: normalizedPhone,
                customer_name: realContactName,
                status: 'active',
                last_message_at: new Date().toISOString(),
              })
              .select()
              .single();

            conversationId = newConv?.id;
            console.log('Created new conversation with name:', realContactName);
          }
        }

        // Criar mensagem no chat (apenas para mensagens do bot)
        if (conversationId) {
          const messageData: any = {
            conversation_id: conversationId,
            sender_type: 'agent',
            sender_name: 'Bot',
            message_text: message,
            message_status: 'sent',
          };

          // Adicionar replied_to_id se for uma resposta
          if (replied_to_id) {
            messageData.replied_to_id = replied_to_id;
          }

          await supabase.from('messages').insert(messageData);
        }
      } catch (chatError) {
        console.error('Erro ao registrar mensagem no chat:', chatError);
        // Não bloqueia o envio se falhar o registro no chat
      }
    } else {
      console.log('Skipping message save (operator message)');
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
