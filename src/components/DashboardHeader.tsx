import { MessageSquare, Settings } from "lucide-react";
import { Button } from "./ui/button";

export const DashboardHeader = () => {
  return (
    <header className="bg-gradient-primary text-primary-foreground shadow-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Chatbot</h1>
              <p className="text-sm opacity-90">Sistema de Campanhas de Status</p>
            </div>
          </div>
          <Button variant="secondary" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            Configurações
          </Button>
        </div>
      </div>
    </header>
  );
};
