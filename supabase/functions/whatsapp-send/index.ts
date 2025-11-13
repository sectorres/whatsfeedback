import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { formatPhoneForWhatsApp } from "../_shared/phone-utils.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const whatsappSendSchema = z.object({
  phone: z.string().min(10).max(20),
  message: z.string().min(1).max(4096),
  buttons: z
    .array(
      z.object({
        displayText: z.string(),
        id: z.string(),
      }),
    )
    .optional(),
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
    const body = await req.json();

    // Validar entrada
    const validationResult = whatsappSendSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(JSON.stringify({ error: "Dados inválidos", details: validationResult.error.errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone, message, buttons } = validationResult.data;
    const EVOLUTION_API_URL = Deno.env.get("EVOLUTION_API_URL");
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    const EVOLUTION_INSTANCE_NAME = Deno.env.get("EVOLUTION_INSTANCE_NAME");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
      throw new Error("Evolution API credentials not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    console.log("Sending WhatsApp message:", { phone, messageLength: message.length });

    // Normalizar número
    const cleanPhone = formatPhoneForWhatsApp(phone);
    console.log("Normalized phone:", cleanPhone);

    if (cleanPhone.length < 12 || cleanPhone.length > 13) {
      console.error("Invalid phone number length:", {
        original: phone,
        cleaned: cleanPhone,
        length: cleanPhone.length,
      });
      throw new Error("Telefone inválido: formato incorreto ou dígitos faltando");
    }

    // Verificar blacklist
    const blacklistResponse = await fetch(`${SUPABASE_URL}/rest/v1/blacklist?phone=eq.${cleanPhone}`, {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (blacklistResponse.ok) {
      const blacklistData = await blacklistResponse.json();
      if (blacklistData && blacklistData.length > 0) {
        console.log("Phone is blacklisted:", cleanPhone);
        throw new Error("Número bloqueado pela blacklist");
      }
    }

    // Enviar via Evolution API
    let response;

    if (buttons && buttons.length > 0) {
      console.log("Sending message with buttons:", { phone: cleanPhone, buttonsCount: buttons.length, buttons });

      // ✅ Formato correto Evolution API 2.3.6
      const buttonPayload = {
        number: cleanPhone,
        options: {
          delay: 1200,
          presence: "composing",
        },
        message: {
          text: message, // texto principal
          footer: "Equipe VivaMais", // opcional
          buttons: buttons.map((btn) => ({
            id: btn.id,
            text: btn.displayText,
          })),
        },
      };

      console.log("Button payload (v2.3.6):", JSON.stringify(buttonPayload, null, 2));

      response = await fetch(`${EVOLUTION_API_URL}/message/sendButtons/${EVOLUTION_INSTANCE_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify(buttonPayload),
      });
    } else {
      // Enviar texto simples
      const textPayload = {
        number: cleanPhone,
        text: message,
      };

      response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify(textPayload),
      });
    }

    const data = await response.json();
    console.log("Send message response:", JSON.stringify(data, null, 2));
    console.log("Response status:", response.status);

    if (!response.ok) {
      // Verificar erros específicos
      if (data.response?.message && Array.isArray(data.response.message)) {
        const notFound = data.response.message.find((m: any) => m.exists === false);
        if (notFound) {
          throw new Error(`Número ${notFound.number} não possui WhatsApp ativo`);
        }
      }

      if (data.response?.message === "Timed Out") {
        throw new Error("Timeout ao enviar mensagem. Tente novamente em alguns segundos.");
      }

      throw new Error(data.response?.message || data.message || "Falha ao enviar mensagem");
    }

    return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error in whatsapp-send:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
