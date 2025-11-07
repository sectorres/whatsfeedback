import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatPhoneForWhatsApp } from "../_shared/phone-utils.ts";

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

    // Formatar telefone para WhatsApp
    const cleanPhone = formatPhoneForWhatsApp(phone);
    
    // Montar payload no formato esperado pela Evolution API
    const normalizedType = ['image','video','audio','document'].includes(mediaType) ? mediaType : 'document';
    const payload: Record<string, unknown> = {
      number: cleanPhone,
      mediatype: normalizedType,
      media: mediaUrl,
    };

    if (caption) payload.caption = caption;
    if (normalizedType === 'document' && fileName) payload.fileName = fileName;

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
      // Mapear erros comuns da Evolution API para mensagens mais claras
      let code = 'evolution_api_error';
      let message = 'Falha ao enviar mídia.';
      try {
        const m = (responseData as any)?.response?.message;
        // Caso: [["instance requires property \"mediatype\""]]
        if (Array.isArray(m) && Array.isArray(m[0]) && typeof m[0][0] === 'string') {
          message = m[0][0];
          if (message.includes('mediatype')) code = 'invalid_mediatype';
        }
        // Caso: [{ exists:false, number, jid }]
        if (Array.isArray(m) && m[0] && typeof m[0] === 'object') {
          const first = m[0];
          if (first.exists === false) {
            code = 'number_not_on_whatsapp';
            message = 'O número informado não possui WhatsApp ou não existe.';
          }
        }
      } catch (_) {}
      return new Response(
        JSON.stringify({ success: false, code, message, details: responseData }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
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
