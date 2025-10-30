import { useWhatsAppStatus } from "@/hooks/useWhatsAppStatus";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WhatsAppStatusIndicator() {
  const { isConnected, isChecking } = useWhatsAppStatus();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className="relative">
              <div 
                className={`h-3 w-3 rounded-full ${
                  isChecking 
                    ? 'bg-gray-400' 
                    : isConnected 
                      ? 'bg-green-500 animate-pulse' 
                      : 'bg-red-500'
                }`}
              />
              {isConnected && (
                <div className="absolute inset-0 h-3 w-3 rounded-full bg-green-500 animate-ping opacity-75" />
              )}
            </div>
            <span className="text-sm font-medium">
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
