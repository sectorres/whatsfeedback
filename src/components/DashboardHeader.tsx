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
    <header className="bg-gradient-primary shadow-md animate-fade-in">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-shrink-0 animate-slide-in">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-9 w-auto object-contain drop-shadow-lg"
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
              <h1 className="text-base font-bold text-white drop-shadow-md whitespace-nowrap">WhatsFeedback</h1>
            </div>
            <div className="flex-1 min-w-0">
              {children}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <WhatsAppStatusIndicator />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm transition-all duration-200 hover:scale-105"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{loggingOut ? "Saindo..." : "Sair"}</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};
