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
    <header className="bg-gradient-primary shadow-md animate-fade-in sticky top-0 z-50">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0 animate-slide-in">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-7 sm:h-9 w-auto object-contain drop-shadow-lg"
                />
              ) : (
                <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <User className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
                </div>
              )}
              <h1 className="text-sm sm:text-base font-bold text-white drop-shadow-md whitespace-nowrap">WhatsFeedback</h1>
            </div>
            <div className="flex-1 min-w-0 hidden md:block">
              {children}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <WhatsAppStatusIndicator />
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm transition-all duration-200 hover:scale-105 h-8 sm:h-9 px-2 sm:px-3"
            >
              <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
              <span className="hidden sm:inline text-xs sm:text-sm">{loggingOut ? "Saindo..." : "Sair"}</span>
            </Button>
          </div>
        </div>
        {/* Mobile navigation */}
        <div className="md:hidden mt-2">
          {children}
        </div>
      </div>
    </header>
  );
};
