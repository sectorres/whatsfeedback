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
    // Apenas desestruture os parâmetros que realmente precisamos.
    const { phone, customerName, pedidoNumero } = await req.json();

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

    // Consultar o template no banco para verificar variáveis e mapeamento
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: templateData, error: templateError } = await supabase
      .from("whatsapp_templates")
      .select("variables, body_text")
      .eq("template_name", SURVEY_TEMPLATE_NAME)
      .single();

    interface TemplateVariable {
      index: number;
      type: string;
      example: string;
      description: string;
      mapping?: string;
    }

    let variables: TemplateVariable[] = [];
    let variableCount = 0;
    
    if (templateData) {
      // Usar variáveis do template com mapeamento
      if (templateData.variables && Array.isArray(templateData.variables)) {
        variables = templateData.variables as TemplateVariable[];
        variableCount = variables.length;
      }
      // Fallback: contar {{n}} no body_text se variables estiver vazio
      if (variableCount === 0 && templateData.body_text) {
        const matches = templateData.body_text.match(/\{\{\d+\}\}/g);
        variableCount = matches ? matches.length : 0;
      }
      console.log(`Template "${SURVEY_TEMPLATE_NAME}" has ${variableCount} variable(s)`);
    } else {
      console.log(`Template "${SURVEY_TEMPLATE_NAME}" not found in database, assuming 1 variable`);
      variableCount = 1;
    }

    // Dados disponíveis para mapeamento
    const dataFields: Record<string, string> = {
      customer_name: customerName || "Cliente",
      pedido_numero: pedidoNumero || "Pedido",
    };

    // Normalizar telefone e formatar para WhatsApp (com código do país)
    const normalizedPhone = normalizePhone(phone);
    const whatsappPhone = `55${normalizedPhone}`;

    console.log("Sending survey template message:", {
      phone: whatsappPhone,
      templateName: SURVEY_TEMPLATE_NAME,
      templateLanguage: SURVEY_TEMPLATE_LANGUAGE,
      customerName,
      pedidoNumero,
      variableCount,
      variables: variables.map(v => ({ index: v.index, mapping: v.mapping })),
    });

    // Montar payload do template respeitando o mapeamento de variáveis
    const templatePayload: Record<string, unknown> = {
      number: whatsappPhone,
      name: SURVEY_TEMPLATE_NAME,
      language: SURVEY_TEMPLATE_LANGUAGE,
    };

    // Só adiciona components se houver variáveis
    if (variableCount > 0) {
      const parameters: Array<{ type: string; text: string }> = [];
      
      // Ordenar variáveis por índice
      const sortedVariables = [...variables].sort((a, b) => a.index - b.index);
      
      for (let i = 0; i < variableCount; i++) {
        const variable = sortedVariables[i];
        let value = "-";
        
        if (variable?.mapping && dataFields[variable.mapping]) {
          // Usar valor do campo mapeado
          value = dataFields[variable.mapping];
        } else {
          // Fallback para comportamento padrão baseado na posição
          if (i === 0) {
            value = customerName || "Cliente";
          } else if (i === 1) {
            value = pedidoNumero || "Pedido";
          }
        }
        
        parameters.push({ type: "text", text: value });
      }

      templatePayload.components = [
        {
          type: "body",
          parameters,
        },
      ];
    }

    console.log("Template payload:", JSON.stringify(templatePayload, null, 2));

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

    // Logar o resultado, seja sucesso ou erro
    console.log("Survey template sent result:", templateResult);

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
