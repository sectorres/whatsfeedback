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

interface TriggerPhrase {
  id: string;
  phrase: string;
  response: string;
  is_active: boolean;
  match_type: 'contains' | 'exact' | 'starts_with';
}

interface Produto {
  id: number;
  descricao: string;
  pesoBruto: number;
  quantidade: number;
  periodoEntrega: string;
  empresaColeta: number;
}

interface Cliente {
  id: number;
  nome: string;
  documento: string;
  telefone: string;
  celular: string;
  cep: string;
  endereco: string;
  referencia: string;
  bairro: string;
  setor: string;
  cidade: string;
  estado: string;
  observacao: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal: string;
  empresa: number;
  documento: number;
  serie: string;
  data: string;
  pesoBruto: number;
  valor: number;
  rota: string;
  cliente: Cliente;
  produtos: Produto[];
}

interface Carga {
  id: number;
  data: string;
  motorista: number;
  nomeMotorista: string;
  transportadora: number;
  nomeTransportadora: string;
  status: string;
  pedidos: Pedido[];
}

// Check if message matches any trigger phrase using literal matching first
function checkLiteralTriggerMatch(message: string, triggers: TriggerPhrase[]): TriggerPhrase | null {
  const normalizedMessage = message.toLowerCase().trim();
  
  for (const trigger of triggers) {
    if (!trigger.is_active) continue;
    
    const normalizedPhrase = trigger.phrase.toLowerCase().trim();
    
    switch (trigger.match_type) {
      case 'exact':
        if (normalizedMessage === normalizedPhrase) return trigger;
        break;
      case 'starts_with':
        if (normalizedMessage.startsWith(normalizedPhrase)) return trigger;
        break;
      case 'contains':
      default:
        if (normalizedMessage.includes(normalizedPhrase)) return trigger;
        break;
    }
  }
  
  return null;
}

// Use AI to semantically match message with trigger phrases
async function checkSemanticTriggerMatch(
  message: string, 
  triggers: TriggerPhrase[],
  lovableApiKey: string | undefined
): Promise<TriggerPhrase | null> {
  if (!lovableApiKey || triggers.length === 0) {
    console.log('No API key or no triggers for semantic matching');
    return null;
  }

  const activeTriggers = triggers.filter(t => t.is_active);
  if (activeTriggers.length === 0) return null;

  // Build the trigger list for the AI prompt
  const triggerList = activeTriggers.map((t, i) => `${i + 1}. "${t.phrase}"`).join('\n');

  const systemPrompt = `Você é um analisador de intenção de mensagens. Sua tarefa é identificar se a mensagem do cliente corresponde semanticamente a alguma das frases gatilho listadas abaixo.

FRASES GATILHO:
${triggerList}

INSTRUÇÕES:
- Analise a INTENÇÃO e CONTEXTO da mensagem do cliente
- O cliente pode expressar a mesma intenção de formas diferentes (sinônimos, frases reformuladas, gírias, erros de digitação)
- Se a mensagem do cliente tem a mesma intenção de alguma frase gatilho, responda APENAS com o número correspondente
- Se NÃO houver correspondência semântica com nenhuma frase, responda "0"
- Responda APENAS com o número, sem explicações adicionais

EXEMPLOS:
- Se a frase gatilho é "status do pedido" e o cliente diz "como está minha encomenda?", isso é uma correspondência
- Se a frase gatilho é "previsão de entrega" e o cliente diz "quando meu pedido vai chegar?", isso é uma correspondência
- Se a frase gatilho é "reagendar entrega" e o cliente diz "preciso mudar a data", isso é uma correspondência`;

  try {
    console.log('Calling Gemini for semantic trigger matching...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Mensagem do cliente: "${message}"` }
        ],
        max_tokens: 10,
        temperature: 0.1
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content?.trim() || '0';
    
    console.log('Gemini semantic match response:', aiResponse);

    const matchIndex = parseInt(aiResponse, 10);
    
    if (matchIndex > 0 && matchIndex <= activeTriggers.length) {
      const matchedTrigger = activeTriggers[matchIndex - 1];
      console.log('Semantic match found:', matchedTrigger.phrase);
      return matchedTrigger;
    }

    return null;
  } catch (error) {
    console.error('Error in semantic trigger matching:', error);
    return null;
  }
}

