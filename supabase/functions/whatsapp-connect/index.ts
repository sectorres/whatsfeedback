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
    const { action } = await req.json();
    const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');
    const EVOLUTION_INSTANCE_NAME = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      throw new Error('Evolution API credentials not configured');
    }

    console.log('Evolution API Request:', { action, instance: EVOLUTION_INSTANCE_NAME });

    if (action === 'getQRCode') {
      // Get connection status first
      const statusResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const statusData = await statusResponse.json();
      console.log('Connection status:', statusData);

      // If already connected, return connected status
      if (statusData.instance?.state === 'open') {
        return new Response(
          JSON.stringify({ 
            status: 'connected',
            message: 'WhatsApp already connected'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get QR Code
      const qrResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const qrData = await qrResponse.json();
      console.log('QR Code response:', qrData);

      return new Response(
        JSON.stringify(qrData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'getStatus') {
      const statusResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${EVOLUTION_INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const statusData = await statusResponse.json();
      console.log('Status check:', statusData);

      return new Response(
        JSON.stringify(statusData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      const disconnectResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/logout/${EVOLUTION_INSTANCE_NAME}`,
        {
          method: 'DELETE',
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const disconnectData = await disconnectResponse.json();
      console.log('Disconnect response:', disconnectData);

      return new Response(
        JSON.stringify(disconnectData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in whatsapp-connect:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
