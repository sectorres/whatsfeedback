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
      .select('*');

    if (dateFrom) {
      sendsQuery = sendsQuery.gte('sent_at', dateFrom);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      sendsQuery = sendsQuery.lte('sent_at', endDate.toISOString());
    }

    const { data: campaignSends, error: sendsError } = await sendsQuery;
    if (sendsError) throw sendsError;

    const sendIds = campaignSends?.map(s => s.id) || [];

    // Buscar respostas de satisfação do período
    const { data: surveys, error: surveysError } = await supabaseClient
      .from('satisfaction_surveys')
      .select('*')
      .in('campaign_send_id', sendIds)
      .not('rating', 'is', null);

    if (surveysError) throw surveysError;

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

    // Preparar feedbacks gerais
    const feedbacks = surveys
      .filter(s => s.feedback)
      .map(s => `Avaliação ${s.rating}/5: ${s.feedback}`)
      .slice(0, 10) // Limitar a 10 feedbacks
      .join('\n');

    const prompt = `Analise os dados de satisfação do cliente e forneça insights RESUMIDOS:

DADOS GERAIS:
- Total de Respostas: ${totalResponses}
- Média Geral: ${averageRating.toFixed(2)}/5
- Distribuição: 5★(${ratingDistribution['5']}) 4★(${ratingDistribution['4']}) 3★(${ratingDistribution['3']}) 2★(${ratingDistribution['2']}) 1★(${ratingDistribution['1']})

MOTORISTAS:
${driverStats}

${feedbacks ? `FEEDBACKS RECENTES:\n${feedbacks}` : ''}

Forneça uma análise CONCISA (máximo 300 palavras) com:
1. Resumo do sentimento geral (2-3 linhas)
2. Avaliação de cada motorista (1 linha por motorista com pontos fortes/fracos)
3. Principais oportunidades de melhoria (3-4 bullet points)
4. Recomendações específicas (2-3 ações prioritárias)

Seja direto, objetivo e acionável.`;

    console.log('Gerando insights com IA...');

    // Chamar Lovable AI para gerar insights
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
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
            content: 'Você é um analista de satisfação do cliente. Forneça insights resumidos, diretos e acionáveis.' 
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500, // Limitar tokens para resposta mais concisa
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Limite de requisições excedido. Tente novamente em alguns instantes.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos insuficientes. Adicione créditos no seu workspace.');
      }
      throw new Error('Erro ao gerar insights com IA');
    }

    const aiData = await aiResponse.json();
    const insights = aiData.choices[0].message.content;

    // Salvar insights no banco
    const { data: savedInsight, error: insightError } = await supabaseClient
      .from('satisfaction_insights')
      .insert({
        campaign_id: null, // Não é mais vinculado a uma campanha específica
        total_responses: totalResponses,
        average_rating: averageRating,
        rating_distribution: ratingDistribution,
        insights: insights,
        sentiment_summary: averageRating >= 4 ? 'Positivo' : averageRating >= 3 ? 'Neutro' : 'Negativo'
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});