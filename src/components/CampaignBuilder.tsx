import { useState } from "react";
import { Plus, Send, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

export const CampaignBuilder = () => {
  const [campaignName, setCampaignName] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("");

  const handleCreateCampaign = () => {
    if (!campaignName || !messageTemplate) {
      toast.error("Preencha todos os campos");
      return;
    }
    toast.success("Campanha criada com sucesso!");
    setCampaignName("");
    setMessageTemplate("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          Criar Nova Campanha
        </CardTitle>
        <CardDescription>
          Configure campanhas automáticas de atualização de status
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Nome da Campanha</Label>
          <Input
            id="campaign-name"
            placeholder="Ex: Atualização de Status de Entrega"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="message-template">Template de Mensagem</Label>
          <Textarea
            id="message-template"
            placeholder="Ex: Olá! Seu pedido #{pedido} está {status}. Previsão de entrega: {data}"
            value={messageTemplate}
            onChange={(e) => setMessageTemplate(e.target.value)}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            Use variáveis: {"{pedido}"}, {"{status}"}, {"{data}"}, {"{motorista}"}
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleCreateCampaign} className="flex-1">
            <Plus className="mr-2 h-4 w-4" />
            Criar Campanha
          </Button>
          <Button variant="outline" className="flex-1">
            <Send className="mr-2 h-4 w-4" />
            Enviar Teste
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
