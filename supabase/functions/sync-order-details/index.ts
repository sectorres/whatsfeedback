import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const API_USERNAME = Deno.env.get("API_USERNAME") ?? "";
    const API_PASSWORD = Deno.env.get("API_PASSWORD") ?? "";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !API_USERNAME || !API_PASSWORD) {
      throw new Error("Credenciais não configuradas");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log("sync-order-details: Iniciando sincronização de pedidos");

    // Buscar pedidos que ainda não têm dados completos (produtos = null)
    const { data: ordersToSync, error: fetchError } = await supabase
      .from('campaign_sends')
      .select('id, pedido_numero, sent_at')
      .is('produtos', null)
      .not('pedido_numero', 'is', null)
      .order('sent_at', { ascending: false })
      .limit(100); // Limitar para não sobrecarregar

    if (fetchError) {
      console.error("sync-order-details: Erro ao buscar pedidos:", fetchError);
      throw fetchError;
    }

    console.log(`sync-order-details: ${ordersToSync?.length || 0} pedidos para sincronizar`);

    if (!ordersToSync || ordersToSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Nenhum pedido para sincronizar",
          synced: 0,
          failed: 0
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar cargas da API com período amplo
    const today = new Date();
    const dataFinal = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 60); // 60 dias atrás
    const dataInicial = startDate.toISOString().slice(0, 10).replace(/-/g, '');

    console.log(`sync-order-details: Buscando cargas de ${dataInicial} até ${dataFinal}`);

    const apiUrl = 'https://ec.torrescabral.com.br/shx-integrador/srv/ServPubGetCargasEntrega/V1';
    const authString = btoa(`${API_USERNAME}:${API_PASSWORD}`);

    const apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataInicial, dataFinal }),
    });

    if (!apiResponse.ok) {
      throw new Error(`API retornou status ${apiResponse.status}`);
    }

    const apiData = await apiResponse.json();
    
    if (!apiData || apiData.status !== "SUCESSO" || !apiData.retorno?.cargas) {
      throw new Error("Resposta da API inválida");
    }

    console.log(`sync-order-details: ${apiData.retorno.cargas.length} cargas encontradas na API`);

    // Criar um mapa de pedidos da API para busca rápida
    const pedidosMap = new Map();
    for (const carga of apiData.retorno.cargas) {
      if (carga.pedidos && Array.isArray(carga.pedidos)) {
        for (const pedido of carga.pedidos) {
          pedidosMap.set(pedido.pedido, { ...pedido, carga });
        }
      }
    }

    console.log(`sync-order-details: ${pedidosMap.size} pedidos mapeados`);

    let syncedCount = 0;
    let failedCount = 0;

    // Atualizar cada pedido com os dados da API
    for (const order of ordersToSync) {
      const pedidoData = pedidosMap.get(order.pedido_numero);
      
      if (pedidoData) {
        const { error: updateError } = await supabase
          .from('campaign_sends')
          .update({
            nota_fiscal: pedidoData.notaFiscal || null,
            data_pedido: pedidoData.data || null,
            rota: pedidoData.rota || null,
            endereco_completo: pedidoData.cliente?.endereco || null,
            bairro: pedidoData.cliente?.bairro || null,
            cep: pedidoData.cliente?.cep || null,
            cidade: pedidoData.cliente?.cidade || null,
            estado: pedidoData.cliente?.estado || null,
            referencia: pedidoData.cliente?.referencia || null,
            produtos: pedidoData.produtos || [],
            peso_total: pedidoData.pesoBruto || null,
            valor_total: pedidoData.valor || null,
            quantidade_itens: pedidoData.produtos?.reduce((sum: number, p: any) => sum + (p.quantidade || 0), 0) || null,
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`sync-order-details: Erro ao atualizar pedido ${order.pedido_numero}:`, updateError);
          failedCount++;
        } else {
          console.log(`sync-order-details: Pedido ${order.pedido_numero} sincronizado`);
          syncedCount++;
        }
      } else {
        console.log(`sync-order-details: Pedido ${order.pedido_numero} não encontrado na API`);
        failedCount++;
      }
    }

    console.log(`sync-order-details: Sincronização concluída. ${syncedCount} sucesso, ${failedCount} falhas`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronização concluída`,
        synced: syncedCount,
        failed: failedCount,
        total: ordersToSync.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("sync-order-details: Erro:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});