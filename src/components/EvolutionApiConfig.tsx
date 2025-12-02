import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { MessageSquare, Key, Link, Server, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const EvolutionApiConfig = () => {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleTestConnection = async () => {
    if (!apiUrl || !apiKey || !instanceName) {
      toast.error("Preencha todos os campos antes de testar");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test connection by checking instance status
      const response = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
        method: 'GET',
        headers: {
          'apikey': apiKey,
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
    if (!apiUrl || !apiKey || !instanceName) {
      toast.error("Preencha todos os campos antes de salvar");
      return;
    }

    toast.info(
      "Para salvar as configurações da Evolution API, você precisa atualizar os secrets do projeto nas configurações do Lovable Cloud.",
      { duration: 8000 }
    );
    
    // Show the values that need to be configured
    console.log('Evolution API Config to save:');
    console.log('EVOLUTION_API_URL:', apiUrl);
    console.log('EVOLUTION_API_KEY:', apiKey);
    console.log('EVOLUTION_INSTANCE_NAME:', instanceName);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Configuração da Evolution API
        </CardTitle>
        <CardDescription>
          Configure a integração com a Evolution API para envio de mensagens WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="evolution-url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL da API
          </Label>
          <Input
            id="evolution-url"
            placeholder="https://sua-evolution-api.com"
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
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">Informações:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• A Evolution API é usada para enviar mensagens WhatsApp</li>
            <li>• Certifique-se de que a instância está conectada</li>
            <li>• As configurações são salvas como secrets do projeto</li>
          </ul>
        </div>

        <div className="flex gap-2">
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
          <Button onClick={handleSaveConfig} className="flex-1">
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
