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
    // Meta returns: {"data":[{"data_points":[{"start":..,"end":..,"cost":0.125},...]}]}
    let totalCost = 0;
    let conversationCount = 0;
    const breakdown: Record<string, number> = {};

    if (analyticsData.data && Array.isArray(analyticsData.data)) {
      for (const item of analyticsData.data) {
        // Check for data_points array (new structure)
        if (item.data_points && Array.isArray(item.data_points)) {
          for (const dp of item.data_points) {
            if (dp.cost !== undefined) {
              totalCost += parseFloat(dp.cost) || 0;
            }
          }
        }
        // Also check for direct cost (old structure)
        if (item.cost !== undefined) {
          totalCost += parseFloat(item.cost) || 0;
          conversationCount += item.conversation_count || 0;
          
          const category = item.conversation_category || item.conversation_type || 'other';
          breakdown[category] = (breakdown[category] || 0) + parseFloat(item.cost);
        }
      }
    }
    
    console.log("Total cost calculated:", totalCost);

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
          for (const item of conversationData.data) {
            // Check for data_points array
            if (item.data_points && Array.isArray(item.data_points)) {
              for (const dp of item.data_points) {
                if (dp.conversation !== undefined) {
                  conversationCount += parseInt(dp.conversation) || 0;
                }
                const category = dp.conversation_category || 'other';
                if (dp.cost !== undefined) {
                  breakdown[category] = (breakdown[category] || 0) + parseFloat(dp.cost);
                }
              }
            }
            // Direct properties
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

    // Fetch template analytics for per-template cost breakdown
    const templateAnalytics: Record<string, { sent: number; delivered: number; read: number; cost: number }> = {};
    
    const templateUrl = `https://graph.facebook.com/v22.0/${wabaId}/template_analytics?start=${startTimestamp}&end=${endTimestamp}&granularity=DAILY&metric_types=["sent","delivered","read","cost"]`;
    
    try {
      const templateResponse = await fetch(templateUrl, {
        headers: {
          Authorization: `Bearer ${metaToken}`,
        },
      });

      if (templateResponse.ok) {
        const templateData = await templateResponse.json();
        console.log("Template analytics:", JSON.stringify(templateData));
        
        if (templateData.data && Array.isArray(templateData.data)) {
          for (const item of templateData.data) {
            if (item.data_points && Array.isArray(item.data_points)) {
              for (const dp of item.data_points) {
                const templateName = dp.template_id || item.template_id || 'unknown';
                if (!templateAnalytics[templateName]) {
                  templateAnalytics[templateName] = { sent: 0, delivered: 0, read: 0, cost: 0 };
                }
                if (dp.sent !== undefined) templateAnalytics[templateName].sent += parseInt(dp.sent) || 0;
                if (dp.delivered !== undefined) templateAnalytics[templateName].delivered += parseInt(dp.delivered) || 0;
                if (dp.read !== undefined) templateAnalytics[templateName].read += parseInt(dp.read) || 0;
                if (dp.cost !== undefined) templateAnalytics[templateName].cost += parseFloat(dp.cost) || 0;
              }
            }
          }
        }
      }
    } catch (templateError) {
      console.log("Template analytics not available:", templateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          start: startOfMonth.toISOString(),
          end: now.toISOString(),
        },
        totalCost: totalCost,
        conversationCount,
        breakdown: Object.entries(breakdown).map(([category, cost]) => ({
          category,
          cost: cost as number,
        })),
        templateAnalytics: Object.entries(templateAnalytics).map(([name, stats]) => ({
          templateName: name,
          ...stats,
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
