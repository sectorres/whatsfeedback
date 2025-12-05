// @ts-nocheck
// v2 - Forçar reimplantação
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
  // Nova variável de data de entrega
  deliveryDate: z.string().max(20).nullish(),
  // Dados completos do pedido
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

    // Validate input
    const validationResult = campaignSendSchema.safeParse(body);
    if (!validationResult.success) {
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
      deliveryDate, // Nova variável
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

    if (!campaignId || !customerPhone || !message) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes (campaignId, customerPhone, message)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normalizar telefone para garantir formato consistente
    const normalizedPhone = normalizePhone(customerPhone);

    console.log("campaign-send: prepared insert", {
      campaignId,
      customerPhone,
      normalizedPhone,
      deliveryDate,
      quantidade_entregas,
      quantidade_skus,
      quantidade_itens,
      peso_total,
      valor_total,
    });

    // 1) Inserir registro como pending com dados completos do pedido
    const { data: sendRow, error: insertError } = await supabase
      .from("campaign_sends")
      .insert({
        campaign_id: campaignId,
        customer_name: customerName ?? "Cliente",
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

    // 2) Verificar qual tipo de API está sendo usada
    const credentials = await getEvolutionCredentials();
    
    let sendError: Error | null = null;
    
    if (credentials.isOfficial && credentials.templateName) {
      // API Oficial: enviar template
      console.log("Using official API - sending template:", credentials.templateName);
      
      const bodyForTemplate = {
        phone: normalizedPhone,
        customerName: customerName || "Cliente",
        pedidoNumero: pedido_numero || "",
        deliveryDate: deliveryDate || "", // Passando a nova variável
      };
      console.log("Invoking whatsapp-send-template with body:", JSON.stringify(bodyForTemplate));

      const { error } = await supabase.functions.invoke("whatsapp-send-template", {
        body: bodyForTemplate,
      });
      
      if (error) {
        sendError = error;
      }
    } else {
      // API Não Oficial: enviar mensagem de texto normal
      console.log("Using unofficial API - sending text message");
      
      // Re-formatar a mensagem no backend para garantir que as variáveis sejam substituídas
      const fullMessage = message
        .replace(/{cliente}/g, customerName || "Cliente")
        .replace(/{pedido}/g, pedido_numero || "")
        .replace(/{data_entrega}/g, deliveryDate || "em breve")
        .replace(/{valor}/g, `${valor_total?.toFixed(2) || "0.00"}`)
        .replace(/{notaFiscal}/g, nota_fiscal || "");

      const { error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          phone: normalizedPhone,
          message: fullMessage,
        },
      });
      
      if (error) {
        sendError = error;
      }
    }

    if (sendError) {
      // 4a) Atualizar para failed
      await supabase
        .from("campaign_sends")
        .update({ status: "failed", error_message: sendError.message || String(sendError) })
        .eq("id", sendRow.id);

      return new Response(
        JSON.stringify({
          success: false,
          send_id: sendRow.id,
          status: "failed",
          error: sendError.message || String(sendError),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4b) Atualizar para success
    await supabase
      .from("campaign_sends")
      .update({ status: "success", error_message: null, sent_at: new Date().toISOString() })
      .eq("id", sendRow.id);


    return new Response(JSON.stringify({ success: true, send_id: sendRow.id, status: "success" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro em campaign-send:", error);
    const message =
      error && typeof error === "object" && "message" in (error as any)
        ? (error as any).message
        : error instanceof Error
          ? error.message
          : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});