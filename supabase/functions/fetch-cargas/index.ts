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
    const API_URL = 'https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1';
    const API_USERNAME = Deno.env.get('API_USERNAME');
    const API_PASSWORD = Deno.env.get('API_PASSWORD');

    if (!API_USERNAME || !API_PASSWORD) {
      throw new Error('API credentials not configured');
    }

    console.log('Fetching cargas from API...');

    // Create Basic Auth header
    const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error:', response.status, errorText);
      throw new Error(`API returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('Successfully fetched cargas:', data.status);

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
