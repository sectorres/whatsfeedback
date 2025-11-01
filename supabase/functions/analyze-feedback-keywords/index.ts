import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedbacks } = await req.json();

    if (!feedbacks || feedbacks.length === 0) {
      return new Response(
        JSON.stringify({ 
          positiveKeywords: [], 
          negativeKeywords: [] 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    const systemPrompt = `Você é um analista de feedback de clientes especializado em extrair palavras-chave de avaliações em português.

Analise os feedbacks fornecidos e identifique as 8 palavras ou expressões curtas (1-2 palavras) mais relevantes em cada categoria:

1. PALAVRAS POSITIVAS: Termos que indicam satisfação, elogio, qualidade positiva
2. PALAVRAS NEGATIVAS: Termos que indicam insatisfação, reclamação, problemas

REGRAS IMPORTANTES:
- Extraia apenas palavras que REALMENTE aparecem nos feedbacks
- Conte quantas vezes cada palavra/expressão aparece
- Normalize variações (ex: "ótimo", "otimo" → "ótimo")
- Retorne no máximo 8 palavras por categoria
- Use apenas palavras em português
- Priorize palavras mais frequentes e relevantes`;

    const userPrompt = `Analise estes feedbacks e extraia as palavras-chave mais relevantes:

${feedbacks.map((f: string, i: number) => `${i + 1}. "${f}"`).join('\n')}

Retorne APENAS as palavras encontradas nos feedbacks acima.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
        tools: [
          {
            type: "function",
            function: {
              name: "extract_keywords",
              description: "Extrai palavras-chave positivas e negativas dos feedbacks",
              parameters: {
                type: "object",
                properties: {
                  positive: {
                    type: "array",
                    description: "Palavras positivas com contagem",
                    items: {
                      type: "object",
                      properties: {
                        word: { 
                          type: "string",
                          description: "Palavra ou expressão curta em português"
                        },
                        count: { 
                          type: "integer",
                          description: "Número de vezes que aparece nos feedbacks"
                        }
                      },
                      required: ["word", "count"]
                    }
                  },
                  negative: {
                    type: "array",
                    description: "Palavras negativas com contagem",
                    items: {
                      type: "object",
                      properties: {
                        word: { 
                          type: "string",
                          description: "Palavra ou expressão curta em português"
                        },
                        count: { 
                          type: "integer",
                          description: "Número de vezes que aparece nos feedbacks"
                        }
                      },
                      required: ["word", "count"]
                    }
                  }
                },
                required: ["positive", "negative"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_keywords" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { 
            status: 429, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao seu workspace Lovable.' }),
          { 
            status: 402, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      const errorText = await response.text();
      console.error('Erro da API Lovable AI:', response.status, errorText);
      throw new Error(`Erro na API Lovable AI: ${response.status}`);
    }

    const data = await response.json();
    console.log('Resposta da IA:', JSON.stringify(data));

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('IA não retornou dados estruturados');
    }

    const keywords = JSON.parse(toolCall.function.arguments);
    
    return new Response(
      JSON.stringify({
        positiveKeywords: keywords.positive || [],
        negativeKeywords: keywords.negative || []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Erro ao analisar feedbacks:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        positiveKeywords: [],
        negativeKeywords: []
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
