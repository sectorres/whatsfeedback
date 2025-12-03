import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getEvolutionCredentials } from "../_shared/evolution-config.ts";

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
    
    // Buscar credenciais da Evolution API (do banco ou secrets)
    const { apiUrl: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, instanceName: EVOLUTION_INSTANCE_NAME } = await getEvolutionCredentials();

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

      // Restart instance to get fresh QR code
      const restartResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/restart/${EVOLUTION_INSTANCE_NAME}`,
        {
          method: 'PUT',
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      console.log('Restart response status:', restartResponse.status);

      // Wait a bit for instance to restart
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get QR Code - usando o endpoint fetchInstances que retorna o QR
      const qrResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${EVOLUTION_INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const qrData = await qrResponse.json();
      console.log('QR Code response:', qrData);

      // Extract QR code from response
      if (qrData && qrData.length > 0 && qrData[0]?.instance?.qrcode) {
        const qrcode = qrData[0].instance.qrcode;
        return new Response(
          JSON.stringify({ qrcode: { base64: qrcode.base64 || qrcode } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If no QR code yet, try direct connect endpoint
      const connectResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/connect/${EVOLUTION_INSTANCE_NAME}`,
        {
          headers: {
            'apikey': EVOLUTION_API_KEY,
          }
        }
      );

      const connectData = await connectResponse.json();
      console.log('Connect response:', connectData);

      if (connectData.qrcode || connectData.base64) {
        return new Response(
          JSON.stringify({ 
            qrcode: { 
              base64: connectData.qrcode?.base64 || connectData.base64 || connectData.qrcode 
            } 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return error if no QR code available
      return new Response(
        JSON.stringify({ 
          error: 'QR code not available. Instance may need to be created first.',
          details: connectData
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
