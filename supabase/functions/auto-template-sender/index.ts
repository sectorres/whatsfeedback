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
}

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  celular: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal?: string;
  data: string;
  status?: string;
  cliente: Cliente;
  produtos: Produto[];
}

interface Carga {
  id: number;
  data: string;
  status: string;
  pedidos: Pedido[];
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
    const cargas: Carga[] = apiData.retorno?.cargas || [];

    console.log(`Found ${cargas.length} cargas`);

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
      const templateName = cargaStatus === "ABER" ? "em_processo_entrega" : "status4";
      const formattedPhone = formatPhoneForWhatsApp(testPhone);

      // Format date for status4 template
      const dataPedido = specificOrder.data || "";
      const formattedDate = dataPedido
        ? `${dataPedido.slice(6, 8)}/${dataPedido.slice(4, 6)}/${dataPedido.slice(0, 4)}`
        : "";

      const templateParams: any[] =
        cargaStatus === "ABER"
          ? [{ type: "text", text: specificOrder.clienteNome || "Cliente" }]
          : [
              { type: "text", text: specificOrder.clienteNome || "Cliente" },
              { type: "text", text: formattedDate },
            ];

      console.log(`Sending test ${templateName} to ${formattedPhone} for pedido ${specificOrder.pedido}`);

      try {
        const sendResponse = await fetch(
          `${evolutionConfig.api_url}/message/sendTemplate/${evolutionConfig.instance_name}`,
          {
            method: "POST",
            headers: {
              apikey: evolutionConfig.api_key,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: formattedPhone,
              name: templateName,
              language: "pt_BR",
              components: [
                {
                  type: "body",
                  parameters: templateParams,
                },
              ],
            }),
          },
        );

        const sendResult = await sendResponse.json();
        console.log(`Test template send result:`, sendResult);

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

      for (const pedido of carga.pedidos || []) {
        const pedidoSerie = extractSerie(pedido.pedido);
        const notaFiscalSerie = extractSerie(pedido.notaFiscal);
        
        let shouldProcess = false;
        let templateName = "";

        // Logic: Serie P + ABER → em_processo_entrega (all orders)
        if (cargaStatus === "ABER" && pedidoSerie === "P") {
          shouldProcess = true;
          templateName = "em_processo_entrega";
        }
        // Logic: FATU + Serie N + notaFiscal starts with "050/" → status4
        else if (cargaStatus === "FATU" && notaFiscalSerie === "N" && pedido.notaFiscal?.startsWith("050/")) {
          shouldProcess = true;
          templateName = "status4";
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

        // Format date for status4 template (FATU)
        const dataPedido = pedido.data || carga.data;
        const formattedDate = dataPedido
          ? `${dataPedido.slice(6, 8)}/${dataPedido.slice(4, 6)}/${dataPedido.slice(0, 4)}`
          : "";

        // Build template parameters
        const templateParams: any[] =
          cargaStatus === "ABER"
            ? [{ type: "text", text: pedido.cliente?.nome || "Cliente" }]
            : [
                { type: "text", text: pedido.cliente?.nome || "Cliente" },
                { type: "text", text: formattedDate },
              ];

        console.log(`Sending ${templateName} to ${formattedPhone} for pedido ${pedido.pedido}`);

        try {
          // Send template via Evolution API
          const sendResponse = await fetch(
            `${evolutionConfig.api_url}/message/sendTemplate/${evolutionConfig.instance_name}`,
            {
              method: "POST",
              headers: {
                apikey: evolutionConfig.api_key,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                number: formattedPhone,
                name: templateName,
                language: "pt_BR",
                components: [
                  {
                    type: "body",
                    parameters: templateParams,
                  },
                ],
              }),
            },
          );

          const sendResult = await sendResponse.json();
          console.log(`Template send result:`, sendResult);

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
