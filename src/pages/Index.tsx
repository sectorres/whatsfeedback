import { DashboardHeader } from "@/components/DashboardHeader";
import { ChatInterface } from "@/components/ChatInterface";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { OrderStatusTable } from "@/components/OrderStatusTable";
import { ApiConfiguration } from "@/components/ApiConfiguration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Calendar, Package, Settings } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
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
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-4">Interface do Chatbot</h2>
                <p className="text-muted-foreground mb-6">
                  Teste e visualize como seus clientes receberão as mensagens via WhatsApp
                </p>
                <ChatInterface />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-4">Estatísticas</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
                    <p className="text-3xl font-bold text-primary mt-2">1,234</p>
                  </div>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
                    <p className="text-3xl font-bold text-success mt-2">98%</p>
                  </div>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Campanhas Ativas</p>
                    <p className="text-3xl font-bold text-info mt-2">5</p>
                  </div>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Respostas</p>
                    <p className="text-3xl font-bold text-warning mt-2">892</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-6">
            <CampaignBuilder />
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

          <TabsContent value="config">
            <ApiConfiguration />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

// Import missing components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default Index;
