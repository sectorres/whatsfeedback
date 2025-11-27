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
    const { dataInicial, dataFinal, pedidoNumero } = await req.json().catch(() => ({}));
    
    const API_URL = 'https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1';
    const API_USERNAME = Deno.env.get('API_USERNAME');
    const API_PASSWORD = Deno.env.get('API_PASSWORD');

    if (!API_USERNAME || !API_PASSWORD) {
      throw new Error('API credentials not configured');
    }

    // Se não foram fornecidas datas, usar um período amplo (90 dias no passado e 30 no futuro)
    const hoje = new Date();
    
    const dataFinalDate = new Date();
    dataFinalDate.setDate(hoje.getDate() + 30); // 30 dias no futuro
    const dataFinalFormatted = dataFinal || dataFinalDate.toISOString().slice(0, 10).replace(/-/g, '');
    
    const dataInicialDate = new Date();
    dataInicialDate.setDate(hoje.getDate() - 90); // 90 dias no passado
    const dataInicialFormatted = dataInicial || dataInicialDate.toISOString().slice(0, 10).replace(/-/g, '');

    console.log('Fetching cargas from API...', { dataInicial: dataInicialFormatted, dataFinal: dataFinalFormatted });

    // Create Basic Auth header
    const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dataInicial: dataInicialFormatted,
        dataFinal: dataFinalFormatted,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully fetched cargas:', data.status);
    
    // Se pedidoNumero foi fornecido, filtrar apenas cargas que contêm esse pedido
    if (pedidoNumero && data.retorno?.cargas) {
      console.log('Filtrando por pedido:', pedidoNumero);
      const filteredCargas = data.retorno.cargas
        .map((carga: any) => {
          if (!carga.pedidos) return null;
          
          // Filtrar pedidos que correspondem ao número buscado
          const matchingPedidos = carga.pedidos.filter((pedido: any) => 
            pedido.pedido && pedido.pedido.toLowerCase().includes(pedidoNumero.toLowerCase())
          );
          
          // Se encontrou pedidos correspondentes, retornar a carga com apenas esses pedidos
          if (matchingPedidos.length > 0) {
            return {
              ...carga,
              pedidos: matchingPedidos
            };
          }
          return null;
        })
        .filter((carga: any) => carga !== null);
      
      data.retorno.cargas = filteredCargas;
      console.log('Cargas filtradas:', filteredCargas.length);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in fetch-cargas function:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        status: 'ERRO'
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
