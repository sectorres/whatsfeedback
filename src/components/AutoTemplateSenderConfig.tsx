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
import { Play, RefreshCw, Send, Clock, CheckCircle2, XCircle, Search, Package } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SendResult {
  pedido: string;
  status: string;
  template: string;
  phone?: string;
  success: boolean;
  error?: string;
}

interface PedidoItem {
  pedido: string;
  notaFiscal?: string;
  clienteNome: string;
  clienteTelefone: string;
  cargaStatus: string;
  data: string;
  serie: string;
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
  const [minDate, setMinDate] = useState<string>("");

  // Orders for testing
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<PedidoItem[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<string>("");

  useEffect(() => {
    loadConfig();
    loadRecentSends();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("config_key, config_value")
      .in("config_key", ["auto_template_enabled", "auto_template_last_run", "auto_template_min_date"]);

    data?.forEach((config) => {
      if (config.config_key === "auto_template_enabled") {
        setEnabled(config.config_value === "true");
      } else if (config.config_key === "auto_template_last_run") {
        setLastRun(config.config_value);
      } else if (config.config_key === "auto_template_min_date") {
        setMinDate(config.config_value || "");
      }
    });
  };

  const loadRecentSends = async () => {
    const { data } = await supabase
      .from("automatic_template_sends")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(20);

    setRecentSends(data || []);
  };

  const extractSerie = (value: string | undefined): string => {
    if (!value) return "";
    const parts = value.split("-");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  };

  const loadAvailableOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-cargas", {
        body: {},
      });

      if (error) throw error;

      const cargas = data?.retorno?.cargas || [];
      const orders: PedidoItem[] = [];

      // Convert minDate to YYYYMMDD format for comparison
      const minDateFormatted = minDate ? minDate.replace(/-/g, "") : "";

      for (const carga of cargas) {
        // Only include ABER or FATU status
        if (carga.status !== "ABER" && carga.status !== "FATU") continue;

        // Filter by min date if configured
        if (minDateFormatted && carga.data < minDateFormatted) continue;

        for (const pedido of carga.pedidos || []) {
          const pedidoSerie = extractSerie(pedido.pedido);
          const notaFiscalSerie = extractSerie(pedido.notaFiscal);

          // Logic: Serie P + ABER → show all
          // Logic: FATU + Serie N + notaFiscal starts with "050/" → show
          let shouldInclude = false;
          if (carga.status === "ABER" && pedidoSerie === "P") {
            shouldInclude = true;
          } else if (carga.status === "FATU" && notaFiscalSerie === "N" && pedido.notaFiscal?.startsWith("050/")) {
            shouldInclude = true;
          }

          if (!shouldInclude) continue;

          const telefone = pedido.cliente?.celular || pedido.cliente?.telefone || "";

          orders.push({
            pedido: pedido.pedido,
            notaFiscal: pedido.notaFiscal,
            clienteNome: pedido.cliente?.nome || "Sem nome",
            clienteTelefone: telefone,
            cargaStatus: carga.status,
            data: pedido.data || carga.data || "",
            serie: carga.status === "ABER" ? pedidoSerie : notaFiscalSerie,
          });
        }
      }

      setAvailableOrders(orders);

