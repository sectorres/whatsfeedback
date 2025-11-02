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
    const url = new URL(req.url);
    const mediaUrl = url.searchParams.get('url');
    
    if (!mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'URL parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Proxying media URL:', mediaUrl);

    // Tenta baixar a mídia diretamente
    const mediaResponse = await fetch(mediaUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!mediaResponse.ok) {
      console.error('Failed to fetch media:', mediaResponse.status, mediaResponse.statusText);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch media' }),
        { 
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const headers = new Headers(corsHeaders as Record<string, string>);
    headers.set('Content-Type', mediaResponse.headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(mediaResponse.body, { headers });

  } catch (error) {
    console.error('Error in whatsapp-media-proxy:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});