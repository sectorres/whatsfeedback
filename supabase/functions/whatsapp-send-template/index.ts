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
    const { phone, customerName, pedidoNumero, skip_message_save, conversation_id } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Obter credenciais da Evolution API
    const credentials = await getEvolutionCredentials();
    
    if (!credentials.isOfficial || !credentials.templateName) {
      return new Response(JSON.stringify({ error: "Template sending only available for official API" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { apiUrl, apiKey, instanceName, templateName, templateLanguage } = credentials;

    // Normalizar telefone e formatar para WhatsApp (com código do país)
    const normalizedPhone = normalizePhone(phone);
    const whatsappPhone = `55${normalizedPhone}`;

    console.log("Sending template message:", {
      phone: whatsappPhone,
      templateName,
      templateLanguage,
      customerName,
      pedidoNumero
    });

    // Montar payload do template
    // Se o template não usa parâmetros numerados ({{1}}, {{2}}), enviar sem components
    const templatePayload: Record<string, unknown> = {
      number: whatsappPhone,
      name: templateName,
      language: templateLanguage || "pt_BR",
    };

    // Só adiciona components se houver parâmetros para enviar
    // O template atual do usuário não usa parâmetros numerados
    // Para templates com parâmetros, o usuário precisaria cadastrar com {{1}}, {{2}}, etc.

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
      console.error("Template send error:", templateResult);
      return new Response(JSON.stringify({ 
        error: "Failed to send template", 
        details: templateResult 
      }), {
        status: templateResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Template sent successfully:", templateResult);

    // Salvar mensagem no banco se necessário
    if (!skip_message_save) {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      
      if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        
        // Construir texto do template para exibição
        const templateText = `Olá ${customerName || "Cliente"},\n\n*Seu pedido ${pedidoNumero || ""} será entregue amanhã no horário comercial.*\n\nIMPORTANTE:\n✅ Ter alguém maior de 18 anos para receber\n✅ Conferir a mercadoria no ato da entrega\n\nPor favor, confirme se poderá receber sua mercadoria:\n\n1️⃣  Confirmar\n2️⃣  Reagendar\n3️⃣  Parar de enviar notificação`;

        // Buscar ou criar conversa
        let convId = conversation_id;
        
        if (!convId) {
          // Buscar conversa existente
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("customer_phone", normalizedPhone)
            .maybeSingle();

          if (existingConv) {
            convId = existingConv.id;
            // Atualizar para ativa
            await supabase
              .from("conversations")
              .update({ 
                status: "active", 
                last_message_at: new Date().toISOString() 
              })
              .eq("id", convId);
          } else {
            // Criar nova conversa
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                customer_phone: normalizedPhone,
                customer_name: customerName || "Cliente",
                status: "active",
              })
              .select()
              .single();

            if (newConv) {
              convId = newConv.id;
            }
          }
        }

        // Inserir mensagem
        if (convId) {
          await supabase.from("messages").insert({
            conversation_id: convId,
            message_text: templateText,
            sender_type: "bot",
            sender_name: "Sistema",
            whatsapp_message_id: templateResult?.key?.id || null,
          });
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      result: templateResult 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in whatsapp-send-template:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
