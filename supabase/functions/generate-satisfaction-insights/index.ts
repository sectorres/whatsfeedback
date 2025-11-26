import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { dateFrom, dateTo } = await req.json();

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Buscando respostas de satisfação para período:', dateFrom, 'até', dateTo);

    // Buscar todos os campaign_sends do período
    let sendsQuery = supabaseClient
      .from('campaign_sends')
      .select('*')
      .eq('status', 'success');

    if (dateFrom) {
      sendsQuery = sendsQuery.gte('sent_at', dateFrom);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      sendsQuery = sendsQuery.lte('sent_at', endDate.toISOString());
    }

    const { data: campaignSends, error: sendsError } = await sendsQuery;
    if (sendsError) {
      console.error('Erro ao buscar campaign_sends:', sendsError);
      throw sendsError;
    }

    console.log('Campaign sends encontrados:', campaignSends?.length || 0);

    if (!campaignSends || campaignSends.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nenhuma campanha enviada encontrada para o período selecionado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sendIds = campaignSends.map(s => s.id);

    // Buscar respostas de satisfação do período (direto por data, não por IDs)
    let surveysQuery = supabaseClient
      .from('satisfaction_surveys')
      .select('*')
      .not('rating', 'is', null);

    if (dateFrom) {
      surveysQuery = surveysQuery.gte('sent_at', dateFrom);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      surveysQuery = surveysQuery.lte('sent_at', endDate.toISOString());
    }

    const { data: surveys, error: surveysError } = await surveysQuery;

    if (surveysError) {
      console.error('Erro ao buscar surveys:', surveysError);
      throw surveysError;
    }

    console.log('Surveys encontradas:', surveys?.length || 0);

    if (!surveys || surveys.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nenhuma resposta encontrada para o período selecionado' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calcular estatísticas
    const totalResponses = surveys.length;
    const ratings = surveys.map(s => s.rating);
    const averageRating = ratings.reduce((a, b) => a + b, 0) / totalResponses;

    const ratingDistribution = {
      '1': ratings.filter(r => r === 1).length,
      '2': ratings.filter(r => r === 2).length,
      '3': ratings.filter(r => r === 3).length,
      '4': ratings.filter(r => r === 4).length,
      '5': ratings.filter(r => r === 5).length,
    };

    // Criar mapa de motoristas
    const driverMap: Record<string, { ratings: number[], feedbacks: string[] }> = {};
    
    for (const survey of surveys) {
      const send = campaignSends?.find(s => s.id === survey.campaign_send_id);
      const driverName = send?.driver_name;
      
      if (driverName) {
        if (!driverMap[driverName]) {
          driverMap[driverName] = { ratings: [], feedbacks: [] };
        }
        driverMap[driverName].ratings.push(survey.rating);
        if (survey.feedback) {
          driverMap[driverName].feedbacks.push(survey.feedback);
        }
      }
    }

    // Preparar dados de motoristas para o prompt
    const driverStats = Object.entries(driverMap).map(([name, data]) => {
      const avg = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      return `${name}: ${data.ratings.length} avaliações, média ${avg.toFixed(1)}/5`;
    }).join('\n');

    // Preparar feedbacks gerais (incluindo motorista)
    const feedbacks = surveys
      .filter(s => s.feedback)
      .map(s => {
        const send = campaignSends?.find(cs => cs.id === s.campaign_send_id);
        const driverName = send?.driver_name || 'N/A';
        return `[${driverName}] Nota ${s.rating}/5: "${s.feedback}"`;
      })
      .join('\n');

    const prompt = `Você está analisando dados de satisfação da TORRES CABRAL, empresa de materiais de construção.

📊 DADOS DO PERÍODO:
- Total de avaliações: ${totalResponses}
- Nota média: ${averageRating.toFixed(1)}/5
- Distribuição: 5★(${ratingDistribution['5']}) 4★(${ratingDistribution['4']}) 3★(${ratingDistribution['3']}) 2★(${ratingDistribution['2']}) 1★(${ratingDistribution['1']})

👥 DESEMPENHO DOS ENTREGADORES:
${driverStats}

${feedbacks ? `💬 FEEDBACKS DOS CLIENTES:\n${feedbacks}` : ''}

Gere uma análise estruturada em JSON com as seguintes categorias (máximo 3-4 pontos por categoria):

{
  "visao_geral": {
    "titulo": "Visão Geral",
    "icone": "BarChart3",
    "status": "positivo|neutro|negativo",
    "insights": ["ponto 1", "ponto 2", "ponto 3"]
  },
  "entrega": {
    "titulo": "Desempenho de Entrega",
    "icone": "TruckIcon",
    "status": "positivo|neutro|negativo",
    "insights": ["ponto sobre pontualidade", "ponto sobre cuidado", "motoristas destaque ou problema"]
  },
  "atendimento": {
    "titulo": "Atendimento ao Cliente",
    "icone": "Users",
    "status": "positivo|neutro|negativo",
    "insights": ["qualidade atendimento", "comunicação", "cordialidade"]
  },
  "qualidade_produto": {
    "titulo": "Qualidade dos Produtos",
    "icone": "PackageCheck",
    "status": "positivo|neutro|negativo",
    "insights": ["estado produtos", "conformidade pedido", "embalagem"]
  },
  "melhorias": {
    "titulo": "Oportunidades de Melhoria",
    "icone": "TrendingUp",
    "status": "neutro",
    "insights": ["ação prioritária 1", "ação prioritária 2", "ação prioritária 3"]
  }
}

IMPORTANTE:
- Seja específico e objetivo
- Mencione motoristas com problemas pelo nome
- Foque em insights acionáveis
- Use linguagem direta
- Retorne APENAS o JSON, sem markdown`;

    console.log('Gerando insights com IA...');

    // Chamar Lovable AI para gerar insights
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    console.log('Iniciando chamada para Lovable AI...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um analista de negócios especializado em logística e distribuição de materiais de construção. Analise TODOS os dados fornecidos e retorne insights estruturados em JSON puro, sem markdown ou texto adicional.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2000,
      }),
    });

    console.log('Resposta da AI recebida com status:', aiResponse.status);

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro da AI:', errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos no seu workspace.');
      }
      throw new Error(`Erro ao gerar insights com IA: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    let insights = aiData.choices[0].message.content;
    
    // Limpar markdown se presente
    insights = insights.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Salvar insights no banco
    const { data: savedInsight, error: insightError } = await supabaseClient
      .from('satisfaction_insights')
      .insert({
        campaign_id: null, // Não é mais vinculado a uma campanha específica
        total_responses: totalResponses,
        average_rating: averageRating,
        rating_distribution: ratingDistribution,
        insights: insights,
        sentiment_summary: averageRating >= 4 ? 'Positivo' : averageRating >= 3 ? 'Neutro' : 'Negativo',
        date_from: dateFrom,
        date_to: dateTo
      })
      .select()
      .single();

    if (insightError) throw insightError;

    console.log('Insights gerados e salvos com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        insight: savedInsight,
        message: 'Insights gerados com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na função generate-satisfaction-insights:', error);
    
    // Serializar corretamente o erro
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Mensagem:', errorMessage);
    if (errorStack) {
      console.error('Stack:', errorStack);
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        stack: errorStack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});