import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaToken = Deno.env.get('META_GRAPH_API_TOKEN');
    const wabaId = Deno.env.get('META_WABA_ID');

    if (!metaToken || !wabaId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Token da Meta ou WABA ID não configurados' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all templates that have been submitted
    const { data: templates, error: fetchError } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .not('meta_template_id', 'is', null)
      .in('meta_status', ['in_review', 'pending']);

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar templates' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ success: true, updated: 0, message: 'Nenhum template para atualizar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all templates from Meta API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates?limit=100`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${metaToken}`
        }
      }
    );

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      console.error('Meta API error:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: errorData.error?.message || 'Erro na API da Meta' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const metaData = await metaResponse.json();
    const metaTemplates = metaData.data || [];

    console.log(`Found ${metaTemplates.length} templates from Meta API`);

    let updatedCount = 0;

    for (const template of templates) {
      // Find matching template in Meta response
      const metaTemplate = metaTemplates.find(
        (mt: any) => mt.id === template.meta_template_id || mt.name === template.template_name
      );

      if (metaTemplate) {
        const newStatus = metaTemplate.status?.toLowerCase() || template.meta_status;
        const rejectionReason = metaTemplate.quality_score?.reasons?.join(', ') || null;

        // Update if status changed
        if (newStatus !== template.meta_status) {
          const updateData: any = {
            meta_status: newStatus,
            meta_template_id: metaTemplate.id
          };

          if (newStatus === 'approved') {
            updateData.approved_at = new Date().toISOString();
          }

          if (newStatus === 'rejected' && rejectionReason) {
            updateData.meta_rejection_reason = rejectionReason;
          }

          await supabase
            .from('whatsapp_templates')
            .update(updateData)
            .eq('id', template.id);

          updatedCount++;
          console.log(`Updated template ${template.template_name} to status ${newStatus}`);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, updated: updatedCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error syncing template status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
