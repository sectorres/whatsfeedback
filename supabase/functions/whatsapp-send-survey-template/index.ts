import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone-utils.ts";
import { getEvolutionCredentials } from "../_shared/evolution-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, customerName } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obter credenciais da Evolution API
    const credentials = await getEvolutionCredentials();
    
    if (!credentials.isOfficial || !credentials.surveyTemplateName) {
      return new Response(JSON.stringify({ error: "Survey template sending only available for official API" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { apiUrl, apiKey, instanceName, surveyTemplateName, surveyTemplateLanguage } = credentials;

    // Normalizar telefone e formatar para WhatsApp (com código do país)
    const normalizedPhone = normalizePhone(phone);
    const whatsappPhone = `55${normalizedPhone}`;

    console.log("Sending survey template message:", {
      phone: whatsappPhone,
      templateName: surveyTemplateName,
      templateLanguage: surveyTemplateLanguage,
      customerName,
    });

    // Montar payload do template
    // O template de pesquisa de satisfação geralmente tem apenas um parâmetro: o nome do cliente
    const templatePayload: Record<string, unknown> = {
      number: whatsappPhone,
      name: surveyTemplateName,
      language: surveyTemplateLanguage || "pt_BR",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: customerName || "Cliente" },
          ]
        }
      ]
    };

    // Enviar template via Evolution API
    const templateResponse = await fetch(`${apiUrl}/message/sendTemplate/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(templatePayload),
    });

    const templateResult = await templateResponse.json();

    if (!templateResponse.ok) {
      console.error("Survey template send error:", templateResult);
      return new Response(JSON.stringify({ 
        error: "Failed to send survey template", 
        details: templateResult 
      }), {
        status: templateResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Survey template sent successfully:", templateResult);

    return new Response(JSON.stringify({ 
      success: true, 
      result: templateResult 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in whatsapp-send-survey-template:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});