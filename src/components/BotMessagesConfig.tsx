import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";

interface BotMessages {
  campaign_confirmation: string;
  campaign_confirmed_response: string;
  campaign_reschedule_response: string;
  campaign_invalid_response: string;
  survey_feedback_request: string;
  survey_invalid_rating: string;
}

const defaultMessages: BotMessages = {
  campaign_confirmation: "Por favor, confirme se poderá receber sua mercadoria:\n\n1️⃣  Confirmar\n2️⃣  Reagendar\n3️⃣  Parar de enviar notificação",
  campaign_confirmed_response: "Obrigado pela confirmação!",
  campaign_reschedule_response: "Para reagendar ligue no número: (11) 4206-5500 e fale com seu vendedor.",
  campaign_invalid_response: "Por favor, responda com:\n\n1️⃣ - Confirmar\n2️⃣ - Reagendar\n3️⃣ - Parar de enviar notificação",
  survey_feedback_request: "Obrigado pela sua nota! 🙏\n\nGostaria de deixar uma avaliação ou comentário adicional? Se sim, por favor escreva abaixo. Caso contrário, pode ignorar esta mensagem.",
  survey_invalid_rating: "Por favor, responda apenas com um número de 1 a 5 para avaliar sua entrega:\n\n1️⃣ - Muito insatisfeito\n2️⃣ - Insatisfeito\n3️⃣ - Neutro\n4️⃣ - Satisfeito\n5️⃣ - Muito satisfeito"
};

export const BotMessagesConfig = () => {
  const [messages, setMessages] = useState<BotMessages>(defaultMessages);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_key, config_value')
        .in('config_key', [
          'bot_message_campaign_confirmation',
          'bot_message_campaign_confirmed_response',
          'bot_message_campaign_reschedule_response',
          'bot_message_campaign_invalid_response',
          'bot_message_survey_feedback_request',
          'bot_message_survey_invalid_rating'
        ]);

      if (error) throw error;

      const loadedMessages = { ...defaultMessages };
      
      data?.forEach(config => {
        const key = config.config_key.replace('bot_message_', '') as keyof BotMessages;
        if (config.config_value && key in loadedMessages) {
          loadedMessages[key] = config.config_value;
        }
      });

      setMessages(loadedMessages);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar configurações de mensagens');
    } finally {
      setLoading(false);
    }
  };

  const saveMessages = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(messages).map(([key, value]) => ({
        config_key: `bot_message_${key}`,
        config_value: value
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(update, { onConflict: 'config_key' });

        if (error) throw error;
      }

      toast.success('Mensagens atualizadas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar mensagens:', error);
      toast.error('Erro ao salvar mensagens');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setMessages(defaultMessages);
    toast.info('Mensagens restauradas para o padrão');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Mensagens do Bot</CardTitle>
            <CardDescription>
              Configure todas as mensagens automáticas enviadas pelo sistema
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando configurações...
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign_confirmation">Mensagem de Confirmação de Campanha</Label>
                <Textarea
                  id="campaign_confirmation"
                  value={messages.campaign_confirmation}
                  onChange={(e) => setMessages({ ...messages, campaign_confirmation: e.target.value })}
                  rows={5}
                  placeholder="Mensagem enviada junto com a campanha solicitando confirmação"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_confirmed_response">Resposta à Confirmação (Opção 1)</Label>
                <Textarea
                  id="campaign_confirmed_response"
                  value={messages.campaign_confirmed_response}
                  onChange={(e) => setMessages({ ...messages, campaign_confirmed_response: e.target.value })}
                  rows={2}
                  placeholder="Mensagem enviada quando o cliente confirma (responde 1)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_reschedule_response">Resposta ao Reagendamento (Opção 2)</Label>
                <Textarea
                  id="campaign_reschedule_response"
                  value={messages.campaign_reschedule_response}
                  onChange={(e) => setMessages({ ...messages, campaign_reschedule_response: e.target.value })}
                  rows={3}
                  placeholder="Mensagem enviada quando o cliente solicita reagendamento (responde 2)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign_invalid_response">Lembrete de Resposta Inválida (Campanha)</Label>
                <Textarea
                  id="campaign_invalid_response"
                  value={messages.campaign_invalid_response}
                  onChange={(e) => setMessages({ ...messages, campaign_invalid_response: e.target.value })}
                  rows={4}
                  placeholder="Mensagem enviada quando o cliente responde algo diferente de 1, 2 ou 3"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="survey_feedback_request">Pedido de Feedback (Pesquisa)</Label>
                <Textarea
                  id="survey_feedback_request"
                  value={messages.survey_feedback_request}
                  onChange={(e) => setMessages({ ...messages, survey_feedback_request: e.target.value })}
                  rows={4}
                  placeholder="Mensagem enviada após o cliente dar uma nota, pedindo feedback opcional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="survey_invalid_rating">Lembrete de Nota Inválida (Pesquisa)</Label>
                <Textarea
                  id="survey_invalid_rating"
                  value={messages.survey_invalid_rating}
                  onChange={(e) => setMessages({ ...messages, survey_invalid_rating: e.target.value })}
                  rows={6}
                  placeholder="Mensagem enviada quando o cliente não responde com uma nota de 1 a 5"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveMessages} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Mensagens'}
              </Button>
              <Button onClick={resetToDefault} variant="outline" disabled={saving}>
                Restaurar Padrão
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};