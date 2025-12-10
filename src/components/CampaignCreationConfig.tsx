import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Switch } from "./ui/switch";
import { Label } from "./ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar } from "lucide-react";

export const CampaignCreationConfig = () => {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from("app_config")
        .select("config_value")
        .eq("config_key", "campaign_creation_enabled")
        .maybeSingle();

      if (data?.config_value !== undefined) {
        setEnabled(data.config_value === "true");
      }
    } catch (error) {
      console.error("Erro ao carregar configuração:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (value: boolean) => {
    try {
      setSaving(true);
      setEnabled(value);

      const { error } = await supabase
        .from("app_config")
        .upsert(
          { config_key: "campaign_creation_enabled", config_value: value.toString() },
          { onConflict: "config_key" }
        );

      if (error) throw error;
      toast.success(value ? "Criação de campanhas ativada" : "Criação de campanhas desativada");
    } catch (error) {
      console.error("Erro ao salvar configuração:", error);
      toast.error("Erro ao salvar configuração");
      setEnabled(!value);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Criação de Campanhas
        </CardTitle>
        <CardDescription>
          Controle a habilitação do envio manual de campanhas de aviso de entrega
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="campaign-toggle">Permitir criação de campanhas</Label>
            <p className="text-sm text-muted-foreground">
              Quando desativado, o botão de enviar campanha ficará desabilitado
            </p>
          </div>
          <Switch
            id="campaign-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
};
