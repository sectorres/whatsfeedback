import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { password } = await req.json();

    if (!password) {
      return new Response(
        JSON.stringify({ success: false, error: 'Senha é obrigatória' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate admin password
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: 'admin@admin.com',
      password: password,
    });

    if (authError || !authData.user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Senha incorreta para admin@admin.com' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('Admin authenticated, proceeding with data deletion');

    // Delete data from all tables except users and configurations
    const tables = [
      'satisfaction_insights',
      'satisfaction_surveys',
      'campaign_sends',
      'campaigns',
      'messages',
      'conversations',
      'blacklist',
    ];

    for (const table of tables) {
      const { error: deleteError } = await supabaseAdmin
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (deleteError) {
        console.error(`Error deleting from ${table}:`, deleteError);
        throw new Error(`Erro ao limpar tabela ${table}: ${deleteError.message}`);
      }
      
      console.log(`Successfully cleared table: ${table}`);
    }

    console.log('All data cleared successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Dados limpos com sucesso' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in clear-data function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro ao limpar dados'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
