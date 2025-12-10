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
      .in("config_key", ["auto_template_min_date", "auto_template_aber", "auto_template_fatu", "restricted_drivers"]);

    // Convert min date from YYYY-MM-DD to YYYYMMDD for comparison
    const minDateConfig = appConfigs?.find(c => c.config_key === "auto_template_min_date");
    const minDateValue = minDateConfig?.config_value || "";
    const minDateFormatted = minDateValue ? minDateValue.replace(/-/g, "") : "";

    // Get template names from config (with defaults)
    const templateAberConfig = appConfigs?.find(c => c.config_key === "auto_template_aber");
    const templateFatuConfig = appConfigs?.find(c => c.config_key === "auto_template_fatu");
    const TEMPLATE_ABER = templateAberConfig?.config_value || "em_processo_entrega";
    const TEMPLATE_FATU = templateFatuConfig?.config_value || "status4";

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

    console.log("Config loaded:", { minDateValue, minDateFormatted, TEMPLATE_ABER, TEMPLATE_FATU, templateVariablesMap, restrictedDriversCount: restrictedDrivers.length });

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

      const cargaStatus = forceStatus || "ABER";
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
            
            // Create campaign_sends record with status 'success' for response tracking
            const { error: campaignSendError } = await supabase.from("campaign_sends").insert({
              campaign_id: systemCampaignId,
              customer_phone: normalizedTestPhone,
              customer_name: specificOrder.clienteNome || "Cliente",
              message_sent: messageSent,
              status: "success",
              pedido_id: specificOrder.id || null,
              pedido_numero: specificOrder.pedido,
              nota_fiscal: specificOrder.notaFiscal || null,
              data_pedido: dataPedido,
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
              const { error: deliveredError } = await supabase.from("delivered_orders").insert({
                pedido_id: specificOrder.id || 0,
                pedido_numero: specificOrder.pedido,
                customer_phone: normalizePhone(specificOrder.clienteTelefone || specificOrder.clienteCelular || testPhone),
                customer_name: specificOrder.clienteNome || "Cliente",
                carga_id: specificOrder.cargaId || null,
                driver_name: specificOrder.nomeMotorista || null,
                data_entrega: dataPedido,
                endereco_completo: specificOrder.clienteEndereco || null,
                bairro: specificOrder.clienteBairro || null,
                cidade: specificOrder.clienteCidade || null,
                estado: specificOrder.clienteEstado || null,
                referencia: specificOrder.clienteReferencia || null,
                observacao: specificOrder.clienteObservacao || null,
                valor_total: specificOrder.valor || null,
                peso_total: specificOrder.pesoBruto || null,
                quantidade_itens: specificOrder.quantidadeItens || null,
                produtos: specificOrder.produtos || null,
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

      // Skip restricted drivers
      const driverName = carga.nomeMotorista?.toUpperCase() || "";
      if (restrictedDriverNames.has(driverName)) {
        console.log(`Skipping carga ${carga.id} - restricted driver: ${driverName}`);
        continue;
      }

      for (const pedido of carga.pedidos || []) {
        const pedidoSerie = extractSerie(pedido.pedido);
        const notaFiscalSerie = extractSerie(pedido.notaFiscal);
        
        let shouldProcess = false;
        let templateName = "";

        // Logic: Serie P + ABER → use TEMPLATE_ABER (all orders)
        if (cargaStatus === "ABER" && pedidoSerie === "P") {
          shouldProcess = true;
          templateName = TEMPLATE_ABER;
        }
        // Logic: FATU + Serie N + notaFiscal starts with "050/" → use TEMPLATE_FATU
        else if (cargaStatus === "FATU" && notaFiscalSerie === "N" && pedido.notaFiscal?.startsWith("050/")) {
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

          // For FATU 050/ sends, create campaign_sends record for response tracking AND save to delivered_orders
          const isFatu050 = cargaStatus === "FATU" && pedido.notaFiscal?.startsWith("050/");
          if (sendResponse.ok && isFatu050 && systemCampaignId) {
            const normalizedCustomerPhone = normalizePhone(testMode && testPhone ? testPhone : customerPhone);
            
            // Build message text for campaign_sends
            let messageSent = templateBodyMap[templateName] || `[Template: ${templateName}]`;
            templateParams.forEach((param, index) => {
              messageSent = messageSent.replace(`{{${index + 1}}}`, param.text);
            });
            if (testMode) {
              messageSent = `[TESTE] ${messageSent}`;
            }
            
            // Create campaign_sends record with status 'success' for response tracking
            const { error: campaignSendError } = await supabase.from("campaign_sends").insert({
              campaign_id: systemCampaignId,
              customer_phone: normalizedCustomerPhone,
              customer_name: pedido.cliente?.nome || "Cliente",
              message_sent: messageSent,
              status: "success", // This status allows webhook to detect pending responses
              pedido_id: pedido.id,
              pedido_numero: pedido.pedido,
              nota_fiscal: pedido.notaFiscal,
              data_pedido: dataPedido,
              carga_id: carga.id,
              driver_name: carga.nomeMotorista,
              rota: pedido.rota || null,
            });
            
            if (campaignSendError) {
              console.error(`Error creating campaign_sends for FATU 050/:`, campaignSendError);
            } else {
              console.log(`Campaign send created for FATU 050/ - phone: ${normalizedCustomerPhone}`);
            }
            
            // Save order to delivered_orders for satisfaction survey management
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
