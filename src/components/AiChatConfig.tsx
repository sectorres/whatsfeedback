import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Bot, Save, Sparkles } from "lucide-react";

interface AiConfig {
  prompt: string;
  temperature: number;
  response_delay_seconds: number;
  enabled: boolean;
  max_tokens: number;
}

const DEFAULT_CONFIG: AiConfig = {
  prompt: `Você é um assistente virtual de atendimento ao cliente de uma empresa de logística e entregas. 

Seja sempre cordial, profissional e objetivo. Ajude os clientes com informações sobre seus pedidos, entregas e dúvidas gerais.

Você tem acesso aos dados do cliente e seus pedidos para fornecer informações precisas.

Se não souber uma informação específica ou for algo que requer intervenção humana, oriente o cliente a aguardar o contato de um atendente.

Nunca invente informações sobre pedidos ou entregas - use apenas os dados fornecidos no contexto.`,
  temperature: 0.7,
  response_delay_seconds: 5,
  enabled: true,
  max_tokens: 500
};

export function AiChatConfig() {
  const [config, setConfig] = useState<AiConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_config")
        .select("*")
        .eq("config_key", "chat_ai")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        try {
          // O prompt está no campo prompt, e configs adicionais podem estar em JSON dentro dele
          const storedConfig = JSON.parse(data.prompt);
          setConfig({ ...DEFAULT_CONFIG, ...storedConfig });
        } catch {
          // Se não for JSON, usar apenas o prompt
          setConfig({ ...DEFAULT_CONFIG, prompt: data.prompt });
        }
      }
    } catch (error) {
      console.error("Erro ao carregar configuração da IA:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const configJson = JSON.stringify(config);
      
      const { error } = await supabase
        .from("ai_config")
        .upsert({
          config_key: "chat_ai",
          prompt: configJson,
          updated_at: new Date().toISOString()
        }, { onConflict: "config_key" });

      if (error) throw error;

      toast.success("Configurações da IA salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Configuração da IA (Gemini)
        </CardTitle>
        <CardDescription>
          Configure o comportamento da IA que responde automaticamente no chat quando o atendente humano não está ativo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle de ativação */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Ativar IA no Chat</Label>
            <p className="text-sm text-muted-foreground">
              Quando ativado, a IA responderá automaticamente às mensagens dos clientes (apenas se o toggle de IA estiver ativo na conversa)
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
          />
        </div>

        {/* Prompt do Sistema */}
        <div className="space-y-2">
          <Label htmlFor="prompt">Prompt do Sistema (Personalidade e Instruções)</Label>
          <Textarea
            id="prompt"
            value={config.prompt}
            onChange={(e) => setConfig({ ...config, prompt: e.target.value })}
            placeholder="Defina a personalidade e instruções para a IA..."
            rows={10}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Defina como a IA deve se comportar, qual tom usar, e quaisquer instruções específicas.
          </p>
        </div>

        {/* Temperatura */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Temperatura (Criatividade)</Label>
              <p className="text-xs text-muted-foreground">
                Valores menores = respostas mais consistentes. Valores maiores = respostas mais criativas.
              </p>
            </div>
            <span className="text-sm font-medium tabular-nums">{config.temperature.toFixed(1)}</span>
          </div>
          <Slider
            value={[config.temperature]}
            onValueChange={([value]) => setConfig({ ...config, temperature: value })}
            min={0}
            max={1}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Mais preciso</span>
            <span>Mais criativo</span>
          </div>
        </div>

        {/* Delay de Resposta */}
        <div className="space-y-2">
          <Label htmlFor="delay">Tempo de Espera antes de Responder (segundos)</Label>
          <Input
            id="delay"
            type="number"
            min={1}
            max={30}
            value={config.response_delay_seconds}
            onChange={(e) => setConfig({ ...config, response_delay_seconds: parseInt(e.target.value) || 5 })}
          />
          <p className="text-xs text-muted-foreground">
            A IA aguardará esse tempo antes de responder, dando chance para o atendente humano intervir.
          </p>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <Label htmlFor="maxTokens">Tamanho Máximo da Resposta (tokens)</Label>
          <Input
            id="maxTokens"
            type="number"
            min={100}
            max={2000}
            value={config.max_tokens}
            onChange={(e) => setConfig({ ...config, max_tokens: parseInt(e.target.value) || 500 })}
          />
          <p className="text-xs text-muted-foreground">
            Limita o tamanho das respostas da IA. 1 token ≈ 4 caracteres.
          </p>
        </div>

        {/* Informações sobre dados acessíveis */}
        <div className="rounded-lg bg-muted/50 p-4 space-y-2">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Dados que a IA pode consultar:
          </div>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Dados do cliente (nome, telefone, endereço)</li>
            <li>Histórico de pedidos e status</li>
            <li>Campanhas enviadas ao cliente</li>
            <li>Produtos e valores dos pedidos</li>
          </ul>
        </div>

        <Button onClick={saveConfig} disabled={saving} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
