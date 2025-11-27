import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WhatsAppStatusIndicator() {
  const { isConnected, isChecking } = useWhatsAppStatus();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/20 transition-all duration-200">
            <div className="relative">
              <div 
                className={`h-2.5 w-2.5 rounded-full ${
                  isChecking 
                    ? 'bg-gray-300' 
                    : isConnected 
                      ? 'bg-green-400 animate-pulse shadow-lg shadow-green-400/50' 
                      : 'bg-red-400 shadow-lg shadow-red-400/50'
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-green-400 animate-ping opacity-75" />
              )}
            </div>
            <span className="text-xs font-medium text-white hidden sm:inline">
              {isChecking ? 'Verificando...' : isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isChecking 
              ? 'Verificando status da conexão' 
              : isConnected 
                ? 'WhatsApp conectado e pronto para enviar mensagens' 
                : 'WhatsApp não conectado. Vá em Configurações para conectar'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
