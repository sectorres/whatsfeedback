import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, RefreshCw, Send, Clock, CheckCircle2, XCircle } from "lucide-react";

interface SendResult {
  pedido: string;
  status: string;
  template: string;
  phone?: string;
  success: boolean;
  error?: string;
}

export function AutoTemplateSenderConfig() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testStatus, setTestStatus] = useState<"ABER" | "FATU">("ABER");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [recentSends, setRecentSends] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<SendResult[]>([]);

  useEffect(() => {
    loadConfig();
    loadRecentSends();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('config_key, config_value')
      .in('config_key', ['auto_template_enabled', 'auto_template_last_run']);

    data?.forEach(config => {
      if (config.config_key === 'auto_template_enabled') {
        setEnabled(config.config_value === 'true');
      } else if (config.config_key === 'auto_template_last_run') {
        setLastRun(config.config_value);
      }
    });
  };

  const loadRecentSends = async () => {
    const { data } = await supabase
      .from('automatic_template_sends')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20);

    setRecentSends(data || []);
  };

  const saveConfig = async (key: string, value: string) => {
    const { error } = await supabase
      .from('app_config')
      .upsert({ config_key: key, config_value: value }, { onConflict: 'config_key' });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    setEnabled(value);
    await saveConfig('auto_template_enabled', value.toString());
    toast({ title: value ? "Envio automático ativado" : "Envio automático desativado" });
  };

  const runManually = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auto-template-sender', {
        body: { testMode: false }
      });

      if (error) throw error;

      toast({
        title: "Execução concluída",
        description: `${data.processed} enviados, ${data.skipped} ignorados`,
      });

      await saveConfig('auto_template_last_run', new Date().toISOString());
      loadConfig();
      loadRecentSends();
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const runTest = async () => {
    if (!testPhone) {
      toast({ title: "Erro", description: "Informe o telefone de teste", variant: "destructive" });
      return;
    }

    setTesting(true);
    setTestResults([]);
    try {
      const { data, error } = await supabase.functions.invoke('auto-template-sender', {
        body: { 
          testMode: true,
          testPhone: testPhone,
          forceStatus: testStatus
        }
      });

      if (error) throw error;

      setTestResults(data.results || []);
      toast({
        title: "Teste concluído",
        description: data.results?.length > 0 
          ? `Template enviado para ${testPhone}` 
          : "Nenhum pedido 050 encontrado para o status selecionado",
      });
    } catch (error: any) {
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const clearHistory = async () => {
    const { error } = await supabase
      .from('automatic_template_sends')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Histórico limpo" });
      loadRecentSends();
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envio Automático de Templates
          </CardTitle>
          <CardDescription>
            Envio automático baseado no status do pedido (apenas pedidos 050)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Ativar envio automático</Label>
              <p className="text-sm text-muted-foreground">
                Executa a cada 10 minutos automaticamente
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
          </div>

          {/* Status Explanation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <Badge variant="outline" className="mb-2">ABER</Badge>
              <p className="text-sm font-medium">Em Processo de Entrega</p>
              <p className="text-xs text-muted-foreground">
                Template: <code>em_processo_entrega</code>
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <Badge variant="outline" className="mb-2">FATU</Badge>
              <p className="text-sm font-medium">Faturado</p>
              <p className="text-xs text-muted-foreground">
                Template: <code>status4</code> (com data)
              </p>
            </div>
          </div>

          {/* Manual Run */}
          <div className="flex items-center gap-4">
            <Button onClick={runManually} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Agora
            </Button>
            {lastRun && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Última execução: {new Date(lastRun).toLocaleString('pt-BR')}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Section */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Teste</CardTitle>
          <CardDescription>
            Envie um template de teste para um número específico
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Telefone de Teste</Label>
              <Input
                placeholder="11999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Simular Status</Label>
              <Select value={testStatus} onValueChange={(v) => setTestStatus(v as "ABER" | "FATU")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ABER">ABER (em_processo_entrega)</SelectItem>
                  <SelectItem value="FATU">FATU (status4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={runTest} disabled={testing} className="w-full">
                {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar Teste
              </Button>
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Resultado do Teste:</h4>
              {testResults.map((result, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {result.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>
                    Pedido {result.pedido} ({result.status}) → {result.template}
                  </span>
                  {result.error && <span className="text-red-500">- {result.error}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Sends History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Histórico de Envios</CardTitle>
            <CardDescription>Últimos 20 envios automáticos</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={clearHistory}>
            Limpar Histórico
          </Button>
        </CardHeader>
        <CardContent>
          {recentSends.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum envio automático registrado
            </p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentSends.map((send) => (
                <div key={send.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={send.status_triggered === 'ABER' ? 'default' : 'secondary'}>
                      {send.status_triggered}
                    </Badge>
                    <span className="font-mono">{send.pedido_numero}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{send.customer_name || send.customer_phone}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(send.sent_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
