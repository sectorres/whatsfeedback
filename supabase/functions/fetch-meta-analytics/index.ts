import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const metaToken = Deno.env.get("META_GRAPH_API_TOKEN");
    const wabaId = Deno.env.get("META_WABA_ID");

    if (!metaToken || !wabaId) {
      return new Response(
        JSON.stringify({ success: false, error: "Credenciais Meta não configuradas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get current date and start of month
    const now = new Date();
    const endTimestamp = Math.floor(now.getTime() / 1000);
    
    // Start from beginning of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startTimestamp = Math.floor(startOfMonth.getTime() / 1000);

    // Fetch pricing analytics from Meta
    const analyticsUrl = `https://graph.facebook.com/v22.0/${wabaId}/pricing_analytics?start=${startTimestamp}&end=${endTimestamp}&granularity=DAILY&metric_types=["cost"]`;
    
    console.log("Fetching Meta analytics:", analyticsUrl);
    
    const analyticsResponse = await fetch(analyticsUrl, {
      headers: {
        Authorization: `Bearer ${metaToken}`,
      },
    });

    if (!analyticsResponse.ok) {
      const errorText = await analyticsResponse.text();
      console.error("Meta API error:", errorText);
      return new Response(
        JSON.stringify({ success: false, error: "Erro ao buscar analytics da Meta", details: errorText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const analyticsData = await analyticsResponse.json();
    console.log("Analytics data:", JSON.stringify(analyticsData));

    // Calculate total cost from the data
    let totalCost = 0;
    let conversationCount = 0;
    const breakdown: Record<string, number> = {};

    if (analyticsData.data && Array.isArray(analyticsData.data)) {
      for (const item of analyticsData.data) {
        if (item.cost !== undefined) {
          const cost = parseFloat(item.cost) || 0;
          totalCost += cost;
          conversationCount += item.conversation_count || 0;
          
          // Group by conversation type if available
          const category = item.conversation_category || item.conversation_type || 'other';
          breakdown[category] = (breakdown[category] || 0) + cost;
        }
      }
    }

    // Also try to fetch conversation analytics for more details
    const conversationUrl = `https://graph.facebook.com/v22.0/${wabaId}/conversation_analytics?start=${startTimestamp}&end=${endTimestamp}&granularity=DAILY&metric_types=["cost","conversation"]&conversation_categories=["UTILITY","MARKETING","AUTHENTICATION","SERVICE"]`;
    
    try {
      const conversationResponse = await fetch(conversationUrl, {
        headers: {
          Authorization: `Bearer ${metaToken}`,
        },
      });

      if (conversationResponse.ok) {
        const conversationData = await conversationResponse.json();
        console.log("Conversation analytics:", JSON.stringify(conversationData));
        
        if (conversationData.data && Array.isArray(conversationData.data)) {
          // Reset and recalculate with conversation analytics
          totalCost = 0;
          conversationCount = 0;
          
          for (const item of conversationData.data) {
            if (item.cost !== undefined) {
              const cost = parseFloat(item.cost) || 0;
              totalCost += cost;
            }
            if (item.conversation !== undefined) {
              conversationCount += parseInt(item.conversation) || 0;
            }
            
            const category = item.conversation_category || 'other';
            if (item.cost !== undefined) {
              breakdown[category] = (breakdown[category] || 0) + parseFloat(item.cost);
            }
          }
        }
      }
    } catch (convError) {
      console.log("Conversation analytics not available, using pricing analytics");
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        },
        totalCost: totalCost / 100, // Convert from cents to currency
        conversationCount,
        breakdown: Object.entries(breakdown).map(([category, cost]) => ({
          category,
          cost: (cost as number) / 100,
        })),
        currency: "BRL",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error fetching Meta analytics:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
