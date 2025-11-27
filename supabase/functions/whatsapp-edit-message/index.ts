import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, newText } = await req.json();

    if (!messageId || !newText) {
      throw new Error('messageId e newText são obrigatórios');
    }

    console.log('Editing message:', { messageId, newText });

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

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Buscar whatsapp_message_id no banco
    const { data: message, error: fetchError } = await supabase
      .from('messages')
      .select('whatsapp_message_id')
      .eq('id', messageId)
      .single();

    if (fetchError || !message?.whatsapp_message_id) {
      throw new Error('Mensagem não encontrada ou sem whatsapp_message_id');
    }

    console.log('WhatsApp message ID:', message.whatsapp_message_id);

    // Editar via Evolution API
    const response = await fetch(
      `${EVOLUTION_API_URL}/chat/updateMessage/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          key: {
            id: message.whatsapp_message_id
          },
          text: newText
        })
      }
    );

    const data = await response.json();
    console.log('Edit message response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to edit message');
    }

    // Atualizar mensagem no banco
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        message_text: newText,
        edited_at: new Date().toISOString()
      })
      .eq('id', messageId);

    if (updateError) {
      console.error('Error updating message in database:', updateError);
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in whatsapp-edit-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
