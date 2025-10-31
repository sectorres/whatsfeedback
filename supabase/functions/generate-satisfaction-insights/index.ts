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

    // Buscar respostas de satisfação do período
    let query = supabaseClient
      .from('satisfaction_surveys')
      .select('*')
      .not('rating', 'is', null);

    if (dateFrom) {
      query = query.gte('sent_at', dateFrom);
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      query = query.lte('sent_at', endDate.toISOString());
    }

    const { data: surveys, error: surveysError } = await query;

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

    // Preparar dados para IA
    const feedbacks = surveys
      .filter(s => s.feedback)
      .map(s => `Avaliação ${s.rating}/5: ${s.feedback}`)
      .join('\n');

    const prompt = `Você é um analista de satisfação do cliente. Analise os seguintes dados de uma pesquisa de satisfação:

Total de Respostas: ${totalResponses}
Média de Avaliação: ${averageRating.toFixed(2)}/5

Distribuição de Notas:
- 1 estrela (Muito insatisfeito): ${ratingDistribution['1']} respostas
- 2 estrelas (Insatisfeito): ${ratingDistribution['2']} respostas
- 3 estrelas (Neutro): ${ratingDistribution['3']} respostas
- 4 estrelas (Satisfeito): ${ratingDistribution['4']} respostas
- 5 estrelas (Muito satisfeito): ${ratingDistribution['5']} respostas

${feedbacks ? `Feedbacks dos clientes:\n${feedbacks}` : ''}

Por favor, forneça:
1. Uma análise detalhada do sentimento geral dos clientes
2. Pontos fortes identificados
3. Áreas que precisam de melhoria
4. Recomendações específicas e acionáveis
5. Tendências ou padrões observados

Seja específico, objetivo e forneça insights práticos.`;

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
            content: 'Você é um especialista em análise de satisfação do cliente. Forneça insights profundos, acionáveis e bem estruturados.' 
          },
          { role: 'user', content: prompt }
        ],
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