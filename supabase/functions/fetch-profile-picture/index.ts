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
    const { phone } = await req.json();
    
    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais da Evolution API (do banco ou secrets)
    const { apiUrl: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY, instanceName: EVOLUTION_INSTANCE_NAME } = await getEvolutionCredentials();

    // Normalizar o número de telefone (adicionar @s.whatsapp.net se necessário)
    const formattedPhone = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    console.log('Fetching profile picture for:', formattedPhone);

    // Buscar foto de perfil da Evolution API
    const profilePicUrl = `${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE_NAME}`;
    
    const response = await fetch(profilePicUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY,
      },
      body: JSON.stringify({
        number: formattedPhone
      })
    });

    if (!response.ok) {
      console.error('Evolution API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ profilePictureUrl: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('Profile picture response:', data);

    // A Evolution API retorna { profilePictureUrl: "url" } ou null
    return new Response(
      JSON.stringify({ 
        profilePictureUrl: data?.profilePictureUrl || data?.url || null 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching profile picture:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage, profilePictureUrl: null }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
