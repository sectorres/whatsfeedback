import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Clock, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// Valores padrão
const DEFAULT_DELAYS = [2, 5, 7, 9, 11, 13, 17];

// Schema de validação
const delaySchema = z.array(
  z.number().int().min(1, "Mínimo 1 segundo").max(60, "Máximo 60 segundos")
).min(1, "Deve ter pelo menos 1 intervalo").max(20, "Máximo 20 intervalos");

export const SendDelayConfig = () => {
  const [delays, setDelays] = useState<number[]>(DEFAULT_DELAYS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadDelays();
  }, []);

  const loadDelays = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'message_send_delays')
        .maybeSingle();

      if (error) throw error;

      if (data?.config_value) {
        const parsed = JSON.parse(data.config_value);
        const validated = delaySchema.safeParse(parsed);
        if (validated.success) {
          setDelays(validated.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar intervalos:', error);
      toast.error('Erro ao carregar intervalos configurados');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validar antes de salvar
    const validated = delaySchema.safeParse(delays);
    if (!validated.success) {
      toast.error(validated.error.errors[0].message);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_config')
        .upsert({
          config_key: 'message_send_delays',
          config_value: JSON.stringify(delays)
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      toast.success('Intervalos atualizados com sucesso');
    } catch (error) {
      console.error('Erro ao salvar intervalos:', error);
      toast.error('Erro ao salvar intervalos');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDelays(DEFAULT_DELAYS);
    toast.info('Intervalos restaurados para o padrão');
  };

  const handleDelayChange = (index: number, value: string) => {
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= 60) {
      const newDelays = [...delays];
      newDelays[index] = num;
      setDelays(newDelays);
    }
  };

  const handleAddDelay = () => {
    if (delays.length < 20) {
      setDelays([...delays, 5]);
    } else {
      toast.error('Máximo de 20 intervalos permitidos');
    }
  };

  const handleRemoveDelay = (index: number) => {
    if (delays.length > 1) {
      setDelays(delays.filter((_, i) => i !== index));
    } else {
      toast.error('Deve ter pelo menos 1 intervalo');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Intervalo Entre Mensagens
        </CardTitle>
        <CardDescription>
          Configure a sequência progressiva de delays aplicada entre o envio de cada mensagem
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <Label>Sequência de Intervalos (em segundos)</Label>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {delays.map((delay, index) => (
              <div key={index} className="flex items-center gap-1">
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={delay}
                  onChange={(e) => handleDelayChange(index, e.target.value)}
                  className="text-center"
                  disabled={loading || saving}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => handleRemoveDelay(index)}
                  disabled={loading || saving || delays.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleAddDelay}
            disabled={loading || saving || delays.length >= 20}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Intervalo
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong>Sequência atual:</strong> {delays.join('s → ')}s (depois reinicia)
          </p>
          <p>
            O sistema aguarda progressivamente entre cada mensagem. Isso ajuda a evitar bloqueios do WhatsApp.
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
              'Salvar Intervalos'
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
