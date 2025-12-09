// v5 - Forced Update for 3 Params Template
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhone } from "../_shared/phone-utils.ts";
import { getEvolutionCredentials } from "../_shared/evolution-config.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const campaignSendSchema = z.object({
  campaignId: z.string().uuid(),
  customerPhone: z.string().min(10).max(20),
  message: z.string().min(1).max(4096),
  customerName: z.string().max(255).nullish(),
  driverName: z.string().max(255).nullish(),
  quantidade_entregas: z
    .number()
    .min(0)
    .max(10000)
    .transform((val) => Math.round(val))
    .nullish(),
  quantidade_skus: z
    .number()
    .min(0)
    .max(10000)
    .transform((val) => Math.round(val))
    .nullish(),
  quantidade_itens: z
    .number()
    .min(0)
    .max(100000)
    .transform((val) => Math.round(val))
    .nullish(),
  peso_total: z.number().min(0).max(1000000).nullish(),
  valor_total: z.number().min(0).max(10000000).nullish(),
  pedido_id: z.number().int().positive().nullish(),
  pedido_numero: z.string().max(50).nullish(),
  carga_id: z.number().int().positive().nullish(),
  deliveryDate: z.string().max(20).nullish(),
  nota_fiscal: z.string().max(50).nullish(),
  data_pedido: z.string().max(20).nullish(),
  rota: z.string().max(255).nullish(),
  endereco_completo: z.string().max(500).nullish(),
  bairro: z.string().max(255).nullish(),
  cep: z.string().max(20).nullish(),
  cidade: z.string().max(255).nullish(),
  estado: z.string().max(2).nullish(),
  referencia: z.string().max(500).nullish(),
  produtos: z.array(z.any()).nullish(),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Backend credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    console.log("--- CAMPAIGN-SEND V5 STARTED ---");
    // console.log(JSON.stringify(body)); // Uncomment for full debug

    const validationResult = campaignSendSchema.safeParse(body);

    if (!validationResult.success) {
      console.error("Validation error:", validationResult.error);
      return new Response(JSON.stringify({ error: "Dados inválidos", details: validationResult.error.errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      campaignId,
      customerName,
      customerPhone,
      message,
      driverName,
      peso_total,
      valor_total,
      quantidade_entregas,
      quantidade_skus,
      quantidade_itens,
      pedido_id,
      pedido_numero,
      carga_id,
      deliveryDate,
      nota_fiscal,
      data_pedido,
      rota,
      endereco_completo,
      bairro,
      cep,
      cidade,
      estado,
      referencia,
      produtos,
    } = validationResult.data;

    const normalizedPhone = normalizePhone(customerPhone);

    // Garantir que temos 3 parâmetros para o template
    const param1_name = customerName || "Cliente";
    const param2_pedido = pedido_numero || "seu pedido";
    // Se deliveryDate não vier, usa a data de hoje formatada
    const param3_date = deliveryDate || new Date().toLocaleDateString("pt-BR");

    console.log(`Params prepared: 1="${param1_name}", 2="${param2_pedido}", 3="${param3_date}"`);

    const { data: sendRow, error: insertError } = await supabase
      .from("campaign_sends")
      .insert({
        campaign_id: campaignId,
        customer_name: param1_name,
        customer_phone: normalizedPhone,
        message_sent: message,
        status: "pending",
        driver_name: driverName ?? null,
        peso_total: peso_total ?? 0,
        valor_total: valor_total ?? 0,
        quantidade_entregas: quantidade_entregas ?? 1,
        quantidade_skus: quantidade_skus ?? 0,
        quantidade_itens: quantidade_itens ?? 0,
        pedido_id: pedido_id ?? null,
        pedido_numero: pedido_numero ?? null,
        carga_id: carga_id ?? null,
        nota_fiscal: nota_fiscal ?? null,
        data_pedido: data_pedido ?? null,
        rota: rota ?? null,
        endereco_completo: endereco_completo ?? null,
        bairro: bairro ?? null,
        cep: cep ?? null,
        cidade: cidade ?? null,
        estado: estado ?? null,
        referencia: referencia ?? null,
        produtos: produtos ?? null,
      })
      .select()
      .single();

    if (insertError || !sendRow) {
      throw insertError || new Error("Falha ao criar registro de envio");
    }

    const credentials = await getEvolutionCredentials();
    let sendError: Error | null = null;

    try {
      if (credentials.isOfficial) {
        // Usar o template configurado na interface (evolution_api_config)
        const TEMPLATE_NAME = credentials.templateName || "aviso_entrega_2";
        const TEMPLATE_LANGUAGE = credentials.templateLanguage || "pt_BR";
        const whatsappPhone = `55${normalizedPhone}`;

        // Payload estrito com 3 parâmetros
        const templatePayload = {
          number: whatsappPhone,
          name: TEMPLATE_NAME,
          language: TEMPLATE_LANGUAGE,
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: param1_name },
                { type: "text", text: param2_pedido },
                { type: "text", text: param3_date },
              ],
            },
          ],
        };

        console.log("Sending Official Template:", JSON.stringify(templatePayload));

        const templateResponse = await fetch(`${credentials.apiUrl}/message/sendTemplate/${credentials.instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: credentials.apiKey },
          body: JSON.stringify(templatePayload),
        });

        const templateResult = await templateResponse.json();

        if (!templateResponse.ok) {
          console.error("Template Send Error:", templateResult);
          throw new Error(JSON.stringify(templateResult) || "Failed to send template");
        }

        console.log("Template sent successfully:", templateResult);
      } else {
        // Fallback para API não oficial (texto simples)
        const fullMessage = message
          .replace(/{cliente}/g, param1_name)
          .replace(/{pedido}/g, param2_pedido)
          .replace(/{data_entrega}/g, param3_date)
          .replace(/{valor}/g, `${valor_total?.toFixed(2) || "0.00"}`)
          .replace(/{notaFiscal}/g, nota_fiscal || "");

        console.log("Sending Text Message via Unofficial API");
        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: { phone: normalizedPhone, message: fullMessage },
        });
        if (error) throw error;
      }
    } catch (error) {
      sendError = error;
    }

    if (sendError) {
      await supabase
        .from("campaign_sends")
        .update({ status: "failed", error_message: sendError.message || String(sendError) })
        .eq("id", sendRow.id);
      throw sendError;
    }

    await supabase
      .from("campaign_sends")
      .update({ status: "success", error_message: null, sent_at: new Date().toISOString() })
      .eq("id", sendRow.id);

    return new Response(JSON.stringify({ success: true, send_id: sendRow.id, status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro em campaign-send:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
