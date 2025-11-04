import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, RotateCcw } from "lucide-react";

const DEFAULT_PROMPT = `Você é um assistente de análise de satisfação de clientes para a empresa "Torres Cabral", uma empresa do ramo de materiais de construção.

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

export function AiPromptConfig() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPrompt();
  }, []);

  const loadPrompt = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_config')
        .select('prompt')
        .eq('config_key', 'satisfaction_insights_prompt')
        .maybeSingle();

      if (error) throw error;

      if (data?.prompt) {
        setPrompt(data.prompt);
      }
    } catch (error) {
      console.error('Erro ao carregar prompt:', error);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      const { error } = await supabase
        .from('ai_config')
        .upsert({
          config_key: 'satisfaction_insights_prompt',
          prompt: prompt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      toast.success("Prompt salvo com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar prompt:', error);
      toast.error("Erro ao salvar prompt");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    toast.info("Prompt restaurado para o padrão");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Configuração do Prompt da IA
        </CardTitle>
        <CardDescription>
          Configure o prompt usado pela IA para gerar insights de satisfação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ai-prompt">Prompt do Sistema</Label>
          <Textarea
            id="ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Este prompt define como a IA analisa os dados de satisfação e gera insights estruturados.
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando..." : "Salvar Prompt"}
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
