import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const DEFAULT_MESSAGE = `Olá{NOME}!

De uma nota de 1 a 5 para a entrega de seus produtos.

1️⃣ - Muito insatisfeito
2️⃣ - Insatisfeito  
3️⃣ - Neutro
4️⃣ - Satisfeito
5️⃣ - Muito satisfeito

Responda apenas com o número da sua avaliação.`;

export const SatisfactionSurveyConfig = () => {
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMessage();
  }, []);

  const loadMessage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'satisfaction_survey_message')
        .maybeSingle();

      if (error) throw error;

      if (data?.config_value) {
        setMessage(data.config_value);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagem:', error);
      toast.error('Erro ao carregar mensagem configurada');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!message.trim()) {
      toast.error('A mensagem não pode estar vazia');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({
          config_key: 'satisfaction_survey_message',
          config_value: message.trim()
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      toast.success('Mensagem da pesquisa atualizada com sucesso');
    } catch (error) {
      console.error('Erro ao salvar mensagem:', error);
      toast.error('Erro ao salvar mensagem');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setMessage(DEFAULT_MESSAGE);
    toast.info('Mensagem restaurada para o padrão');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mensagem da Pesquisa de Satisfação</CardTitle>
        <CardDescription>
          Configure o texto que será enviado aos clientes na pesquisa de satisfação.
          Use {"{NOME}"} para incluir o nome do cliente (opcional).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="survey-message">Texto da Mensagem</Label>
          <Textarea
            id="survey-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Digite a mensagem da pesquisa..."
            className="min-h-[300px] font-mono text-sm"
            disabled={loading || saving}
          />
          <p className="text-xs text-muted-foreground">
            Dica: Use emojis para tornar a mensagem mais amigável. O texto {"{NOME}"} será substituído pelo nome do cliente.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleSave} 
            disabled={loading || saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Mensagem'
            )}
          </Button>
          <Button 
            variant="outline" 
            onClick={handleReset}
            disabled={loading || saving}
          >
            Restaurar Padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
