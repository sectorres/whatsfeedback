import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    // Get client IP from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                     req.headers.get('x-real-ip') || 
                     'unknown';

    console.log('Login attempt from IP:', clientIp);
    console.log('Email:', email);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if IP is in the allowed list
    const { data: allowedIps, error: ipCheckError } = await supabase
      .from('allowed_ips')
      .select('ip_address')
      .eq('ip_address', clientIp);

    if (ipCheckError) {
      console.error('Error checking IP:', ipCheckError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao verificar IP',
          details: ipCheckError.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If no IPs found, deny access
    if (!allowedIps || allowedIps.length === 0) {
      console.log('IP not allowed:', clientIp);
      return new Response(
        JSON.stringify({ 
          error: 'Acesso negado. Seu endereço IP não está autorizado a fazer login.',
          ip: clientIp
        }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('IP allowed, proceeding with login');

    // IP is allowed, proceed with login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ 
          error: authError.message 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Login successful for:', email);

    return new Response(
      JSON.stringify({ 
        session: authData.session,
        user: authData.user 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
