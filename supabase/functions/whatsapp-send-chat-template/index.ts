import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getEvolutionCredentials } from "../_shared/evolution-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendChatTemplateRequest {
  phone: string;
  templateName: string;
  templateLanguage: string;
  parameters: string[];
  conversationId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, templateName, templateLanguage, parameters, conversationId }: SendChatTemplateRequest = await req.json();

    console.log('Enviando template via chat:', { phone, templateName, templateLanguage, parameters });

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obter credenciais da Evolution API
    const credentials = await getEvolutionCredentials();
    
    if (!credentials.isOfficial) {
      throw new Error('Envio de templates só está disponível para API oficial');
    }

    const { apiUrl, apiKey, instanceName } = credentials;

    // Formatar número de telefone
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    // Preparar payload do template
    const templatePayload: any = {
      number: formattedPhone,
      name: templateName,
      language: templateLanguage,
    };

    // Adicionar parâmetros se existirem
    if (parameters && parameters.length > 0) {
      templatePayload.components = [
        {
          type: "body",
          parameters: parameters.map(p => ({
            type: "text",
            text: p
          }))
        }
      ];
    }

    console.log('Template payload:', JSON.stringify(templatePayload, null, 2));

    // Enviar template via Evolution API - endpoint correto é /message/sendTemplate/
    const response = await fetch(`${apiUrl}/message/sendTemplate/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(templatePayload),
    });

    const responseData = await response.json();
    console.log('Resposta Evolution API:', JSON.stringify(responseData, null, 2));

    if (!response.ok) {
      throw new Error(`Erro na Evolution API: ${responseData.message || JSON.stringify(responseData)}`);
    }

    // Buscar o texto do template para salvar na mensagem
    const { data: templateData } = await supabase
      .from('whatsapp_templates')
      .select('body_text')
      .eq('template_name', templateName)
      .eq('language', templateLanguage)
      .maybeSingle();

    // Substituir variáveis no texto para exibição
    let messageText = templateData?.body_text || `[Template: ${templateName}]`;
    if (parameters && parameters.length > 0) {
      parameters.forEach((param, index) => {
        messageText = messageText.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), param);
      });
    }

    // Salvar mensagem no banco
    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'operator',
        sender_name: 'Operador',
        message_text: `📋 ${messageText}`,
        message_status: 'sent',
        whatsapp_message_id: responseData?.key?.id || null
      });

    if (messageError) {
      console.error('Erro ao salvar mensagem:', messageError);
    }

    // Atualizar timestamp da conversa
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Template enviado com sucesso',
        data: responseData 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro ao enviar template:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro desconhecido' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