// Generate contextual response based on trigger and customer message
async function generateContextualResponse(
  customerMessage: string,
  triggerResponse: string,
  customerName: string,
  lovableApiKey: string | undefined
): Promise<string> {
  if (!lovableApiKey) {
    return triggerResponse;
  }

  const systemPrompt = `Você é um assistente de atendimento ao cliente amigável e profissional. Sua tarefa é adaptar uma resposta base ao contexto da mensagem do cliente.

RESPOSTA BASE (use como conteúdo principal):
"${triggerResponse}"

REGRAS:
1. Mantenha o conteúdo informativo da resposta base
2. Adapte a resposta ao tom e contexto da mensagem do cliente
3. Se o cliente fez uma saudação (oi, olá, bom dia, etc), inclua uma saudação apropriada no início
4. Se o cliente foi informal, seja um pouco mais informal também
5. Se o cliente perguntou de forma específica, responda focando nesse aspecto
6. Mantenha a resposta concisa e objetiva
7. NÃO invente informações que não estão na resposta base
8. Use o nome do cliente quando apropriado: ${customerName || 'Cliente'}
9. Sempre termine de forma educada

IMPORTANTE: A resposta deve parecer natural, como se fosse uma conversa real, não uma resposta automática.`;

  try {
    console.log('Generating contextual response...');
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Mensagem do cliente: "${customerMessage}"\n\nGere uma resposta contextualizada:` }
        ],
        max_tokens: 500,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      console.error('Gemini API error for contextual response:', response.status, await response.text());
      return triggerResponse;
    }

    const data = await response.json();
    const contextualResponse = data.choices?.[0]?.message?.content?.trim();
    
    if (contextualResponse) {
      console.log('Generated contextual response:', contextualResponse.substring(0, 100));
      return contextualResponse;
    }

    return triggerResponse;
  } catch (error) {
    console.error('Error generating contextual response:', error);
    return triggerResponse;
  }
}

// Extract pedido number or CPF from message
function extractSearchTerms(message: string): { pedido: string | null; cpf: string | null } {
  // Look for pedido pattern: XXX/XXXXXXX-X or variations
  const pedidoMatch = message.match(/\d{1,3}[\/\-]\d{5,8}[-]?[A-Z]?/i);
  
  // Look for CPF pattern: 11 digits or formatted XXX.XXX.XXX-XX
  const cpfClean = message.replace(/\D/g, '');
  const cpfMatch = cpfClean.length === 11 ? cpfClean : null;
  
  // Also check for formatted CPF in original message
  const cpfFormattedMatch = message.match(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/);
  
  return {
    pedido: pedidoMatch ? pedidoMatch[0].toUpperCase() : null,
    cpf: cpfMatch || (cpfFormattedMatch ? cpfFormattedMatch[0].replace(/\D/g, '') : null)
  };
}

// Query delivery API for orders
async function queryDeliveryAPI(pedido: string | null, cpf: string | null): Promise<{ orders: any[]; found: boolean }> {
  const API_URL = 'https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1';
  const API_USERNAME = Deno.env.get('API_USERNAME');
  const API_PASSWORD = Deno.env.get('API_PASSWORD');

  if (!API_USERNAME || !API_PASSWORD) {
    console.error('API credentials not configured');
    return { orders: [], found: false };
  }

  // Calculate date range (90 days past, 30 days future)
  const hoje = new Date();
  const dataFinalDate = new Date();
  const dataInicialDate = new Date();
  dataFinalDate.setDate(hoje.getDate() + 30);
  dataInicialDate.setDate(hoje.getDate() - 90);
  
  const dataFinal = dataFinalDate.toISOString().slice(0, 10).replace(/-/g, '');
  const dataInicial = dataInicialDate.toISOString().slice(0, 10).replace(/-/g, '');

  console.log('Querying delivery API...', { dataInicial, dataFinal, pedido, cpf });

  try {
    const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataInicial,
        dataFinal,
      }),
    });

    if (!response.ok) {
      console.error('Delivery API Error:', response.status);
      return { orders: [], found: false };
    }

    const data = await response.json();
    const cargas: Carga[] = data.retorno?.cargas || [];
    const foundOrders: any[] = [];

    for (const carga of cargas) {
      if (!carga.pedidos) continue;
      
      for (const pedidoItem of carga.pedidos) {
        let matches = false;
        
        // Match by pedido number
        if (pedido && pedidoItem.pedido) {
          const normalizedSearch = pedido.replace(/[-\/]/g, '').toLowerCase();
          const normalizedPedido = pedidoItem.pedido.replace(/[-\/]/g, '').toLowerCase();
          if (normalizedPedido.includes(normalizedSearch) || normalizedSearch.includes(normalizedPedido)) {
            matches = true;
          }
        }
        
        // Match by CPF
        if (cpf && pedidoItem.cliente?.documento) {
          const normalizedCpf = cpf.replace(/\D/g, '');
          const normalizedDocumento = pedidoItem.cliente.documento.replace(/\D/g, '');
          if (normalizedDocumento === normalizedCpf) {
            matches = true;
          }
        }
        
        if (matches) {
          foundOrders.push({
            pedido: pedidoItem.pedido,
            notaFiscal: pedidoItem.notaFiscal,
            data: pedidoItem.data,
            valor: pedidoItem.valor,
            pesoBruto: pedidoItem.pesoBruto,
            rota: pedidoItem.rota,
            status: carga.status,
            motorista: carga.nomeMotorista,
            dataCarga: carga.data,
            cliente: pedidoItem.cliente ? {
              nome: pedidoItem.cliente.nome,
              documento: pedidoItem.cliente.documento,
              telefone: pedidoItem.cliente.telefone || pedidoItem.cliente.celular,
              endereco: pedidoItem.cliente.endereco,
              bairro: pedidoItem.cliente.bairro,
              cidade: pedidoItem.cliente.cidade,
              estado: pedidoItem.cliente.estado,
              cep: pedidoItem.cliente.cep,
              referencia: pedidoItem.cliente.referencia,
              observacao: pedidoItem.cliente.observacao
            } : null,
            produtos: pedidoItem.produtos?.map(p => ({
              descricao: p.descricao,
              quantidade: p.quantidade,
              peso: p.pesoBruto
            })) || []
          });
        }
      }
    }

    console.log(`Found ${foundOrders.length} orders matching criteria`);
    return { orders: foundOrders, found: foundOrders.length > 0 };

  } catch (error) {
    console.error('Error querying delivery API:', error);
    return { orders: [], found: false };
  }
}

// Format date from YYYYMMDD to DD/MM/YYYY
function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr || 'N/A';
  return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}

// Replace placeholders in response
function replacePlaceholders(response: string, data: {
  customerName?: string;
  customerPhone?: string;
  orders?: any[];
}): string {
  let result = response;
  
  result = result.replace(/\{nome\}/gi, data.customerName || 'Cliente');
  result = result.replace(/\{telefone\}/gi, data.customerPhone || '');
  
  if (data.orders && data.orders.length > 0) {
    const order = data.orders[0];
    const statusMap: Record<string, string> = {
      'ABER': 'Em Aberto/Aguardando',
      'FATU': 'Faturado/Entregue',
      'CANC': 'Cancelado'
    };
    
    const orderInfo = `
Pedido: ${order.pedido}
Status: ${statusMap[order.status] || order.status}
Data Prevista: ${formatDate(order.dataCarga)}
Motorista: ${order.motorista || 'Não atribuído'}
Valor: R$ ${order.valor?.toFixed(2) || '0.00'}`;
    
    result = result.replace(/\{pedido\}/gi, orderInfo);
  } else {
    result = result.replace(/\{pedido\}/gi, 'Nenhum pedido encontrado');
  }
  
  return result;
}

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

    // Load trigger phrases
    const { data: triggerPhrases } = await supabase
      .from('ai_trigger_phrases')
      .select('*')
      .eq('is_active', true);

    // Check if message matches any trigger phrase - first try literal, then semantic
    let matchedTrigger = checkLiteralTriggerMatch(message_text, triggerPhrases || []);
    
    // If no literal match, try semantic matching with AI
    if (!matchedTrigger && triggerPhrases && triggerPhrases.length > 0) {
      console.log('No literal match, trying semantic matching...');
      matchedTrigger = await checkSemanticTriggerMatch(message_text, triggerPhrases, lovableApiKey);
    }
    
    if (!matchedTrigger) {
      console.log('No trigger phrase matched, AI will not respond');
      return new Response(JSON.stringify({ skipped: true, reason: 'No trigger phrase matched' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Matched trigger phrase:', matchedTrigger.phrase);

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

    // Extract search terms and query API if response has {pedido} placeholder
    let orders: any[] = [];
    if (matchedTrigger.response.toLowerCase().includes('{pedido}')) {
      // Get all messages to extract search terms
      const { data: messageHistory } = await supabase
        .from('messages')
        .select('message_text')
        .eq('conversation_id', conversation_id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const allMessages = (messageHistory || []).map(m => m.message_text).join(' ') + ' ' + message_text;
      const { pedido, cpf } = extractSearchTerms(allMessages);
      
      console.log('Search terms extracted:', { pedido, cpf });

      if (pedido || cpf) {
        const result = await queryDeliveryAPI(pedido, cpf);
        orders = result.orders;
      }
    }

    // Replace placeholders in the response
    const baseResponse = replacePlaceholders(matchedTrigger.response, {
      customerName: conversation.customer_name,
      customerPhone: customer_phone,
      orders
    });

    // Generate contextual response based on customer message
    const aiMessage = await generateContextualResponse(
      message_text,
      baseResponse,
      conversation.customer_name || 'Cliente',
      lovableApiKey
    );

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
      trigger_matched: matchedTrigger.phrase,
      orders_found: orders.length
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
