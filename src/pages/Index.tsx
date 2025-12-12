import { useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { DashboardStats } from "@/components/DashboardStats";
import { CampaignBuilder } from "@/components/CampaignBuilder";
import { SavedCampaigns } from "@/components/SavedCampaigns";
import { OrderStatusTable } from "@/components/OrderStatusTable";
import { ApiConfiguration } from "@/components/ApiConfiguration";
import { EvolutionApiConfig } from "@/components/EvolutionApiConfig";
import { WhatsAppConnection } from "@/components/WhatsAppConnection";
import { ConversationsPanel } from "@/components/ConversationsPanel";
import { ChangePassword } from "@/components/ChangePassword";
import { WebhookConfiguration } from "@/components/WebhookConfiguration";
import { BlacklistManager } from "@/components/BlacklistManager";
import { SendDelayConfig } from "@/components/SendDelayConfig";
import { DataClearConfig } from "@/components/DataClearConfig";
import { OrderSyncButton } from "@/components/OrderSyncButton";
import { LogoManager } from "@/components/LogoManager";
import { WhatsAppTemplateManager } from "@/components/WhatsAppTemplateManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Package, Settings, Headphones, LayoutDashboard, Star, BarChart3, Lock } from "lucide-react";
import { useUnreadCount } from "@/hooks/useUnreadCount";
import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { SatisfactionSurveys } from "@/components/SatisfactionSurveys";
import { IpWhitelistManager } from "@/components/IpWhitelistManager";
import { DriverPerformance } from "@/components/DriverPerformance";
import { SatisfactionSurveyConfig } from "@/components/SatisfactionSurveyConfig";
import { BotMessagesConfig } from "@/components/BotMessagesConfig";
import { BusinessHoursConfig } from "@/components/BusinessHoursConfig";
import { AutoTemplateSenderConfig } from "@/components/AutoTemplateSenderConfig";
import { CampaignCreationConfig } from "@/components/CampaignCreationConfig";
import { RestrictedDriversConfig } from "@/components/RestrictedDriversConfig";
import { RestrictedOrderPrefixesConfig } from "@/components/RestrictedOrderPrefixesConfig";
import { RestrictedOrderPrefixesFatuConfig } from "@/components/RestrictedOrderPrefixesFatuConfig";
import { AiChatConfig } from "@/components/AiChatConfig";
import { AiTriggerPhrasesConfig } from "@/components/AiTriggerPhrasesConfig";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Index = () => {
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [configUnlocked, setConfigUnlocked] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const unreadCount = useUnreadCount();
  const { isConnected } = useWhatsAppStatus();

  const handleTabChange = (value: string) => {
    if (value === "config" && !configUnlocked) {
      setShowPasswordDialog(true);
      return;
    }
    setActiveTab(value);
  };

  const handlePasswordSubmit = async () => {
    if (!password.trim()) {
      toast.error("Digite a senha");
      return;
    }

    setVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "admin@admin.com",
        password: password,
      });

      if (error) {
        toast.error("Senha incorreta");
        return;
      }

      setConfigUnlocked(true);
      setShowPasswordDialog(false);
      setPassword("");
      setActiveTab("config");
      toast.success("Acesso liberado");
    } catch (error) {
      toast.error("Erro ao verificar senha");
    } finally {
      setVerifying(false);
    }
  };

  return <div className="min-h-screen bg-background flex flex-col">
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Acesso às Configurações
            </DialogTitle>
            <DialogDescription>
              Digite a senha do administrador para acessar as configurações do sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              type="password"
              placeholder="Senha do administrador"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handlePasswordSubmit} disabled={verifying}>
                {verifying ? "Verificando..." : "Acessar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} defaultValue="dashboard" className="flex-1 flex flex-col">
        <DashboardHeader>
          <TabsList className="flex w-full h-10 gap-0">
            <TabsTrigger 
              value="dashboard" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <LayoutDashboard className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger 
              value="campaigns" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Avisos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="satisfaction" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <Star className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Pesquisas</span>
            </TabsTrigger>
            <TabsTrigger 
              value="atendimento" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <Headphones className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Atendimento</span>
              {unreadCount > 0 && <Badge variant="destructive" className="ml-0.5 h-3.5 md:h-4 min-w-3.5 md:min-w-4 flex items-center justify-center px-1 text-[8px] md:text-[9px] shadow-md absolute -top-1 -right-1 sm:static">
                  {unreadCount}
                </Badge>}
            </TabsTrigger>
            <TabsTrigger 
              value="desempenho" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <BarChart3 className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Desempenho</span>
            </TabsTrigger>
            <TabsTrigger 
              value="orders" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <Package className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Pedidos</span>
            </TabsTrigger>
            <TabsTrigger 
              value="config" 
              className="flex items-center gap-1.5 text-sm sm:text-base text-white/70 hover:text-white data-[state=active]:text-white data-[state=active]:font-medium"
            >
              <Settings className="h-3 w-3 md:h-3.5 md:w-3.5 flex-shrink-0" />
              <span className="hidden sm:inline font-medium truncate">Config</span>
            </TabsTrigger>
          </TabsList>
        </DashboardHeader>
      
        <main className="container mx-auto px-2 sm:px-4 py-2 sm:py-4 flex-1">
          <TabsContent value="dashboard" className="space-y-3 sm:space-y-6 mt-0">
            <DashboardStats />
          </TabsContent>

          <TabsContent value="atendimento" className="overflow-hidden mt-0 h-[calc(100vh-8rem)] sm:h-auto">
            <div className="h-full">
              <ConversationsPanel isOnAtendimentoTab={activeTab === "atendimento"} />
            </div>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-3 sm:space-y-6 mt-0">
            <CampaignBuilder whatsappConnected={isConnected} />
            <SavedCampaigns />
            <BlacklistManager />
          </TabsContent>

          <TabsContent value="satisfaction" className="mt-0">
            <SatisfactionSurveys />
          </TabsContent>

          <TabsContent value="desempenho" className="mt-0">
            <DriverPerformance />
          </TabsContent>

          <TabsContent value="orders" className="mt-0">
            <OrderStatusTable />
          </TabsContent>

          <TabsContent value="config" className="space-y-3 sm:space-y-4 mt-0">
            <Tabs defaultValue="appearance" className="w-full">
              <TabsList className="grid w-full grid-cols-7 h-auto">
                <TabsTrigger value="appearance" className="text-xs sm:text-sm whitespace-nowrap">Aparência</TabsTrigger>
                <TabsTrigger value="integrations" className="text-xs sm:text-sm whitespace-nowrap">Integrações</TabsTrigger>
                <TabsTrigger value="templates" className="text-xs sm:text-sm whitespace-nowrap">Templates</TabsTrigger>
                <TabsTrigger value="auto-send" className="text-xs sm:text-sm whitespace-nowrap">Envio Auto</TabsTrigger>
                <TabsTrigger value="communication" className="text-xs sm:text-sm whitespace-nowrap">Comunicação</TabsTrigger>
                <TabsTrigger value="security" className="text-xs sm:text-sm whitespace-nowrap">Segurança</TabsTrigger>
                <TabsTrigger value="system" className="text-xs sm:text-sm whitespace-nowrap">Sistema</TabsTrigger>
              </TabsList>

              <TabsContent value="appearance" className="space-y-6 mt-4">
                <LogoManager />
              </TabsContent>

              <TabsContent value="integrations" className="space-y-6 mt-4">
                <WhatsAppConnection onConnectionChange={setWhatsappConnected} />
                <EvolutionApiConfig />
                <ApiConfiguration />
                <WebhookConfiguration />
              </TabsContent>

              <TabsContent value="templates" className="space-y-6 mt-4">
                <WhatsAppTemplateManager />
              </TabsContent>

              <TabsContent value="auto-send" className="space-y-6 mt-4">
                <AutoTemplateSenderConfig />
                <RestrictedDriversConfig />
                <RestrictedOrderPrefixesConfig />
                <RestrictedOrderPrefixesFatuConfig />
              </TabsContent>

              <TabsContent value="communication" className="space-y-6 mt-4">
                <AiChatConfig />
                <AiTriggerPhrasesConfig />
                <CampaignCreationConfig />
                <BusinessHoursConfig />
                <BotMessagesConfig />
                <SendDelayConfig />
                <SatisfactionSurveyConfig />
              </TabsContent>

              <TabsContent value="security" className="space-y-6 mt-4">
                <IpWhitelistManager />
                <ChangePassword />
              </TabsContent>

              <TabsContent value="system" className="space-y-6 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Sincronização de Pedidos</CardTitle>
                    <CardDescription>
                      Sincroniza os dados completos dos pedidos que ainda estão disponíveis na API
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <OrderSyncButton />
                  </CardContent>
                </Card>
                <DataClearConfig />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </main>

        <footer className="border-t bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 mt-auto">
          <div className="container mx-auto px-2 sm:px-6 py-1.5 sm:py-2 flex justify-center sm:justify-end">
            <p className="text-[9px] sm:text-[10px] text-muted-foreground/70 font-light text-center sm:text-right">
              WhatsFeedback | Desenvolvido por: Moisés Cavalcante | v1.0.0
            </p>
          </div>
        </footer>
      </Tabs>
    </div>;
};
export default Index;