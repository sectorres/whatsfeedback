import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Clock } from "lucide-react";

interface BusinessHoursSettings {
  enabled: boolean;
  start_time: string;
  end_time: string;
  message: string;
  work_days: number[]; // 0 = Sunday, 6 = Saturday
}

const defaultSettings: BusinessHoursSettings = {
  enabled: false,
  start_time: "08:00",
  end_time: "18:00",
  message: "Olá! Recebemos sua mensagem, mas estamos fora do horário de atendimento.\n\nNosso horário é de segunda a sexta, das 08:00 às 18:00.\n\nResponderemos assim que possível. Obrigado!",
  work_days: [1, 2, 3, 4, 5] // Monday to Friday
};

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const BusinessHoursConfig = () => {
  const [settings, setSettings] = useState<BusinessHoursSettings>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_key, config_value')
        .in('config_key', [
          'business_hours_enabled',
          'business_hours_start',
          'business_hours_end',
          'business_hours_message',
          'business_hours_work_days'
        ]);

      if (error) throw error;

      const loadedSettings = { ...defaultSettings };
      
      data?.forEach(config => {
        if (config.config_key === 'business_hours_enabled') {
          loadedSettings.enabled = config.config_value === 'true';
        } else if (config.config_key === 'business_hours_start') {
          loadedSettings.start_time = config.config_value || defaultSettings.start_time;
        } else if (config.config_key === 'business_hours_end') {
          loadedSettings.end_time = config.config_value || defaultSettings.end_time;
        } else if (config.config_key === 'business_hours_message') {
          loadedSettings.message = config.config_value || defaultSettings.message;
        } else if (config.config_key === 'business_hours_work_days') {
          try {
            loadedSettings.work_days = JSON.parse(config.config_value || '[]');
          } catch {
            loadedSettings.work_days = defaultSettings.work_days;
          }
        }
      });

      setSettings(loadedSettings);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações de horário');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const updates = [
        { config_key: 'business_hours_enabled', config_value: String(settings.enabled) },
        { config_key: 'business_hours_start', config_value: settings.start_time },
        { config_key: 'business_hours_end', config_value: settings.end_time },
        { config_key: 'business_hours_message', config_value: settings.message },
        { config_key: 'business_hours_work_days', config_value: JSON.stringify(settings.work_days) }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('app_config')
          .upsert(update, { onConflict: 'config_key' });

        if (error) throw error;
      }

      toast.success('Configurações de horário salvas com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      work_days: prev.work_days.includes(day)
        ? prev.work_days.filter(d => d !== day)
        : [...prev.work_days, day].sort()
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Horário de Atendimento</CardTitle>
            <CardDescription>
              Configure o horário de atendimento e a mensagem automática fora do expediente
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Ativar verificação de horário</Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, envia mensagem automática fora do horário
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_time">Início do Expediente</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={settings.start_time}
                  onChange={(e) => setSettings({ ...settings, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Fim do Expediente</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={settings.end_time}
                  onChange={(e) => setSettings({ ...settings, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Dias de Atendimento</Label>
              <div className="flex gap-2 flex-wrap">
                {dayNames.map((name, index) => (
                  <Button
                    key={index}
                    type="button"
                    variant={settings.work_days.includes(index) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleWorkDay(index)}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem Fora do Horário</Label>
              <Textarea
                id="message"
                value={settings.message}
                onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                rows={5}
                placeholder="Mensagem enviada automaticamente quando receber mensagem fora do horário"
              />
            </div>

            <Button onClick={saveSettings} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
