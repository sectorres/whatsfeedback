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
    const { messageId, conversationId } = await req.json();

    if (!messageId || !conversationId) {
      throw new Error('messageId e conversationId são obrigatórios');
    }

    console.log('Deleting message:', { messageId, conversationId });

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

    // Buscar informações da conversa
    const { data: conversation } = await supabase
      .from('conversations')
      .select('customer_phone')
      .eq('id', conversationId)
      .single();

    if (!conversation) {
      throw new Error('Conversa não encontrada');
    }

    // Deletar via Evolution API
    const response = await fetch(
      `${EVOLUTION_API_URL}/message/deleteMessage/${EVOLUTION_INSTANCE_NAME}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY,
        },
        body: JSON.stringify({
          key: {
            id: messageId
          }
        })
      }
    );

    const data = await response.json();
    console.log('Delete message response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete message');
    }

    // Marcar mensagem como deletada no banco (soft delete)
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        is_deleted: true,
        message_text: 'Mensagem apagada'
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
    console.error('Error in whatsapp-delete-message:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
