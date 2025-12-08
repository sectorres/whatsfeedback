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

    console.log('Fetching templates from Meta API for WABA:', wabaId);

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

    let importedCount = 0;
    let updatedCount = 0;

    for (const metaTemplate of metaTemplates) {
      // Extract body text and variables from components
      let headerText = null;
      let bodyText = '';
      let footerText = null;
      const variables: Array<{ index: number; type: string; example: string; description: string }> = [];

      if (metaTemplate.components) {
        for (const component of metaTemplate.components) {
          if (component.type === 'HEADER' && component.format === 'TEXT') {
            headerText = component.text;
          } else if (component.type === 'BODY') {
            bodyText = component.text || '';
            // Extract variable examples if available
            if (component.example?.body_text?.[0]) {
              const examples = component.example.body_text[0];
              examples.forEach((example: string, index: number) => {
                variables.push({
                  index: index + 1,
                  type: 'text',
                  example: example,
                  description: `Variável ${index + 1}`
                });
              });
            }
          } else if (component.type === 'FOOTER') {
            footerText = component.text;
          }
        }
      }

      // Determine category based on template name or default
      let category = 'delivery_notification';
      const nameLower = metaTemplate.name.toLowerCase();
      if (nameLower.includes('pesquisa') || nameLower.includes('satisf') || nameLower.includes('survey')) {
        category = 'satisfaction_survey';
      }

      // Check if template already exists in database
      const { data: existingTemplate } = await supabase
        .from('whatsapp_templates')
        .select('id')
        .eq('template_name', metaTemplate.name)
        .eq('language', metaTemplate.language)
        .maybeSingle();

      const templateData = {
        template_name: metaTemplate.name,
        template_type: metaTemplate.category || 'UTILITY',
        category,
        language: metaTemplate.language,
        header_text: headerText,
        body_text: bodyText,
        footer_text: footerText,
        variables: variables,
        meta_template_id: metaTemplate.id,
        meta_status: metaTemplate.status?.toLowerCase() || 'approved',
        submitted_at: new Date().toISOString(),
        approved_at: metaTemplate.status === 'APPROVED' ? new Date().toISOString() : null
      };

      if (existingTemplate) {
        // Update existing template
        await supabase
          .from('whatsapp_templates')
          .update({
            meta_template_id: metaTemplate.id,
            meta_status: metaTemplate.status?.toLowerCase() || 'approved',
            approved_at: metaTemplate.status === 'APPROVED' ? new Date().toISOString() : null
          })
          .eq('id', existingTemplate.id);
        updatedCount++;
      } else {
        // Insert new template
        const { error: insertError } = await supabase
          .from('whatsapp_templates')
          .insert(templateData);

        if (insertError) {
          console.error('Error inserting template:', metaTemplate.name, insertError);
        } else {
          importedCount++;
        }
      }
    }

    console.log(`Imported ${importedCount} new templates, updated ${updatedCount} existing templates`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        imported: importedCount,
        updated: updatedCount,
        total: metaTemplates.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error fetching Meta templates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
