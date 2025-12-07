import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { MessageSquare, Key, Link, Server, Eye, EyeOff, CheckCircle, XCircle, Loader2, Save, Star, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";

interface EvolutionConfig {
  id?: string;
  config_type: 'unofficial' | 'official';
  api_url: string | null;
  api_key: string | null;
  instance_name: string | null;
  template_name: string | null;
  template_language: string | null;
  is_active: boolean;
}

export const EvolutionApiConfig = () => {
  const [configType, setConfigType] = useState<'unofficial' | 'official'>('unofficial');
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("pt_BR");
  const [surveyTemplateName, setSurveyTemplateName] = useState("entrega_realizada");
  const [surveyTemplateLanguage, setSurveyTemplateLanguage] = useState("pt_BR");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [loading, setLoading] = useState(true);
  const [configId, setConfigId] = useState<string | null>(null);
  
  // Password protection state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [tokenUnlocked, setTokenUnlocked] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('evolution_api_config')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const config = data as any; // Cast para ignorar tipos desatualizados
        setConfigId(config.id);
        setConfigType(config.config_type as 'unofficial' | 'official');
        setApiUrl(config.api_url || "");
        setApiKey(config.api_key || "");
        setInstanceName(config.instance_name || "");
        setTemplateName(config.template_name || "");
        setTemplateLanguage(config.template_language || "pt_BR");
        setSurveyTemplateName(config.survey_template_name || "entrega_realizada");
        setSurveyTemplateLanguage(config.survey_template_language || "pt_BR");
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast.error("Erro ao carregar configuração da Evolution API");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockToken = () => {
    setPasswordDialogOpen(true);
    setPassword("");
  };

  const handleVerifyPassword = async () => {
    if (!password) {
      toast.error("Digite sua senha");
      return;
    }

    setVerifyingPassword(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Try to sign in with the current user's email and provided password
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password
      });

      if (error) {
        toast.error("Senha incorreta");
        return;
      }

      setTokenUnlocked(true);
      setShowApiKey(true);
      setPasswordDialogOpen(false);
      toast.success("Token desbloqueado");
    } catch (error) {
      console.error('Erro ao verificar senha:', error);
      toast.error("Erro ao verificar senha");
    } finally {
      setVerifyingPassword(false);
      setPassword("");
    }
  };

  const handleToggleApiKey = () => {
    if (!showApiKey && !tokenUnlocked) {
      handleUnlockToken();
    } else {
      setShowApiKey(!showApiKey);
    }
  };

  const handleTestConnection = async () => {
    let testUrl = apiUrl;
    let testKey = apiKey;
    let testInstance = instanceName;

    if (configType === 'unofficial') {
      toast.info("Para testar a instância não oficial, a conexão será verificada pelo indicador de status no topo da página.");
      return;
    }

    if (!testUrl || !testKey || !testInstance) {
      toast.error("Preencha todos os campos antes de testar");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch(`${testUrl}/instance/connectionState/${testInstance}`, {
        method: 'GET',
        headers: {
          'apikey': testKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult('success');
        toast.success(`Conexão bem-sucedida! Status: ${data?.instance?.state || 'conectado'}`);
      } else {
        setTestResult('error');
        toast.error("Falha na conexão. Verifique as credenciais.");
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setTestResult('error');
      toast.error("Erro ao conectar. Verifique a URL da API.");
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (configType === 'official' && (!apiUrl || !apiKey || !instanceName || !templateName)) {
      toast.error("Preencha todos os campos da API oficial antes de salvar (incluindo nome do template de aviso)");
      return;
    }

    setSaving(true);

    try {
      // Sempre salvar os dados da instância oficial, independente do tipo selecionado
      const configData = {
        config_type: configType,
        api_url: apiUrl || null,
        api_key: apiKey || null,
        instance_name: instanceName || null,
        template_name: templateName || null,
        template_language: templateLanguage || 'pt_BR',
        survey_template_name: surveyTemplateName || null,
        survey_template_language: surveyTemplateLanguage || 'pt_BR',
        is_active: true
      };

      if (configId) {
        // Update existing config
        const { error } = await supabase
          .from('evolution_api_config')
          .update(configData)
          .eq('id', configId);

        if (error) throw error;
      } else {
        // Insert new config
        const { data, error } = await supabase
          .from('evolution_api_config')
          .insert(configData)
          .select()
          .single();

        if (error) throw error;
        setConfigId(data.id);
      }

      toast.success("Configuração salva com sucesso!");
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Configuração da Evolution API
        </CardTitle>
        <CardDescription>
          Escolha qual instância da Evolution API usar para envio de mensagens WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Tipo de Instância</Label>
          <RadioGroup
            value={configType}
            onValueChange={(value) => setConfigType(value as 'unofficial' | 'official')}
            className="flex flex-col space-y-2"
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="unofficial" id="unofficial" />
              <Label htmlFor="unofficial" className="flex-1 cursor-pointer">
                <div className="font-medium">Instância Não Oficial (QR Code)</div>
                <div className="text-sm text-muted-foreground">Usa as credenciais salvas nos secrets do projeto</div>
              </Label>
            </div>
            <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="official" id="official" />
              <Label htmlFor="official" className="flex-1 cursor-pointer">
                <div className="font-medium">Instância Oficial (API)</div>
                <div className="text-sm text-muted-foreground">Configuração manual da URL, instância e token</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {configType === 'official' && (
          <div className="space-y-6 pt-2 border-t">
            {/* Configurações de Conexão */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Credenciais de Conexão</h3>
              <div className="space-y-2">
                <Label htmlFor="evolution-url" className="flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  URL da API
                </Label>
                <Input
                  id="evolution-url"
                  placeholder="https://evl.torrescabral.com.br"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-instance" className="flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  Nome da Instância
                </Label>
                <Input
                  id="evolution-instance"
                  placeholder="nome-da-instancia"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-key" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  API Key / Token
                  {!tokenUnlocked && apiKey && (
                    <Lock className="h-3 w-3 text-yellow-500" />
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="evolution-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="Digite sua chave de API"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={handleToggleApiKey}
                    title={!tokenUnlocked && apiKey ? "Clique para desbloquear com senha" : showApiKey ? "Ocultar" : "Mostrar"}
                  >
                    {!tokenUnlocked && apiKey ? (
                      <Lock className="h-4 w-4 text-yellow-500" />
                    ) : showApiKey ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                {!tokenUnlocked && apiKey && (
                  <p className="text-xs text-yellow-600">
                    🔒 Token protegido. Clique no cadeado para visualizar (requer senha).
                  </p>
                )}
              </div>
            </div>

            {/* Configurações de Template de Campanha */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Template de Aviso de Entrega
              </h3>
              <div className="space-y-2">
                <Label htmlFor="evolution-template">
                  Nome do Template (Meta)
                </Label>
                <Input
                  id="evolution-template"
                  placeholder="nome_do_template_aprovado"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nome exato do template aprovado na Meta Business para *Aviso de Entrega*. (Valor fixo no backend: `aviso_entrega_2`)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="evolution-template-lang">
                  Idioma do Template
                </Label>
                <Input
                  id="evolution-template-lang"
                  placeholder="pt_BR"
                  value={templateLanguage}
                  onChange={(e) => setTemplateLanguage(e.target.value)}
                />
              </div>
            </div>

            {/* Configurações de Template de Pesquisa */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-600" />
                Template de Pesquisa de Satisfação
              </h3>
              <div className="space-y-2">
                <Label htmlFor="survey-template">
                  Nome do Template (Meta)
                </Label>
                <Input
                  id="survey-template"
                  placeholder="entrega_realizada"
                  value={surveyTemplateName}
                  onChange={(e) => setSurveyTemplateName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nome exato do template aprovado na Meta Business para *Pesquisa de Satisfação*.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="survey-template-lang">
                  Idioma do Template
                </Label>
                <Input
                  id="survey-template-lang"
                  placeholder="pt_BR"
                  value={surveyTemplateLanguage}
                  onChange={(e) => setSurveyTemplateLanguage(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">Informações:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {configType === 'unofficial' ? (
              <>
                <li>• Usa as credenciais configuradas nos secrets do projeto</li>
                <li>• Conexão via QR Code no painel de conexão WhatsApp</li>
                <li>• Ideal para uso com instância não oficial</li>
              </>
            ) : (
              <>
                <li>• Configure a URL, instância e token da API oficial</li>
                <li>• As credenciais ficam salvas no banco de dados</li>
                <li>• Ideal para uso com a API oficial do WhatsApp Business</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex gap-2">
          {configType === 'official' && (
            <Button 
              onClick={handleTestConnection} 
              variant="outline" 
              className="flex-1"
              disabled={testing}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
              ) : testResult === 'error' ? (
                <XCircle className="h-4 w-4 mr-2 text-red-500" />
              ) : null}
              Testar Conexão
            </Button>
          )}
          <Button onClick={handleSaveConfig} className="flex-1" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Configuração
          </Button>
        </div>

        {/* Password verification dialog */}
        <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
          <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                Verificação de Segurança
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Digite sua senha de administrador para visualizar o token da API.
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleVerifyPassword();
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleVerifyPassword} disabled={verifyingPassword}>
                {verifyingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};