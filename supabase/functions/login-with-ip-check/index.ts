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

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IP from various possible headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('x-real-ip') ||
                     req.headers.get('cf-connecting-ip') ||
                     'unknown';

    console.log('Login attempt from IP:', clientIp);

    // Initialize Supabase client with service role to check IPs
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if IP is in allowed list
    const { data: allowedIps, error: ipError } = await supabaseAdmin
      .from('allowed_ips')
      .select('ip_address')
      .eq('ip_address', clientIp);

    if (ipError) {
      console.error('Error checking IP:', ipError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões de acesso' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there are any IPs in the whitelist
    const { count: totalIps } = await supabaseAdmin
      .from('allowed_ips')
      .select('*', { count: 'exact', head: true });

    // Only enforce IP check if there are IPs in the whitelist
    if (totalIps && totalIps > 0 && (!allowedIps || allowedIps.length === 0)) {
      console.log('IP not allowed:', clientIp);
      return new Response(
        JSON.stringify({ 
          error: 'Acesso negado: seu endereço IP não está autorizado para fazer login',
          ip: clientIp
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If IP is allowed (or no IPs configured), proceed with login
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Login successful from IP:', clientIp);

    return new Response(
      JSON.stringify({ 
        session: data.session,
        user: data.user,
        ip: clientIp
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao processar requisição' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});