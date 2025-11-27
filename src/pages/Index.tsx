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
import { SendDelayConfig } from "@/components/SendDelayConfig";
import { DataClearConfig } from "@/components/DataClearConfig";
import { LogoManager } from "@/components/LogoManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Settings, Headphones, LayoutDashboard, Star, BarChart3 } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { SatisfactionSurveys } from "@/components/SatisfactionSurveys";
import { IpWhitelistManager } from "@/components/IpWhitelistManager";
import { DriverPerformance } from "@/components/DriverPerformance";
import { SatisfactionSurveyConfig } from "@/components/SatisfactionSurveyConfig";
const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const unreadCount = useUnreadCount();
  const {
    isConnected
  } = useWhatsAppStatus();
  return <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="dashboard" className="space-y-3">
          <TabsList className="grid w-full grid-cols-7 bg-primary text-primary-foreground">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Calendar className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Aviso de entregas</span>
            </TabsTrigger>
            <TabsTrigger value="satisfaction" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Star className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Pesquisa de satisfação</span>
            </TabsTrigger>
            <TabsTrigger value="atendimento" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Headphones className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Atendimento</span>
              {unreadCount > 0 && <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5">
                  {unreadCount}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger value="desempenho" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Desempenho</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Package className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <DashboardStats />
          </TabsContent>

          <TabsContent value="atendimento" className="space-y-2">
            <div>
              
              
              <ConversationsPanel isOnAtendimentoTab={activeTab === "atendimento"} />
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

          <TabsContent value="desempenho">
            <DriverPerformance />
          </TabsContent>

          <TabsContent value="orders">
            <OrderStatusTable />
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <Tabs defaultValue="appearance" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="appearance">Aparência</TabsTrigger>
                <TabsTrigger value="integrations">Integrações</TabsTrigger>
                <TabsTrigger value="communication">Comunicação</TabsTrigger>
                <TabsTrigger value="security">Segurança</TabsTrigger>
                <TabsTrigger value="system">Sistema</TabsTrigger>
              </TabsList>

              <TabsContent value="appearance" className="space-y-6 mt-4">
                <LogoManager />
              </TabsContent>

              <TabsContent value="integrations" className="space-y-6 mt-4">
                <WhatsAppConnection onConnectionChange={setWhatsappConnected} />
                <ApiConfiguration />
                <WebhookConfiguration />
              </TabsContent>

              <TabsContent value="communication" className="space-y-6 mt-4">
                <SendDelayConfig />
                <SatisfactionSurveyConfig />
              </TabsContent>

              <TabsContent value="security" className="space-y-6 mt-4">
                <IpWhitelistManager />
                <ChangePassword />
              </TabsContent>

              <TabsContent value="system" className="space-y-6 mt-4">
                <DataClearConfig />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="container mx-auto px-6 py-4 text-center text-sm text-muted-foreground">
          WhatsFeedback | Desenvolvido por: Moisés Cavalcante. Versão: 1.0.0
        </div>
      </footer>
    </div>;
};
export default Index;