import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { mediaUrl, mediaType } = await req.json();
    console.log('Processing media:', { mediaUrl, mediaType });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let result = {};

    if (mediaType === 'audio') {
      // Download audio
      const audioResponse = await fetch(mediaUrl);
      const audioBlob = await audioResponse.blob();
      
      // Convert to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      // Transcribe with Lovable AI (using gemini-2.5-flash for audio)
      const transcriptionResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Por favor, transcreva este áudio:"
                },
                {
                  type: "audio",
                  audio_url: {
                    url: `data:audio/ogg;base64,${base64Audio}`
                  }
                }
              ]
            }
          ]
        })
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Transcription failed: ${await transcriptionResponse.text()}`);
      }

      const transcriptionData = await transcriptionResponse.json();
      result = {
        transcription: transcriptionData.choices[0]?.message?.content || "Não foi possível transcrever o áudio"
      };
      
    } else if (mediaType === 'image') {
      // Analyze image with Lovable AI
      const analysisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Descreva brevemente o que você vê nesta imagem:"
                },
                {
                  type: "image_url",
                  image_url: {
                    url: mediaUrl
                  }
                }
              ]
            }
          ]
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Image analysis failed: ${await analysisResponse.text()}`);
      }

      const analysisData = await analysisResponse.json();
      result = {
        description: analysisData.choices[0]?.message?.content || "Não foi possível analisar a imagem"
      };
    }

    console.log('Media processing result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing media:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
