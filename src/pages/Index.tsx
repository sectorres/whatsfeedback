import { useState, useEffect } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ChatInterface } from "@/components/ChatInterface";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { OrderStatusTable } from "@/components/OrderStatusTable";
import { ApiConfiguration } from "@/components/ApiConfiguration";
import { WhatsAppConnection } from "@/components/WhatsAppConnection";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { ChangePassword } from "@/components/ChangePassword";
import { WebhookConfiguration } from "@/components/WebhookConfiguration";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Calendar, Package, Settings, Loader2, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Carga {
  id: number;
  pedidos: any[];
  status: string;
}

const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [pedidosAbertos, setPedidosAbertos] = useState(0);
  const [pedidosFaturados, setPedidosFaturados] = useState(0);
  const [totalCargas, setTotalCargas] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const { data, error } = await supabase.functions.invoke("fetch-cargas");

      if (error) throw error;

      if (data && data.status === "SUCESSO" && data.retorno?.cargas) {
        const cargas: Carga[] = data.retorno.cargas;
        
        // Total de cargas
        setTotalCargas(cargas.length);
        
        // Pedidos abertos (status ABER)
        const abertos = cargas
          .filter(c => c.status === "ABER")
          .reduce((sum, carga) => sum + (carga.pedidos?.length || 0), 0);
        setPedidosAbertos(abertos);
        
        // Pedidos faturados (status FATU)
        const faturados = cargas
          .filter(c => c.status === "FATU")
          .reduce((sum, carga) => sum + (carga.pedidos?.length || 0), 0);
        setPedidosFaturados(faturados);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="chat" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-[750px]">
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
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
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Pedidos Abertos</p>
                    {loadingStats ? (
                      <Loader2 className="h-8 w-8 animate-spin text-warning mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-warning mt-2">{pedidosAbertos}</p>
                    )}
                  </div>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Pedidos Faturados</p>
                    {loadingStats ? (
                      <Loader2 className="h-8 w-8 animate-spin text-success mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-success mt-2">{pedidosFaturados}</p>
                    )}
                  </div>
                  <div className="bg-card border rounded-lg p-6">
                    <p className="text-sm text-muted-foreground">Total de Cargas</p>
                    {loadingStats ? (
                      <Loader2 className="h-8 w-8 animate-spin text-primary mt-2" />
                    ) : (
                      <p className="text-3xl font-bold text-primary mt-2">{totalCargas}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
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

// Import missing components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default Index;
