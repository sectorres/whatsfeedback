import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) {
    cleaned = cleaned.substring(2);
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting monitor-delivered-orders function');

    // Buscar campanhas recentes (últimos 30 dias) do tipo 'carga'
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('target_type', 'carga')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError);
      throw campaignsError;
    }

    if (!recentCampaigns || recentCampaigns.length === 0) {
      console.log('No recent campaigns found');
      return new Response(
        JSON.stringify({ message: 'No recent campaigns to monitor' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const campaignIds = recentCampaigns.map(c => c.id);

    // Buscar envios de campanha com status 'confirmed' que ainda não têm pesquisa
    const { data: confirmedSends, error: sendsError } = await supabase
      .from('campaign_sends')
      .select('id, pedido_numero, carga_id')
      .in('campaign_id', campaignIds)
      .eq('status', 'confirmed')
      .not('pedido_numero', 'is', null);

    if (sendsError) {
      console.error('Error fetching campaign sends:', sendsError);
      throw sendsError;
    }

    if (!confirmedSends || confirmedSends.length === 0) {
      console.log('No confirmed sends found');
      return new Response(
        JSON.stringify({ message: 'No confirmed sends to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${confirmedSends.length} confirmed sends to check`);

    // Buscar pedidos que já existem na tabela delivered_orders
    const pedidoNumeros = confirmedSends
      .map(s => s.pedido_numero)
      .filter((p): p is string => p !== null);

    const { data: existingDelivered } = await supabase
      .from('delivered_orders')
      .select('pedido_numero')
      .in('pedido_numero', pedidoNumeros);

    const existingPedidoSet = new Set(
      (existingDelivered || []).map(d => d.pedido_numero)
    );

    // Filtrar apenas os que ainda não foram salvos
    const sendsToCheck = confirmedSends.filter(
      s => s.pedido_numero && !existingPedidoSet.has(s.pedido_numero)
    );

    if (sendsToCheck.length === 0) {
      console.log('All confirmed orders already in delivered_orders');
      return new Response(
        JSON.stringify({ message: 'All orders already tracked' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${sendsToCheck.length} orders for delivery status`);

    // Buscar dados dos pedidos na API
    const apiUsername = Deno.env.get('API_USERNAME');
    const apiPassword = Deno.env.get('API_PASSWORD');
    const apiUrl = Deno.env.get('EVOLUTION_API_URL');

    if (!apiUsername || !apiPassword || !apiUrl) {
      throw new Error('API credentials not configured');
    }

    const credentials = btoa(`${apiUsername}:${apiPassword}`);
    
    // Buscar últimos 30 dias da API
    const dataInicial = new Date();
    dataInicial.setDate(dataInicial.getDate() - 30);
    const dataFinal = new Date();
    dataFinal.setDate(dataFinal.getDate() + 1);

    const apiResponse = await fetch(`${apiUrl}/ServPubGetCargasEntrega/V1`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataInicial: dataInicial.toISOString().split('T')[0].replace(/-/g, ''),
        dataFinal: dataFinal.toISOString().split('T')[0].replace(/-/g, ''),
      }),
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status}`);
    }

    const cargas: Carga[] = await apiResponse.json();
    console.log(`Fetched ${cargas.length} cargas from API`);

    // Processar cargas e encontrar pedidos entregues (status FATU)
    let newDeliveredCount = 0;
    const deliveredOrders = [];

    for (const carga of cargas) {
      if (carga.status !== 'FATU') continue;

      for (const pedido of carga.pedidos) {
        const pedidoNumero = pedido.pedido;
        
        // Verificar se este pedido está na lista de confirmados e ainda não foi salvo
        if (!sendsToCheck.find(s => s.pedido_numero === pedidoNumero)) {
          continue;
        }

        const customerPhone = normalizePhone(pedido.cliente.celular || pedido.cliente.telefone);
        const enderecoCompleto = pedido.cliente.endereco;

        deliveredOrders.push({
          pedido_numero: pedidoNumero,
          pedido_id: pedido.id,
          carga_id: carga.id,
          customer_phone: customerPhone,
          customer_name: pedido.cliente.nome,
          driver_name: carga.nomeMotorista,
          data_entrega: pedido.data,
          valor_total: pedido.valor,
          peso_total: pedido.pesoBruto,
          quantidade_itens: pedido.produtos?.reduce((sum, p) => sum + p.quantidade, 0) || 0,
          endereco_completo: enderecoCompleto,
          bairro: pedido.cliente.bairro,
          cidade: pedido.cliente.cidade,
          estado: pedido.cliente.estado,
          referencia: pedido.cliente.referencia,
          observacao: pedido.cliente.observacao,
          produtos: pedido.produtos,
          status: 'FATU',
        });
      }
    }

    if (deliveredOrders.length > 0) {
      console.log(`Inserting ${deliveredOrders.length} delivered orders`);
      
      const { error: insertError } = await supabase
        .from('delivered_orders')
        .upsert(deliveredOrders, { 
          onConflict: 'pedido_numero',
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('Error inserting delivered orders:', insertError);
        throw insertError;
      }

      newDeliveredCount = deliveredOrders.length;
      console.log(`Successfully saved ${newDeliveredCount} delivered orders`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Monitor completed',
        checked: sendsToCheck.length,
        newDelivered: newDeliveredCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in monitor-delivered-orders:', error);
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
