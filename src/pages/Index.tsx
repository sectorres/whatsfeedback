import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardStats } from "@/components/DashboardStats";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { OrderStatusTable } from "@/components/OrderStatusTable";
import { ApiConfiguration } from "@/components/ApiConfiguration";
import { WhatsAppConnection } from "@/components/WhatsAppConnection";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { ChangePassword } from "@/components/ChangePassword";
import { WebhookConfiguration } from "@/components/WebhookConfiguration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Settings, Headphones, LayoutDashboard } from "lucide-react";

const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="atendimento" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Atendimento
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardStats />
          </TabsContent>

          <TabsContent value="atendimento" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-4">Atendimento ao Cliente</h2>
              <p className="text-muted-foreground mb-6">
                Gerencie conversas e responda mensagens dos clientes em tempo real
              </p>
              <ConversationsPanel />
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <WhatsAppConnection onConnectionChange={setWhatsappConnected} />
            <CampaignBuilder whatsappConnected={whatsappConnected} />
            <Card className="bg-card border">
              <CardHeader>
                <CardTitle>Campanhas Recentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Atualização Semanal", status: "Ativa", sent: 234 },
                    { name: "Status de Entrega", status: "Ativa", sent: 567 },
                    { name: "Confirmação de Pedido", status: "Pausada", sent: 123 },
                  ].map((campaign, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.sent} mensagens enviadas</p>
                      </div>
                      <Badge variant={campaign.status === "Ativa" ? "default" : "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <OrderStatusTable />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <ApiConfiguration />
            <WebhookConfiguration />
            <ChangePassword />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
