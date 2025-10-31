import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardStats } from "@/components/DashboardStats";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { SavedCampaigns } from "@/components/SavedCampaigns";
import { OrderStatusTable } from "@/components/OrderStatusTable";
import { ApiConfiguration } from "@/components/ApiConfiguration";
import { WhatsAppConnection } from "@/components/WhatsAppConnection";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { ChangePassword } from "@/components/ChangePassword";
import { WebhookConfiguration } from "@/components/WebhookConfiguration";
import { BlacklistManager } from "@/components/BlacklistManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Settings, Headphones, LayoutDashboard, Star } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { SatisfactionSurveys } from "@/components/SatisfactionSurveys";

const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const unreadCount = useUnreadCount();
  const { isConnected } = useWhatsAppStatus();

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6 lg:w-[900px]">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="atendimento" className="flex items-center gap-2">
              <Headphones className="h-4 w-4" />
              Atendimento
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Campanhas
            </TabsTrigger>
            <TabsTrigger value="satisfaction" className="flex items-center gap-2">
              <Star className="h-4 w-4" />
              Satisfação
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
            <CampaignBuilder whatsappConnected={isConnected} />
            <SavedCampaigns />
            <BlacklistManager />
          </TabsContent>

          <TabsContent value="satisfaction">
            <SatisfactionSurveys />
          </TabsContent>

          <TabsContent value="orders">
            <OrderStatusTable />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <WhatsAppConnection onConnectionChange={setWhatsappConnected} />
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
