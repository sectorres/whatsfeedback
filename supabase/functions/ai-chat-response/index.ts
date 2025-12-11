import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AiConfig {
  prompt: string;
  temperature: number;
  response_delay_seconds: number;
  enabled: boolean;
  max_tokens: number;
}

const DEFAULT_CONFIG: AiConfig = {
  prompt: "Você é um assistente virtual de atendimento ao cliente de uma empresa de logística e entregas.",
  temperature: 0.7,
  response_delay_seconds: 5,
  enabled: true,
  max_tokens: 500
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversation_id, customer_phone, message_text } = await req.json();
    
    console.log('AI Chat Response triggered:', { conversation_id, customer_phone, message_text: message_text?.substring(0, 50) });

    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Load AI config
    const { data: aiConfigData } = await supabase
      .from('ai_config')
      .select('prompt')
      .eq('config_key', 'chat_ai')
      .maybeSingle();

    let aiConfig: AiConfig = DEFAULT_CONFIG;
    if (aiConfigData?.prompt) {
      try {
        aiConfig = { ...DEFAULT_CONFIG, ...JSON.parse(aiConfigData.prompt) };
      } catch {
        aiConfig = { ...DEFAULT_CONFIG, prompt: aiConfigData.prompt };
      }
    }

    if (!aiConfig.enabled) {
      console.log('AI is globally disabled');
      return new Response(JSON.stringify({ skipped: true, reason: 'AI globally disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if conversation has AI enabled
    const { data: conversation } = await supabase
      .from('conversations')
      .select('ai_active, customer_name, customer_phone')
      .eq('id', conversation_id)
      .single();

    if (!conversation?.ai_active) {
      console.log('AI is disabled for this conversation');
      return new Response(JSON.stringify({ skipped: true, reason: 'AI disabled for conversation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Wait for the configured delay
    const delayMs = (aiConfig.response_delay_seconds || 5) * 1000;
    console.log(`Waiting ${delayMs}ms before responding...`);
    await new Promise(resolve => setTimeout(resolve, delayMs));

    // Check if human operator responded during the delay
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id, sender_type, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(5);

    // If the most recent message is from operator, skip AI response
    if (recentMessages && recentMessages[0]?.sender_type === 'operator') {
      console.log('Operator already responded, skipping AI');
      return new Response(JSON.stringify({ skipped: true, reason: 'Operator responded' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Gather context data for the AI

    // 1. Get conversation history (last 10 messages)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('sender_type, message_text, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // 2. Get customer orders from campaign_sends
    const normalizedPhone = customer_phone.replace(/\D/g, '');
    const { data: customerOrders } = await supabase
      .from('campaign_sends')
      .select('pedido_numero, customer_name, driver_name, data_pedido, valor_total, quantidade_itens, endereco_completo, bairro, cidade, estado, status, produtos')
      .eq('customer_phone', normalizedPhone)
      .order('sent_at', { ascending: false })
      .limit(5);

    // 3. Get delivered orders
    const { data: deliveredOrders } = await supabase
      .from('delivered_orders')
      .select('pedido_numero, customer_name, driver_name, data_entrega, valor_total, quantidade_itens, endereco_completo, bairro, cidade, estado, status, produtos')
      .eq('customer_phone', normalizedPhone)
      .order('created_at', { ascending: false })
      .limit(5);

    // 4. Get satisfaction surveys
    const { data: surveys } = await supabase
      .from('satisfaction_surveys')
      .select('rating, feedback, status, sent_at, responded_at')
      .eq('customer_phone', normalizedPhone)
      .order('sent_at', { ascending: false })
      .limit(3);

    // Build context for AI
    const contextParts: string[] = [];

    // Customer info
    contextParts.push(`**Informações do Cliente:**
- Nome: ${conversation.customer_name || 'Não informado'}
- Telefone: ${customer_phone}`);

    // Orders
    if (customerOrders && customerOrders.length > 0) {
      contextParts.push(`\n**Pedidos Recentes:**`);
      customerOrders.forEach((order, i) => {
        contextParts.push(`${i + 1}. Pedido: ${order.pedido_numero || 'N/A'}
   - Status: ${order.status || 'N/A'}
   - Motorista: ${order.driver_name || 'Não atribuído'}
   - Data: ${order.data_pedido || 'N/A'}
   - Valor: R$ ${order.valor_total?.toFixed(2) || '0.00'}
   - Endereço: ${order.endereco_completo || ''}, ${order.bairro || ''} - ${order.cidade || ''}/${order.estado || ''}`);
      });
    }

    // Delivered orders
    if (deliveredOrders && deliveredOrders.length > 0) {
      contextParts.push(`\n**Entregas Realizadas:**`);
      deliveredOrders.forEach((order, i) => {
        contextParts.push(`${i + 1}. Pedido: ${order.pedido_numero || 'N/A'}
   - Data Entrega: ${order.data_entrega || 'N/A'}
   - Motorista: ${order.driver_name || 'N/A'}
   - Valor: R$ ${order.valor_total?.toFixed(2) || '0.00'}`);
      });
    }

    // Surveys
    if (surveys && surveys.length > 0) {
      contextParts.push(`\n**Pesquisas de Satisfação:**`);
      surveys.forEach((survey, i) => {
        contextParts.push(`${i + 1}. Nota: ${survey.rating || 'Pendente'}/5
   - Status: ${survey.status}
   - Feedback: ${survey.feedback || 'Nenhum'}`);
      });
    }

    const contextData = contextParts.join('\n');

    // Build conversation history for AI
    const conversationHistory = (messageHistory || [])
      .reverse()
      .map(msg => ({
        role: msg.sender_type === 'customer' ? 'user' : 'assistant',
        content: msg.message_text
      }));

    // Call Lovable AI (Gemini)
    console.log('Calling Lovable AI...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `${aiConfig.prompt}

## Dados do Cliente e Pedidos (Use para responder perguntas específicas):
${contextData}

## Instruções Importantes:
- Use os dados acima para responder perguntas sobre pedidos, entregas, etc.
- Seja conciso e direto nas respostas.
- Se não tiver a informação solicitada nos dados, informe que vai verificar com a equipe.
- Responda sempre em português brasileiro.
- Não invente informações - use apenas os dados fornecidos.`
          },
          ...conversationHistory
        ],
        temperature: aiConfig.temperature,
        max_tokens: aiConfig.max_tokens
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;

    if (!aiMessage) {
      console.error('No AI response content');
      return new Response(JSON.stringify({ error: 'No AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('AI Response:', aiMessage.substring(0, 100));

    // Send message via WhatsApp
    const { data: sendResult, error: sendError } = await supabase.functions.invoke('whatsapp-send', {
      body: {
        phone: customer_phone,
        message: aiMessage,
        conversation_id: conversation_id
      }
    });

    if (sendError) {
      console.error('Error sending AI message:', sendError);
      return new Response(JSON.stringify({ error: 'Failed to send message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('AI message sent successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      message: aiMessage,
      context_used: {
        orders: customerOrders?.length || 0,
        delivered: deliveredOrders?.length || 0,
        surveys: surveys?.length || 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Chat Response error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
