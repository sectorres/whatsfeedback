import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Database, Key, Link } from "lucide-react";
import { toast } from "sonner";

export const ApiConfiguration = () => {
  const handleTestConnection = () => {
    toast.success("Conexão testada com sucesso!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Configuração da API
        </CardTitle>
        <CardDescription>
          Configure a integração com ServConCargasEntrega
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-url" className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            URL da API
          </Label>
          <Input
            id="api-url"
            placeholder="https://ec.torrescabral.com.br/shx-integrador/srv/ServConCargasEntrega/V1"
            defaultValue="https://ec.torrescabral.com.br/shx-integrador/srv/ServConCargasEntrega/V1"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="api-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Chave de Autenticação
          </Label>
          <Input
            id="api-key"
            type="password"
            placeholder="Digite sua chave de API"
          />
        </div>

        <div className="bg-muted p-4 rounded-lg space-y-2">
          <p className="text-sm font-medium">Parâmetros de Entrada:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• chave: Chave de solicitação (NUMÉRICO)</li>
            <li>• cargas: Relação de cargas para entrega (LISTA)</li>
          </ul>
        </div>

        <Button onClick={handleTestConnection} className="w-full">
          Testar Conexão
        </Button>
      </CardContent>
    </Card>
  );
};
