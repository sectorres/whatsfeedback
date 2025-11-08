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
    const { pedidoNumero } = await req.json();
    
    if (!pedidoNumero || pedidoNumero.length < 3) {
      return new Response(JSON.stringify({ pedidos: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const API_URL = 'https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1';
    const API_USERNAME = Deno.env.get('API_USERNAME');
    const API_PASSWORD = Deno.env.get('API_PASSWORD');

    if (!API_USERNAME || !API_PASSWORD) {
      throw new Error('API credentials not configured');
    }

    // Buscar últimos 90 dias para permitir busca em qualquer período
    const hoje = new Date();
    const dataFinal = hoje.toISOString().slice(0, 10).replace(/-/g, '');
    
    const dataInicialDate = new Date();
    dataInicialDate.setDate(hoje.getDate() - 90);
    const dataInicial = dataInicialDate.toISOString().slice(0, 10).replace(/-/g, '');

    console.log('Buscando pedido:', pedidoNumero);

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
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    // Filtrar pedidos que correspondem ao número buscado
    const pedidosEncontrados: any[] = [];
    
    if (data.cargas && Array.isArray(data.cargas)) {
      data.cargas.forEach((carga: any) => {
        if (carga.pedidos && Array.isArray(carga.pedidos)) {
          carga.pedidos.forEach((pedido: any) => {
            if (pedido.pedido && pedido.pedido.toLowerCase().includes(pedidoNumero.toLowerCase())) {
              pedidosEncontrados.push({
                ...pedido,
                cargaId: carga.id,
                motorista: carga.nomeMotorista,
                transportadora: carga.nomeTransportadora,
                statusCarga: carga.status,
                dataCarga: carga.data
              });
            }
          });
        }
      });
    }

    console.log('Pedidos encontrados:', pedidosEncontrados.length);

    return new Response(JSON.stringify({ pedidos: pedidosEncontrados }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in search-pedido function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        pedidos: []
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
