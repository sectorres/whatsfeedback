import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Produto {
  id: number;
  descricao: string;
  quantidade: number;
  pesoBruto?: number;
}

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  celular: string;
  cep?: string;
  endereco?: string;
  referencia?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  observacao?: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal?: string;
  data: string;
  status?: string;
  pesoBruto?: number;
  valor?: number;
  rota?: string;
  cliente: Cliente;
  produtos: Produto[];
}

interface Carga {
  id: number;
  data: string;
  status: string;
  motorista: number;
  nomeMotorista: string;
  pedidos: Pedido[];
}

interface RestrictedDriver {
  name: string;
}

interface RestrictedOrderPrefix {
  prefix: string;
}

// Extract serie from pedido (e.g., "001/0262558-P" → "P") or notaFiscal (e.g., "002/0140826-N" → "N")
function extractSerie(value: string | undefined): string {
  if (!value) return "";
  const parts = value.split("-");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

function normalizePhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("55") && cleaned.length > 11) {
    cleaned = cleaned.substring(2);
  }
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

function formatPhoneForWhatsApp(phone: string): string {
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith("55")) {
    return "55" + normalized;
  }
  return normalized;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const API_URL = "https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1";
    const API_USERNAME = Deno.env.get("API_USERNAME");
    const API_PASSWORD = Deno.env.get("API_PASSWORD");

    if (!API_USERNAME || !API_PASSWORD) {
      throw new Error("API credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body for test mode
    const body = await req.json().catch(() => ({}));
    const testMode = body.testMode === true;
    const testPhone = body.testPhone || null;
    const forceStatus = body.forceStatus || null; // 'ABER' or 'FATU' for testing
    const specificOrder = body.specificOrder || null; // For test mode with specific order

    console.log("Auto template sender started", { testMode, testPhone, forceStatus, specificOrder });

    // Check if auto-send is enabled
    const { data: configEnabled } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "auto_template_enabled")
      .maybeSingle();

    if (!testMode && configEnabled?.config_value !== "true") {
      console.log("Auto template sending is disabled");
      return new Response(
        JSON.stringify({
          success: true,
          message: "Auto template sending is disabled",
          processed: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get min date config, template configs, and restricted drivers
    const { data: appConfigs } = await supabase
      .from("app_config")
      .select("config_key, config_value")
      .in("config_key", ["auto_template_min_date", "auto_template_aber", "auto_template_fatu", "auto_template_aber_enabled", "auto_template_fatu_enabled", "restricted_drivers", "restricted_order_prefixes"]);

    // Convert min date from YYYY-MM-DD to YYYYMMDD for comparison
    const minDateConfig = appConfigs?.find(c => c.config_key === "auto_template_min_date");
    const minDateValue = minDateConfig?.config_value || "";
    const minDateFormatted = minDateValue ? minDateValue.replace(/-/g, "") : "";

    // Get template names from config (with defaults)
    const templateAberConfig = appConfigs?.find(c => c.config_key === "auto_template_aber");
    const templateFatuConfig = appConfigs?.find(c => c.config_key === "auto_template_fatu");
    const TEMPLATE_ABER = templateAberConfig?.config_value || "em_processo_entrega";
    const TEMPLATE_FATU = templateFatuConfig?.config_value || "status4";

    // Get enabled/disabled flags for each template type (default to true if not configured)
    const templateAberEnabledConfig = appConfigs?.find(c => c.config_key === "auto_template_aber_enabled");
    const templateFatuEnabledConfig = appConfigs?.find(c => c.config_key === "auto_template_fatu_enabled");
    const TEMPLATE_ABER_ENABLED = templateAberEnabledConfig?.config_value !== "false";
    const TEMPLATE_FATU_ENABLED = templateFatuEnabledConfig?.config_value !== "false";

    // Get restricted drivers list
    const restrictedDriversConfig = appConfigs?.find(c => c.config_key === "restricted_drivers");
    let restrictedDrivers: RestrictedDriver[] = [];
    if (restrictedDriversConfig?.config_value) {
      try {
        restrictedDrivers = JSON.parse(restrictedDriversConfig.config_value);
      } catch {
        restrictedDrivers = [];
      }
    }
    const restrictedDriverNames = new Set(restrictedDrivers.map(d => d.name.toUpperCase()));

    // Get restricted order prefixes list (for ABER + Serie P)
    const restrictedPrefixesConfig = appConfigs?.find(c => c.config_key === "restricted_order_prefixes");
    let restrictedOrderPrefixes: RestrictedOrderPrefix[] = [];
    if (restrictedPrefixesConfig?.config_value) {
      try {
        restrictedOrderPrefixes = JSON.parse(restrictedPrefixesConfig.config_value);
      } catch {
        restrictedOrderPrefixes = [];
      }
    }
    const restrictedPrefixList = restrictedOrderPrefixes.map(p => p.prefix.toUpperCase());

    // Get template details to know how many variables each template expects and body text
    const { data: templateDetails } = await supabase
      .from("whatsapp_templates")
      .select("template_name, variables, body_text")
      .in("template_name", [TEMPLATE_ABER, TEMPLATE_FATU]);

    const templateVariablesMap: Record<string, number> = {};
    const templateBodyMap: Record<string, string> = {};
    templateDetails?.forEach(t => {
      const vars = t.variables as any[] || [];
      templateVariablesMap[t.template_name] = vars.length;
      templateBodyMap[t.template_name] = t.body_text || "";
    });

    // Helper function to save message to conversation - returns conversation ID
    async function saveToConversation(
      phone: string,
      customerName: string,
      templateName: string,
      templateParams: { type: string; text: string }[],
      isTest: boolean
    ): Promise<string | null> {
      const normalizedPhone = normalizePhone(phone);
      const bodyTemplate = templateBodyMap[templateName] || `[Template: ${templateName}]`;
      
      // Replace template variables with actual values
      let messageText = bodyTemplate;
      templateParams.forEach((param, index) => {
        messageText = messageText.replace(`{{${index + 1}}}`, param.text);
      });
      
      if (isTest) {
        messageText = `[TESTE] ${messageText}`;
      }

      // Find or create conversation
      let { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("customer_phone", normalizedPhone)
        .maybeSingle();

      if (!conversation) {
        const { data: newConversation } = await supabase
          .from("conversations")
          .insert({
            customer_phone: normalizedPhone,
            customer_name: customerName || "Cliente",
            status: "active",
            last_message_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        conversation = newConversation;
      } else {
        // Update conversation last message time
        await supabase
          .from("conversations")
          .update({ 
            last_message_at: new Date().toISOString(),
            status: "active"
          })
          .eq("id", conversation.id);
      }

      if (conversation) {
        // Insert message
        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_type: "bot",
          sender_name: "Envio Automático",
          message_text: messageText,
          message_status: "sent",
        });
        console.log(`Message saved to conversation ${conversation.id}`);
        return conversation.id;
      }
      return null;
    }

    // Find or create system campaign for FATU 050/ automatic sends (for response tracking)
    let systemCampaignId: string | null = null;
    const SYSTEM_CAMPAIGN_NAME = "[Sistema] Envio Automático FATU 050";
    
    const { data: existingCampaign } = await supabase
      .from("campaigns")
      .select("id")
      .eq("name", SYSTEM_CAMPAIGN_NAME)
      .maybeSingle();
    
    if (existingCampaign) {
      systemCampaignId = existingCampaign.id;
    } else {
      const { data: newCampaign } = await supabase
        .from("campaigns")
        .insert({
          name: SYSTEM_CAMPAIGN_NAME,
          message: "Envio automático de template FATU 050/",
          target_type: "automatic",
          status: "active",
        })
        .select("id")
        .single();
      systemCampaignId = newCampaign?.id || null;
    }
    
    console.log("System campaign for FATU 050:", systemCampaignId);

    console.log("Config loaded:", { minDateValue, minDateFormatted, TEMPLATE_ABER, TEMPLATE_FATU, TEMPLATE_ABER_ENABLED, TEMPLATE_FATU_ENABLED, templateVariablesMap, restrictedDriversCount: restrictedDrivers.length, restrictedPrefixesCount: restrictedOrderPrefixes.length });

    // Fetch cargas from API (last 7 days to now + 30 days)
    const hoje = new Date();
    const dataInicial = new Date();
    dataInicial.setDate(hoje.getDate() - 7);
    const dataFinal = new Date();
    dataFinal.setDate(hoje.getDate() + 30);

    const dataInicialFormatted = dataInicial.toISOString().slice(0, 10).replace(/-/g, "");
    const dataFinalFormatted = dataFinal.toISOString().slice(0, 10).replace(/-/g, "");

    console.log("Fetching cargas...", { dataInicial: dataInicialFormatted, dataFinal: dataFinalFormatted });

    const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);
    const apiResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        dataInicial: dataInicialFormatted,
        dataFinal: dataFinalFormatted,
      }),
    });

    if (!apiResponse.ok) {
      throw new Error(`API returned ${apiResponse.status}`);
    }

    const apiData = await apiResponse.json();
    let cargas: Carga[] = apiData.retorno?.cargas || [];

    // Filter cargas by min date if configured
    if (minDateFormatted) {
      const beforeFilter = cargas.length;
      cargas = cargas.filter((carga) => carga.data >= minDateFormatted);
      console.log(`Filtered cargas by min date: ${beforeFilter} → ${cargas.length}`);
    }

    console.log(`Found ${cargas.length} cargas after filtering`);

    // Get already sent records to avoid duplicates
    const { data: sentRecords } = await supabase
      .from("automatic_template_sends")
      .select("pedido_numero, status_triggered");

    const sentSet = new Set((sentRecords || []).map((r) => `${r.pedido_numero}:${r.status_triggered}`));

    // Get Evolution API credentials
    const { data: evolutionConfig } = await supabase
      .from("evolution_api_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    if (!evolutionConfig || evolutionConfig.config_type !== "official") {
      console.log("Official Evolution API not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Official Evolution API not configured for template sending",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const results: any[] = [];
    let processedCount = 0;
    let skippedCount = 0;

    // If test mode with specific order provided, process only that order
    if (testMode && specificOrder && testPhone) {
      console.log("Test mode with specific order:", specificOrder);

      // Find the full order data from the cargas API response
      let fullOrderData: any = null;
      let orderCarga: any = null;
      for (const carga of cargas) {
        const foundPedido = carga.pedidos?.find((p: any) => p.pedido === specificOrder.pedido);
        if (foundPedido) {
          fullOrderData = foundPedido;
          orderCarga = carga;
          console.log("Found full order data in carga:", carga.id);
          break;
        }
      }
      
      if (fullOrderData) {
        console.log("Full order data found with products:", fullOrderData.produtos?.length || 0, "items");
      } else {
        console.log("Warning: Could not find full order data in API response, using minimal data");
      }

      const cargaStatus = forceStatus || "ABER";
      
      // Check if template type is enabled
      if (cargaStatus === "ABER" && !TEMPLATE_ABER_ENABLED) {
        console.log("ABER template sending is disabled");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Envio de template ABER está desativado",
            processed: 0,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (cargaStatus === "FATU" && !TEMPLATE_FATU_ENABLED) {
        console.log("FATU template sending is disabled");
        return new Response(
          JSON.stringify({
            success: false,
            error: "Envio de template FATU está desativado",
            processed: 0,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      
      const templateName = cargaStatus === "ABER" ? TEMPLATE_ABER : TEMPLATE_FATU;
      const formattedPhone = formatPhoneForWhatsApp(testPhone);

      // Format date for template
      const dataPedido = specificOrder.data || "";
      const formattedDate = dataPedido
        ? `${dataPedido.slice(6, 8)}/${dataPedido.slice(4, 6)}/${dataPedido.slice(0, 4)}`
        : "";

      // Get number of variables this template expects
      const numVariables = templateVariablesMap[templateName] || 0;
      console.log(`Template ${templateName} expects ${numVariables} variables`);

      // Build template parameters based on how many the template expects
      let templateParams: any[] = [];
      if (numVariables >= 1) templateParams.push({ type: "text", text: specificOrder.clienteNome || "Cliente" });
      if (numVariables >= 2) templateParams.push({ type: "text", text: specificOrder.pedido || "seu pedido" });
      if (numVariables >= 3) templateParams.push({ type: "text", text: formattedDate || new Date().toLocaleDateString("pt-BR") });

      console.log(`Sending test ${templateName} to ${formattedPhone} for pedido ${specificOrder.pedido} with ${templateParams.length} params`);

      try {
        // Build request body - only include components if there are parameters
        const requestBody: any = {
          number: formattedPhone,
          name: templateName,
          language: "pt_BR",
        };
        
        if (templateParams.length > 0) {
          requestBody.components = [
            {
              type: "body",
              parameters: templateParams,
            },
          ];
        }

        const sendResponse = await fetch(
          `${evolutionConfig.api_url}/message/sendTemplate/${evolutionConfig.instance_name}`,
          {
            method: "POST",
            headers: {
              apikey: evolutionConfig.api_key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

        const sendResult = await sendResponse.json();
        console.log(`Test template send result:`, sendResult);

        if (sendResponse.ok) {
          // Save to conversation (test mode)
          await saveToConversation(
            testPhone,
            specificOrder.clienteNome || "Cliente",
            templateName,
            templateParams,
            true // isTest = true
          );
          
          // For FATU test sends, also create campaign_sends record for response tracking AND save to delivered_orders
          if (cargaStatus === "FATU" && systemCampaignId) {
            const normalizedTestPhone = normalizePhone(testPhone);
            
            // Build message text for campaign_sends
            let messageSent = templateBodyMap[templateName] || `[Template: ${templateName}]`;
            templateParams.forEach((param, index) => {
              messageSent = messageSent.replace(`{{${index + 1}}}`, param.text);
            });
            messageSent = `[TESTE] ${messageSent}`;
            
            // Create campaign_sends record with status 'success' for response tracking WITH full order data
            // Use fullOrderData if found from API, otherwise fall back to specificOrder
            const orderData = fullOrderData || {};
            const cargaData = orderCarga || {};
            
            const totalPeso = orderData.produtos?.reduce((sum: number, p: any) => sum + ((p.pesoBruto || 0) * (p.quantidade || 1)), 0) || orderData.pesoBruto || null;
            const totalQuantidade = orderData.produtos?.reduce((sum: number, p: any) => sum + (p.quantidade || 0), 0) || 0;
            
            const { error: campaignSendError } = await supabase.from("campaign_sends").insert({
              campaign_id: systemCampaignId,
              customer_phone: normalizedTestPhone,
              customer_name: orderData.cliente?.nome || specificOrder.clienteNome || "Cliente",
              message_sent: messageSent,
              status: "success",
              pedido_id: orderData.id || specificOrder.id || null,
              pedido_numero: orderData.pedido || specificOrder.pedido,
              nota_fiscal: orderData.notaFiscal || specificOrder.notaFiscal || null,
              data_pedido: dataPedido,
              carga_id: cargaData.id || null,
              driver_name: cargaData.nomeMotorista || null,
              rota: orderData.rota || null,
              // Save complete order details including products from API
              endereco_completo: orderData.cliente?.endereco || null,
              bairro: orderData.cliente?.bairro || null,
              cep: orderData.cliente?.cep || null,
              cidade: orderData.cliente?.cidade || null,
              estado: orderData.cliente?.estado || null,
              referencia: orderData.cliente?.referencia || null,
              valor_total: orderData.valor || null,
              peso_total: totalPeso,
              quantidade_itens: totalQuantidade ? Math.round(totalQuantidade) : null,
              produtos: orderData.produtos || null,
            });
            
            if (campaignSendError) {
              console.error(`Error creating campaign_sends for test FATU:`, campaignSendError);
            } else {
              console.log(`Campaign send created for test FATU - phone: ${normalizedTestPhone}`);
            }
            
            // Save order to delivered_orders for satisfaction survey management (test mode uses original order data)
            const { data: existingOrder } = await supabase
              .from("delivered_orders")
              .select("id")
              .eq("pedido_numero", specificOrder.pedido)
              .maybeSingle();
            
            if (!existingOrder) {
              // Use fullOrderData if found from API, otherwise fall back to specificOrder
              const deliveredPeso = orderData.produtos?.reduce((sum: number, p: any) => sum + ((p.pesoBruto || 0) * (p.quantidade || 1)), 0) || orderData.pesoBruto || 0;
              const deliveredQty = orderData.produtos?.reduce((sum: number, p: any) => sum + (p.quantidade || 0), 0) || 0;
              
              const { error: deliveredError } = await supabase.from("delivered_orders").insert({
                pedido_id: orderData.id || specificOrder.id || 0,
                pedido_numero: orderData.pedido || specificOrder.pedido,
                customer_phone: normalizePhone(orderData.cliente?.telefone || orderData.cliente?.celular || specificOrder.clienteTelefone || testPhone),
                customer_name: orderData.cliente?.nome || specificOrder.clienteNome || "Cliente",
                carga_id: cargaData.id || null,
                driver_name: cargaData.nomeMotorista || null,
                data_entrega: dataPedido,
                endereco_completo: orderData.cliente?.endereco || null,
                bairro: orderData.cliente?.bairro || null,
                cidade: orderData.cliente?.cidade || null,
                estado: orderData.cliente?.estado || null,
                referencia: orderData.cliente?.referencia || null,
                observacao: orderData.cliente?.observacao || null,
                valor_total: orderData.valor || null,
                peso_total: deliveredPeso || null,
                quantidade_itens: deliveredQty || null,
                produtos: orderData.produtos || null,
                status: "pending_survey",
                detected_at: new Date().toISOString(),
              });
              
              if (deliveredError) {
                console.error(`Error saving to delivered_orders for test ${specificOrder.pedido}:`, deliveredError);
              } else {
                console.log(`Test order ${specificOrder.pedido} saved to delivered_orders for survey management`);
              }
            } else {
              console.log(`Order ${specificOrder.pedido} already exists in delivered_orders`);
            }
          }
        }

        results.push({
          pedido: specificOrder.pedido,
          status: cargaStatus,
          template: templateName,
          phone: formattedPhone,
          success: sendResponse.ok,
        });

        processedCount++;
      } catch (sendError: any) {
        console.error(`Error sending test template:`, sendError);
        results.push({
          pedido: specificOrder.pedido,
          status: cargaStatus,
          template: templateName,
          error: sendError?.message || "Unknown error",
          success: false,
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          processed: processedCount,
          skipped: 0,
          testMode: true,
          results,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Normal processing loop for all orders
    for (const carga of cargas) {
      const cargaStatus = forceStatus || carga.status;

      // Only process ABER or FATU status
      if (cargaStatus !== "ABER" && cargaStatus !== "FATU") {
        continue;
      }

      // Skip cargas without driver
      const driverName = carga.nomeMotorista?.toUpperCase()?.trim() || "";
      if (!driverName) {
        console.log(`Skipping carga ${carga.id} - no driver assigned`);
        continue;
      }

      // Skip restricted drivers
      if (restrictedDriverNames.has(driverName)) {
        console.log(`Skipping carga ${carga.id} - restricted driver: ${driverName}`);
        continue;
      }

      for (const pedido of carga.pedidos || []) {
        const pedidoSerie = extractSerie(pedido.pedido);
        const notaFiscalSerie = extractSerie(pedido.notaFiscal);
        
        let shouldProcess = false;
        let templateName = "";

        // Logic: Serie P + ABER → use TEMPLATE_ABER (skip restricted prefixes, check if enabled)
        if (cargaStatus === "ABER" && pedidoSerie === "P") {
          // Check if ABER template is enabled
          if (!TEMPLATE_ABER_ENABLED) {
            continue;
          }
          // Check if order starts with any restricted prefix
          const pedidoUpper = pedido.pedido?.toUpperCase() || "";
          const isRestrictedPrefix = restrictedPrefixList.some(prefix => pedidoUpper.startsWith(prefix));
          if (isRestrictedPrefix) {
            console.log(`Skipping pedido ${pedido.pedido} - matches restricted prefix`);
            continue;
          }
          shouldProcess = true;
          templateName = TEMPLATE_ABER;
        }
        // Logic: FATU + Serie N + notaFiscal starts with "050/" → use TEMPLATE_FATU (check if enabled)
        else if (cargaStatus === "FATU" && notaFiscalSerie === "N" && pedido.notaFiscal?.startsWith("050/")) {
          // Check if FATU template is enabled
          if (!TEMPLATE_FATU_ENABLED) {
            continue;
          }
          shouldProcess = true;
          templateName = TEMPLATE_FATU;
        }

        if (!shouldProcess) {
          continue;
        }

        const key = `${pedido.pedido}:${cargaStatus}`;

        // Skip if already sent
        if (sentSet.has(key) && !testMode) {
          skippedCount++;
          continue;
        }

        // Get customer phone
        const customerPhone = pedido.cliente?.celular || pedido.cliente?.telefone;
        if (!customerPhone) {
          console.log(`No phone for pedido ${pedido.pedido}`);
          continue;
        }

        const phoneToUse = testMode && testPhone ? testPhone : customerPhone;
        const formattedPhone = formatPhoneForWhatsApp(phoneToUse);

        // Format date for template
        const dataPedido = pedido.data || carga.data;
        const formattedDate = dataPedido
          ? `${dataPedido.slice(6, 8)}/${dataPedido.slice(4, 6)}/${dataPedido.slice(0, 4)}`
          : "";

        // Get number of variables this template expects
        const numVariables = templateVariablesMap[templateName] || 0;

        // Build template parameters based on how many the template expects
        let templateParams: any[] = [];
        if (numVariables >= 1) templateParams.push({ type: "text", text: pedido.cliente?.nome || "Cliente" });
        if (numVariables >= 2) templateParams.push({ type: "text", text: pedido.pedido || "seu pedido" });
        if (numVariables >= 3) templateParams.push({ type: "text", text: formattedDate || new Date().toLocaleDateString("pt-BR") });

        console.log(`Sending ${templateName} to ${formattedPhone} for pedido ${pedido.pedido} with ${templateParams.length} params`);

        try {
          // Build request body - only include components if there are parameters
          const requestBody: any = {
            number: formattedPhone,
            name: templateName,
            language: "pt_BR",
          };
          
          if (templateParams.length > 0) {
            requestBody.components = [
              {
                type: "body",
                parameters: templateParams,
              },
            ];
          }

          // Send template via Evolution API
          const sendResponse = await fetch(
            `${evolutionConfig.api_url}/message/sendTemplate/${evolutionConfig.instance_name}`,
            {
              method: "POST",
              headers: {
                apikey: evolutionConfig.api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            },
          );

          const sendResult = await sendResponse.json();
          console.log(`Template send result:`, sendResult);

          // Save to conversation for all sends (including test mode)
          const phoneForConversation = testMode && testPhone ? testPhone : customerPhone;
          const conversationId = sendResponse.ok ? await saveToConversation(
            phoneForConversation,
            pedido.cliente?.nome || "Cliente",
            templateName,
            templateParams,
            testMode
          ) : null;

          // Save campaign_sends for ALL automatic sends (ABER and FATU) with full order data
          if (sendResponse.ok && systemCampaignId) {
            const normalizedCustomerPhone = normalizePhone(testMode && testPhone ? testPhone : customerPhone);
            
            // Build message text for campaign_sends
            let messageSent = templateBodyMap[templateName] || `[Template: ${templateName}]`;
            templateParams.forEach((param, index) => {
              messageSent = messageSent.replace(`{{${index + 1}}}`, param.text);
            });
            if (testMode) {
              messageSent = `[TESTE] ${messageSent}`;
            }
            
            // Create campaign_sends record with status 'success' and full order data
            const { error: campaignSendError } = await supabase.from("campaign_sends").insert({
              campaign_id: systemCampaignId,
              customer_phone: normalizedCustomerPhone,
              customer_name: pedido.cliente?.nome || "Cliente",
              message_sent: messageSent,
              status: "success",
              pedido_id: pedido.id,
              pedido_numero: pedido.pedido,
              nota_fiscal: pedido.notaFiscal,
              data_pedido: dataPedido,
              carga_id: carga.id,
              driver_name: carga.nomeMotorista,
              rota: pedido.rota || null,
              // Save complete order details including products
              endereco_completo: pedido.cliente?.endereco || null,
              bairro: pedido.cliente?.bairro || null,
              cep: pedido.cliente?.cep || null,
              cidade: pedido.cliente?.cidade || null,
              estado: pedido.cliente?.estado || null,
              referencia: pedido.cliente?.referencia || null,
              valor_total: pedido.valor || null,
              peso_total: pedido.produtos?.reduce((sum, p) => sum + ((p.pesoBruto || 0) * (p.quantidade || 1)), 0) || pedido.pesoBruto || null,
              quantidade_itens: Math.round(pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0) || null,
              produtos: pedido.produtos || null,
            });
            
            if (campaignSendError) {
              console.error(`Error creating campaign_sends for ${templateName}:`, campaignSendError);
            } else {
              console.log(`Campaign send created for ${templateName} - pedido: ${pedido.pedido}, phone: ${normalizedCustomerPhone}`);
            }
          }

          // For FATU 050/ sends only, also save to delivered_orders for satisfaction survey management
          const isFatu050 = cargaStatus === "FATU" && pedido.notaFiscal?.startsWith("050/");
          if (sendResponse.ok && isFatu050) {
            const normalizedCustomerPhone = normalizePhone(testMode && testPhone ? testPhone : customerPhone);
            const totalQuantidade = pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0;
            const totalPeso = pedido.produtos?.reduce((sum, p) => sum + ((p.pesoBruto || 0) * (p.quantidade || 1)), 0) || pedido.pesoBruto || 0;
            
            // Check if order already exists
            const { data: existingOrder } = await supabase
              .from("delivered_orders")
              .select("id")
              .eq("pedido_numero", pedido.pedido)
              .maybeSingle();
            
            if (!existingOrder) {
              const { error: deliveredError } = await supabase.from("delivered_orders").insert({
                pedido_id: pedido.id,
                pedido_numero: pedido.pedido,
                customer_phone: normalizedCustomerPhone,
                customer_name: pedido.cliente?.nome || "Cliente",
                carga_id: carga.id,
                driver_name: carga.nomeMotorista,
                data_entrega: dataPedido,
                endereco_completo: pedido.cliente?.endereco || null,
                bairro: pedido.cliente?.bairro || null,
                cidade: pedido.cliente?.cidade || null,
                estado: pedido.cliente?.estado || null,
                referencia: pedido.cliente?.referencia || null,
                observacao: pedido.cliente?.observacao || null,
                valor_total: pedido.valor || null,
                peso_total: totalPeso || null,
                quantidade_itens: totalQuantidade || null,
                produtos: pedido.produtos || null,
                status: "pending_survey",
                detected_at: new Date().toISOString(),
              });
              
              if (deliveredError) {
                console.error(`Error saving to delivered_orders for ${pedido.pedido}:`, deliveredError);
              } else {
                console.log(`Order ${pedido.pedido} saved to delivered_orders for survey management`);
              }
            } else {
              console.log(`Order ${pedido.pedido} already exists in delivered_orders`);
            }
          }

          // Record the send (unless test mode with different phone)
          if (!testMode) {
            await supabase.from("automatic_template_sends").insert({
              pedido_numero: pedido.pedido,
              pedido_id: pedido.id,
              customer_phone: normalizePhone(customerPhone),
              customer_name: pedido.cliente?.nome,
              status_triggered: cargaStatus,
              template_sent: templateName,
              data_pedido: dataPedido,
            });
            // Add to sentSet immediately to prevent duplicates within the same execution
            sentSet.add(key);
          }

          results.push({
            pedido: pedido.pedido,
            status: cargaStatus,
            template: templateName,
            phone: testMode ? testPhone : formattedPhone,
            success: sendResponse.ok,
          });

          processedCount++;

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (sendError: any) {
          console.error(`Error sending template for ${pedido.pedido}:`, sendError);
          results.push({
            pedido: pedido.pedido,
            status: cargaStatus,
            template: templateName,
            error: sendError?.message || "Unknown error",
            success: false,
          });
        }

        // In test mode, only process one order
        if (testMode) {
          break;
        }
      }

      if (testMode && processedCount > 0) {
        break;
      }
    }

    console.log(`Completed: ${processedCount} sent, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        testMode,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in auto-template-sender:", error);
    return new Response(
      JSON.stringify({
        error: error?.message || "Unknown error",
        success: false,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
