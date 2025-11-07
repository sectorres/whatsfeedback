import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { WhatsAppStatusIndicator } from "@/components/WhatsAppStatusIndicator";
import { SendCounters } from "@/components/SendCounters";

export const DashboardHeader = () => {
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    loadLogo();
  }, []);

  const loadLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'logo_url')
        .maybeSingle();

      if (!error && data?.config_value) {
        setLogoUrl(data.config_value);
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold">WhatsFeedback</h1>
            <p className="text-xs text-muted-foreground">
              Gerenciamento de informativos e Pesquisa de satisfação
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <SendCounters />
          <WhatsAppStatusIndicator />
          <Button 
            variant="outline" 
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {loggingOut ? "Saindo..." : "Sair"}
          </Button>
        </div>
      </div>
    </header>
  );
};
