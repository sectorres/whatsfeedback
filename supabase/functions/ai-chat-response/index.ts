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

// Build context from API orders
function buildOrderContext(orders: any[]): string {
  if (orders.length === 0) return '';
  
  const parts: string[] = ['**Pedidos Encontrados na API:**'];
  
  orders.forEach((order, i) => {
    const statusMap: Record<string, string> = {
      'ABER': 'Em Aberto/Aguardando',
      'FATU': 'Faturado/Entregue',
      'CANC': 'Cancelado'
    };
    
    parts.push(`
${i + 1}. **Pedido: ${order.pedido}**
   - Status: ${statusMap[order.status] || order.status}
   - Data de Entrega Prevista: ${formatDate(order.dataCarga)}
   - Motorista: ${order.motorista || 'Não atribuído'}
   - Nota Fiscal: ${order.notaFiscal || 'N/A'}
   - Valor: R$ ${order.valor?.toFixed(2) || '0.00'}
   - Peso: ${order.pesoBruto?.toFixed(2) || '0.00'} kg`);
    
    if (order.cliente) {
      parts.push(`   - Cliente: ${order.cliente.nome}
   - CPF/CNPJ: ${order.cliente.documento}
   - Endereço: ${order.cliente.endereco}, ${order.cliente.bairro} - ${order.cliente.cidade}/${order.cliente.estado}
   - CEP: ${order.cliente.cep}
   - Referência: ${order.cliente.referencia || 'N/A'}`);
    }
    
    if (order.produtos && order.produtos.length > 0) {
      parts.push(`   - Produtos:`);
      order.produtos.forEach((p: any) => {
        parts.push(`     • ${p.descricao} (Qtd: ${p.quantidade})`);
      });
    }
  });
  
  return parts.join('\n');
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

    // Get conversation history (last 10 messages)
    const { data: messageHistory } = await supabase
      .from('messages')
      .select('sender_type, message_text, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Extract search terms from message and conversation history
    const allMessages = (messageHistory || []).map(m => m.message_text).join(' ') + ' ' + message_text;
    const { pedido, cpf } = extractSearchTerms(allMessages);
    
    console.log('Search terms extracted:', { pedido, cpf });

    // Query delivery API
    let apiOrderContext = '';
    let apiOrdersFound = false;
    
    if (pedido || cpf) {
      const { orders, found } = await queryDeliveryAPI(pedido, cpf);
      apiOrdersFound = found;
      if (found) {
        apiOrderContext = buildOrderContext(orders);
      }
    }

    // Also try to find by customer phone
    if (!apiOrdersFound) {
      const normalizedPhone = customer_phone.replace(/\D/g, '');
      // Try to find CPF from previous customer data in database
      const { data: existingCustomer } = await supabase
        .from('campaign_sends')
        .select('customer_name')
        .eq('customer_phone', normalizedPhone)
        .limit(1)
        .maybeSingle();
      
      // If no specific search term found, provide general context
      if (!pedido && !cpf) {
        console.log('No specific pedido or CPF found in message');
      }
    }

    // Build context
    const contextParts: string[] = [];

    // Customer info
    contextParts.push(`**Informações do Cliente:**
- Nome: ${conversation.customer_name || 'Não informado'}
- Telefone: ${customer_phone}`);

    // Add API order context if found
    if (apiOrderContext) {
      contextParts.push(apiOrderContext);
    } else if (pedido || cpf) {
      contextParts.push(`\n**Busca Realizada:**
- Termo buscado: ${pedido || cpf}
- Resultado: Nenhum pedido encontrado com esse ${pedido ? 'número de pedido' : 'CPF'}`);
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
- Você consulta a API de entregas diretamente para buscar informações de pedidos.
- A busca pode ser feita por número de pedido (ex: 001/0270716-P) ou CPF do cliente.
- Se o cliente perguntar sobre um pedido, extraia o número do pedido ou CPF da mensagem e use os dados encontrados.
- Se não encontrar o pedido/CPF informado, informe que não foi localizado e peça para verificar o número.
- Seja conciso e direto nas respostas.
- Responda sempre em português brasileiro.
- Não invente informações - use apenas os dados fornecidos pela API.
- Para consultar um pedido, o cliente pode informar o número do pedido ou seu CPF.`
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
      search_terms: { pedido, cpf },
      api_orders_found: apiOrdersFound
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
