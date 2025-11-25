import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Webhook, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

export function WebhookConfiguration() {
  const [copied, setCopied] = useState(false);
  
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada para a área de transferência!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <CardTitle>Configuração do Webhook</CardTitle>
        </div>
        <CardDescription>
          Configure o webhook na Evolution API para receber mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            Para que as mensagens dos clientes apareçam na aba Atendimentos, você precisa configurar o webhook na Evolution API.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <label className="text-sm font-medium">URL do Webhook</label>
          <div className="flex gap-2">
            <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
              {webhookUrl}
            </div>
            <Button 
              variant="outline" 
              size="icon"
              onClick={copyToClipboard}
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-medium">Passos para configurar:</div>
          <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
            <li>Acesse a API da Evolution no endpoint de configuração de webhook</li>
            <li>Configure o webhook para a instância <Badge variant="secondary">entregas</Badge></li>
            <li>Cole a URL do webhook acima</li>
            <li>
              <strong>IMPORTANTE:</strong> Ative o evento <Badge variant="outline">messages.upsert</Badge> (recebe mensagens dos clientes)
            </li>
            <li>Configure <code className="text-xs bg-muted px-1 py-0.5 rounded">webhook_by_events: true</code></li>
            <li>Salve a configuração e teste enviando uma mensagem do WhatsApp</li>
          </ol>
        </div>
        
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-900">
          <AlertDescription className="text-sm">
            <strong>⚠️ Atenção:</strong> Se você não receber mensagens dos clientes, verifique se o webhook está configurado corretamente na Evolution API com o evento <code className="text-xs bg-background px-1 py-0.5 rounded">messages.upsert</code> ativado.
          </AlertDescription>
        </Alert>

        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
          <AlertDescription className="text-sm">
            <strong>Exemplo de requisição para configurar webhook:</strong>
            <pre className="mt-2 p-3 bg-background rounded text-xs overflow-x-auto">
{`POST {EVOLUTION_API_URL}/webhook/set/{instance_name}
Headers:
  apikey: {EVOLUTION_API_KEY}
  
Body:
{
  "url": "${webhookUrl}",
  "webhook_by_events": true,
  "events": [
    "messages.upsert"
  ]
}`}
            </pre>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