      if (orders.length === 0) {
        toast({
          title: "Nenhum pedido encontrado",
          description: "Não há pedidos elegíveis para os critérios definidos",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Pedidos carregados",
          description: `${orders.length} pedidos disponíveis`,
        });
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
    } finally {
      setLoadingOrders(false);
    }
  };

  const saveConfig = async (key: string, value: string) => {
    const { error } = await supabase
      .from("app_config")
      .upsert({ config_key: key, config_value: value }, { onConflict: "config_key" });

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    setEnabled(value);
    await saveConfig("auto_template_enabled", value.toString());
    toast({ title: value ? "Envio automático ativado" : "Envio automático desativado" });
  };

  const runManually = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-template-sender", {
        body: { testMode: false },
      });

      if (error) throw error;

      toast({
        title: "Execução concluída",
        description: `${data.processed} enviados, ${data.skipped} ignorados`,
      });

      await saveConfig("auto_template_last_run", new Date().toISOString());
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

    if (!selectedOrder) {
      toast({ title: "Erro", description: "Selecione um pedido para testar", variant: "destructive" });
      return;
    }

    const order = availableOrders.find((o) => o.pedido === selectedOrder);
    if (!order) {
      toast({ title: "Erro", description: "Pedido não encontrado", variant: "destructive" });
      return;
    }

    setTesting(true);
    setTestResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("auto-template-sender", {
        body: {
          testMode: true,
          testPhone: testPhone,
          forceStatus: testStatus,
          specificOrder: {
            pedido: order.pedido,
            clienteNome: order.clienteNome,
            clienteTelefone: order.clienteTelefone,
            data: order.data,
          },
        },
      });

      if (error) throw error;

      setTestResults(data.results || []);
      toast({
        title: "Teste concluído",
        description: data.results?.length > 0 ? `Template enviado para ${testPhone}` : "Erro ao enviar template",
      });
    } catch (error: any) {
      toast({ title: "Erro no teste", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const clearHistory = async () => {
    const { error } = await supabase
      .from("automatic_template_sends")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Histórico limpo" });
      loadRecentSends();
    }
  };

  const selectedOrderData = availableOrders.find((o) => o.pedido === selectedOrder);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Envio Automático de Templates
          </CardTitle>
          <CardDescription>
            ABER + Serie P → em_processo_entrega (todos) | FATU + Serie N + NF 050/ → status4
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base font-medium">Ativar envio automático</Label>
              <p className="text-sm text-muted-foreground">Executa a cada 10 minutos automaticamente</p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggleEnabled} />
          </div>

          {/* Min Date Filter */}
          <div className="p-4 border rounded-lg space-y-2">
            <Label className="text-base font-medium">Data mínima para coleta</Label>
            <p className="text-sm text-muted-foreground">
              Apenas cargas com data igual ou posterior serão processadas
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={minDate}
                onChange={(e) => setMinDate(e.target.value)}
                className="w-48"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await saveConfig("auto_template_min_date", minDate);
                  toast({ title: "Data mínima salva" });
                }}
              >
                Salvar
              </Button>
              {minDate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setMinDate("");
                    await saveConfig("auto_template_min_date", "");
                    toast({ title: "Filtro de data removido" });
                  }}
                >
                  Limpar
                </Button>
              )}
            </div>
            {minDate && (
              <p className="text-xs text-muted-foreground">
                Processando apenas cargas a partir de: {new Date(minDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>

          {/* Status Explanation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <Badge variant="outline" className="mb-2">
                ABER + Serie P
              </Badge>
              <p className="text-sm font-medium">Em Processo de Entrega</p>
              <p className="text-xs text-muted-foreground">
                Template: <code>em_processo_entrega</code>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Todos os pedidos com Serie P</p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <Badge variant="outline" className="mb-2">
                FATU + Serie N + NF 050/
              </Badge>
              <p className="text-sm font-medium">Faturado</p>
              <p className="text-xs text-muted-foreground">
                Template: <code>status4</code> (com data)
              </p>
              <p className="text-xs text-muted-foreground mt-1">Apenas NF começando com 050/</p>
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
                Última execução: {new Date(lastRun).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Test Section */}
      <Card>
        <CardHeader>
          <CardTitle>Modo de Teste</CardTitle>
          <CardDescription>Selecione um pedido elegível e envie para um número de teste</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Load Orders Button */}
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={loadAvailableOrders} disabled={loadingOrders}>
              {loadingOrders ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar Pedidos Elegíveis
            </Button>
            {availableOrders.length > 0 && (
              <Badge variant="secondary">{availableOrders.length} pedidos encontrados</Badge>
            )}
          </div>

          {/* Orders List */}
          {availableOrders.length > 0 && (
            <div className="border rounded-lg">
              <div className="p-2 bg-muted/50 border-b">
                <Label className="text-sm font-medium">Selecione um pedido para testar:</Label>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="p-2 space-y-1">
                  {availableOrders.map((order, index) => (
                    <div
                      key={`${order.pedido}-${order.notaFiscal || index}`}
                      onClick={() => setSelectedOrder(order.pedido)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedOrder === order.pedido
                          ? "bg-primary/10 border-2 border-primary"
                          : "bg-muted/30 hover:bg-muted/50 border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-mono font-medium">{order.pedido}</span>
                          {order.notaFiscal && (
                            <span className="text-xs text-muted-foreground">NF: {order.notaFiscal}</span>
                          )}
                          <Badge variant={order.cargaStatus === "ABER" ? "default" : "secondary"} className="text-xs">
                            {order.cargaStatus} (Serie {order.serie})
                          </Badge>
                        </div>
                        {selectedOrder === order.pedido && <CheckCircle2 className="h-4 w-4 text-primary" />}
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {order.clienteNome} • {order.clienteTelefone}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Test Configuration */}
          {selectedOrder && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="text-sm">
                <strong>Pedido selecionado:</strong> {selectedOrderData?.pedido}
                <br />
                <strong>Cliente:</strong> {selectedOrderData?.clienteNome}
                <br />
                <strong>Status atual:</strong> {selectedOrderData?.cargaStatus}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Telefone de Teste</Label>
                  <Input placeholder="11999999999" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} />
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
            </div>
          )}

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
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum envio automático registrado</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {recentSends.map((send) => (
                <div key={send.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={send.status_triggered === "ABER" ? "default" : "secondary"}>
                      {send.status_triggered}
                    </Badge>
                    <span className="font-mono">{send.pedido_numero}</span>
                    <span className="text-muted-foreground">→</span>
                    <span>{send.customer_name || send.customer_phone}</span>
                  </div>
                  <span className="text-muted-foreground">{new Date(send.sent_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
