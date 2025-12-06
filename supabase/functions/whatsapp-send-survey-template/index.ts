// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
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
    const { phone, customerName, pedidoNumero, driverName } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obter credenciais da Evolution API (inclui survey template config)
    const credentials = await getEvolutionCredentials();

    // Usar o template configurado no banco ou fallback para o padrão
    const SURVEY_TEMPLATE_NAME = credentials.surveyTemplateName || "entrega_realizada";
    const SURVEY_TEMPLATE_LANGUAGE = credentials.surveyTemplateLanguage || credentials.templateLanguage || "pt_BR";

    if (!credentials.isOfficial) {
      return new Response(JSON.stringify({ error: "Survey template sending only available for official API" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { apiUrl, apiKey, instanceName } = credentials;

    // Normalizar telefone e formatar para WhatsApp (com código do país)
    const normalizedPhone = normalizePhone(phone);
    const whatsappPhone = `55${normalizedPhone}`;

    console.log("Sending survey template message:", {
      phone: whatsappPhone,
      templateName: SURVEY_TEMPLATE_NAME,
      templateLanguage: SURVEY_TEMPLATE_LANGUAGE,
      customerName,
      pedidoNumero,
      driverName,
    });

    // Montar payload do template
    // CORREÇÃO: Enviar APENAS 1 parâmetro (nome do cliente)
    const templatePayload: Record<string, unknown> = {
      number: whatsappPhone,
      name: SURVEY_TEMPLATE_NAME,
      language: SURVEY_TEMPLATE_LANGUAGE,
      components: [
        {
          type: "body",
          parameters: [
            // Parâmetro {{1}} para o nome do cliente (único parâmetro esperado)
            { type: "text", text: customerName || "Cliente" },
          ],
        },
      ],
    };

    // Enviar template via Evolution API
    const templateResponse = await fetch(`${apiUrl}/message/sendTemplate/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(templatePayload),
    });

    const templateResult = await templateResponse.json();

    if (!templateResponse.ok) {
      console.error("Survey template send error:", templateResult);
      return new Response(
        JSON.stringify({
          error: "Failed to send survey template",
          details: templateResult,
        }),
        {
          status: templateResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Survey template sent successfully:", templateResult);

    return new Response(
      JSON.stringify({
        success: true,
        result: templateResult,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in whatsapp-send-survey-template:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
