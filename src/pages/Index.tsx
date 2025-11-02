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
import { PermissionsManager } from "@/components/PermissionsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Settings, Headphones, LayoutDashboard, Star, Shield } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { SatisfactionSurveys } from "@/components/SatisfactionSurveys";
import { IpWhitelistManager } from "@/components/IpWhitelistManager";

const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const unreadCount = useUnreadCount();
  const { isConnected } = useWhatsAppStatus();
  const { isAdmin, allowedModules, loading } = useUserPermissions();

  const hasAccess = (module: string) => {
    return isAdmin || allowedModules.includes(module);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const numTabs = [
    hasAccess('dashboard_stats'),
    hasAccess('campaigns'),
    hasAccess('satisfaction_surveys'),
    hasAccess('conversations'),
    hasAccess('order_status'),
    isAdmin
  ].filter(Boolean).length + 1; // +1 para config que sempre aparece

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-6 py-4">
        <Tabs defaultValue={hasAccess('dashboard_stats') ? "dashboard" : "config"} className="space-y-3">
          <TabsList className={`grid w-full grid-cols-${numTabs} bg-primary text-primary-foreground`}>
            {hasAccess('dashboard_stats') && (
              <TabsTrigger value="dashboard" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Dashboard</span>
              </TabsTrigger>
            )}
            {hasAccess('campaigns') && (
              <TabsTrigger value="campaigns" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Aviso de entregas</span>
              </TabsTrigger>
            )}
            {hasAccess('satisfaction_surveys') && (
              <TabsTrigger value="satisfaction" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Star className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Pesquisa de satisfação</span>
              </TabsTrigger>
            )}
            {hasAccess('conversations') && (
              <TabsTrigger value="atendimento" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Headphones className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Atendimento</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 flex items-center justify-center px-1.5">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasAccess('order_status') && (
              <TabsTrigger value="orders" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Pedidos</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="config" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Settings className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="permissions" className="flex items-center gap-1.5 text-xs sm:text-sm">
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Permissões</span>
              </TabsTrigger>
            )}
          </TabsList>

          {hasAccess('dashboard_stats') && (
            <TabsContent value="dashboard" className="space-y-6">
              <DashboardStats />
            </TabsContent>
          )}

          {hasAccess('conversations') && (
            <TabsContent value="atendimento" className="space-y-2">
              <div>
                <h2 className="text-xl font-bold mb-2">Atendimento ao Cliente</h2>
                <p className="text-muted-foreground mb-3 text-sm">
                  Gerencie conversas e responda mensagens dos clientes em tempo real
                </p>
                <ConversationsPanel />
              </div>
            </TabsContent>
          )}

          {hasAccess('campaigns') && (
            <TabsContent value="campaigns" className="space-y-6">
              <CampaignBuilder whatsappConnected={isConnected} />
              <SavedCampaigns />
              <BlacklistManager />
            </TabsContent>
          )}

          {hasAccess('satisfaction_surveys') && (
            <TabsContent value="satisfaction">
              <SatisfactionSurveys />
            </TabsContent>
          )}

          {hasAccess('order_status') && (
            <TabsContent value="orders">
              <OrderStatusTable />
            </TabsContent>
          )}

          <TabsContent value="config" className="space-y-6">
            {hasAccess('whatsapp_connection') && (
              <WhatsAppConnection onConnectionChange={setWhatsappConnected} />
            )}
            {hasAccess('ip_whitelist') && <IpWhitelistManager />}
            {hasAccess('send_delay_config') && <SendDelayConfig />}
            {hasAccess('api_config') && <ApiConfiguration />}
            {hasAccess('webhook_config') && <WebhookConfiguration />}
            {hasAccess('change_password') && <ChangePassword />}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="permissions">
              <PermissionsManager />
            </TabsContent>
          )}
        </Tabs>
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="container mx-auto px-6 py-4 text-center text-sm text-muted-foreground">
          WhatsFeedback | Desenvolvido por: Moisés Cavalcante. Versão: 1.0.0
        </div>
      </footer>
    </div>
  );
};

export default Index;
