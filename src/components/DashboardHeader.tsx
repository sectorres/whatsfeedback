import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { WhatsAppStatusIndicator } from "@/components/WhatsAppStatusIndicator";

export const DashboardHeader = () => {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
  };

  return (
    <header className="border-b bg-card">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sistema de Gestão</h1>
            <p className="text-sm text-muted-foreground">
              Gerenciamento de WhatsApp e Pedidos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
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
