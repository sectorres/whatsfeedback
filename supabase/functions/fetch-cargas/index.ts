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
    const { dataInicial, dataFinal } = await req.json().catch(() => ({}));
    
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
    
    if (data.retorno?.cargas) {
      console.log('Total de cargas retornadas:', data.retorno.cargas.length);
      
      // Log dos IDs das primeiras e últimas cargas
      const cargas = data.retorno.cargas;
      if (cargas.length > 0) {
        console.log('Primeiras 5 cargas:', cargas.slice(0, 5).map((c: any) => ({ id: c.id, data: c.data })));
        console.log('Últimas 5 cargas:', cargas.slice(-5).map((c: any) => ({ id: c.id, data: c.data })));
        
        // Procurar especificamente pela carga 220009
        const carga220009 = cargas.find((c: any) => c.id === 220009);
        if (carga220009) {
          console.log('CARGA 220009 ENCONTRADA:', carga220009);
        } else {
          console.log('CARGA 220009 NÃO ENCONTRADA no retorno da API');
        }
      }
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
