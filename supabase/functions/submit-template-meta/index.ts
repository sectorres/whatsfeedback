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
    const { templateId } = await req.json();

    if (!templateId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Template ID é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const metaToken = Deno.env.get('META_GRAPH_API_TOKEN');

    if (!metaToken) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token da Meta Graph API não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch template from database
    const { data: template, error: fetchError } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (fetchError || !template) {
      console.error('Template not found:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Template não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get WhatsApp Business Account ID from Evolution API config
    const { data: evolutionConfig } = await supabase
      .from('evolution_api_config')
      .select('*')
      .eq('is_active', true)
      .eq('config_type', 'official')
      .maybeSingle();

    // Extract WABA ID from instance name or use default
    // The user needs to configure this - we'll use a placeholder format
    const wabaId = Deno.env.get('META_WABA_ID');
    
    if (!wabaId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'WABA ID não configurado. Configure o META_WABA_ID nos secrets.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Build components array following Meta's format
    const components: any[] = [];

    // Header component (if exists)
    if (template.header_text) {
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: template.header_text
      });
    }

    // Body component (required)
    const variables = template.variables as Array<{ index: number; example: string; description: string }> || [];
    const bodyComponent: any = {
      type: "BODY",
      text: template.body_text
    };

    // Add example values for variables if any
    if (variables.length > 0) {
      bodyComponent.example = {
        body_text: [variables.map(v => v.example)]
      };
    }
    components.push(bodyComponent);

    // Footer component (if exists)
    if (template.footer_text) {
      components.push({
        type: "FOOTER",
        text: template.footer_text
      });
    }

    // Build the template payload for Meta Graph API
    const payload = {
      name: template.template_name,
      language: template.language,
      category: "UTILITY", // Always UTILITY, never MARKETING
      components
    };

    console.log('Submitting template to Meta:', JSON.stringify(payload, null, 2));

    // Submit to Meta Graph API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}/message_templates`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const metaData = await metaResponse.json();
    console.log('Meta API response:', JSON.stringify(metaData, null, 2));

    if (!metaResponse.ok) {
      // Extract user-friendly error message from Meta response
      const errorMessage = metaData.error?.error_user_msg || 
                          metaData.error?.message || 
                          'Erro ao enviar para a Meta';
      
      // Update template with error
      await supabase
        .from('whatsapp_templates')
        .update({
          meta_status: 'rejected',
          meta_rejection_reason: errorMessage,
          submitted_at: new Date().toISOString()
        })
        .eq('id', templateId);

      return new Response(
        JSON.stringify({ success: false, error: errorMessage }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Update template with Meta response
    await supabase
      .from('whatsapp_templates')
      .update({
        meta_template_id: metaData.id,
        meta_status: metaData.status?.toLowerCase() || 'in_review',
        submitted_at: new Date().toISOString()
      })
      .eq('id', templateId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        metaTemplateId: metaData.id,
        status: metaData.status 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error submitting template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
