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

    // Preparar feedbacks gerais (incluindo motorista)
    const feedbacks = surveys
      .filter(s => s.feedback)
      .map(s => {
        const send = campaignSends?.find(cs => cs.id === s.campaign_send_id);
        const driverName = send?.driver_name || 'N/A';
        return `[${driverName}] Nota ${s.rating}/5: "${s.feedback}"`;
      })
      .slice(0, 15)
      .join('\n');

    // Buscar prompt configurável do banco
    const { data: promptConfig } = await supabaseClient
      .from('ai_config')
      .select('prompt')
      .eq('config_key', 'satisfaction_insights_prompt')
      .maybeSingle();

    // Usar prompt configurável ou padrão
    const systemPrompt = promptConfig?.prompt || `Você é um assistente de análise de satisfação de clientes para a empresa "Torres Cabral", uma empresa do ramo de materiais de construção.

Analise os dados de pesquisas de satisfação e forneça insights estruturados no formato JSON, seguindo exatamente este schema:

{
  "visao_geral": {
    "resumo": "string - resumo executivo da análise",
    "tendencias": ["array de strings - principais tendências identificadas"],
    "status": "excelente|bom|atencao|critico"
  },
  "desempenho_entregas": {
    "resumo": "string - análise do desempenho das entregas",
    "pontos_positivos": ["array de strings"],
    "pontos_negativos": ["array de strings"],
    "status": "excelente|bom|atencao|critico"
  },
  "atendimento_cliente": {
    "resumo": "string - análise do atendimento",
    "pontos_positivos": ["array de strings"],
    "pontos_negativos": ["array de strings"],
    "status": "excelente|bom|atencao|critico"
  },
  "qualidade_produtos": {
    "resumo": "string - análise da qualidade dos produtos",
    "pontos_positivos": ["array de strings"],
    "pontos_negativos": ["array de strings"],
    "status": "excelente|bom|atencao|critico"
  },
  "oportunidades_melhoria": {
    "urgentes": ["array de strings - ações prioritárias"],
    "importantes": ["array de strings - melhorias relevantes"],
    "sugestoes": ["array de strings - ideias para o futuro"]
  }
}

IMPORTANTE:
- Seja específico e use os dados reais fornecidos
- Status deve ser: "excelente" (>4.5), "bom" (3.5-4.5), "atencao" (2.5-3.5), "critico" (<2.5)
- Foque em insights acionáveis
- Retorne APENAS o JSON, sem markdown ou explicações adicionais`;

    const userPrompt = `📊 DADOS DO PERÍODO:
- Total de avaliações: ${totalResponses}
- Nota média: ${averageRating.toFixed(1)}/5
- Distribuição: 5★(${ratingDistribution['5']}) 4★(${ratingDistribution['4']}) 3★(${ratingDistribution['3']}) 2★(${ratingDistribution['2']}) 1★(${ratingDistribution['1']})

👥 DESEMPENHO DOS ENTREGADORES:
${driverStats}

${feedbacks ? `💬 FEEDBACKS DOS CLIENTES:\n${feedbacks}` : ''}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
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