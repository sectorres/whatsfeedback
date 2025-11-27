import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { WhatsAppStatusIndicator } from "@/components/WhatsAppStatusIndicator";

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
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <img 
              src={logoUrl} 
              alt="Logo" 
              className="h-8 w-auto object-contain flex-shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold whitespace-nowrap">WhatsFeedback</h1>
            <span className="hidden lg:inline text-xs text-muted-foreground border-l pl-2">
              Gerenciamento de informativos e Pesquisa de satisfação
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WhatsAppStatusIndicator />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex-shrink-0"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
