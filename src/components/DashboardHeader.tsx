import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { WhatsAppStatusIndicator } from "@/components/WhatsAppStatusIndicator";

interface DashboardHeaderProps {
  children?: React.ReactNode;
}

export const DashboardHeader = ({ children }: DashboardHeaderProps) => {
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
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            {logoUrl ? (
              <img 
                src={logoUrl} 
                alt="Logo" 
                className="h-7 w-auto object-contain"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <h1 className="text-sm font-bold whitespace-nowrap">WhatsFeedback</h1>
          </div>
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <WhatsAppStatusIndicator />
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
