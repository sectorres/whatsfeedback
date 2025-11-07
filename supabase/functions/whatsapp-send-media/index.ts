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
    const { phone, mediaUrl, mediaType, fileName, caption } = await req.json();
    
    console.log('Sending media via WhatsApp:', { phone, mediaType, fileName });

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');
    const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

    if (!evolutionApiUrl || !evolutionApiKey || !instanceName) {
      throw new Error('Evolution API credentials not configured');
    }

    // Formatar telefone para WhatsApp (remover caracteres especiais)
    const formattedPhone = phone.replace(/\D/g, '');
    
    // Preparar payload baseado no tipo de mídia
    let payload: any = {
      number: formattedPhone,
    };

    if (mediaType === 'image') {
      payload.mediaMessage = {
        mediatype: 'image',
        media: mediaUrl,
        caption: caption || ''
      };
    } else if (mediaType === 'video') {
      payload.mediaMessage = {
        mediatype: 'video',
        media: mediaUrl,
        caption: caption || ''
      };
    } else if (mediaType === 'audio') {
      payload.audioMessage = {
        audio: mediaUrl
      };
    } else {
      // Documento
      payload.mediaMessage = {
        mediatype: 'document',
        media: mediaUrl,
        fileName: fileName || 'documento',
        caption: caption || ''
      };
    }

    console.log('Evolution API payload:', JSON.stringify(payload));

    // Enviar para Evolution API
    const response = await fetch(
      `${evolutionApiUrl}/message/sendMedia/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify(payload),
      }
    );

    const responseData = await response.json();
    console.log('Evolution API response:', responseData);

    if (!response.ok) {
      throw new Error(`Evolution API error: ${JSON.stringify(responseData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error sending media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
