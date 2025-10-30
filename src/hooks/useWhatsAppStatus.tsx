import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useWhatsAppStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkConnectionStatus();

    // Verificar status a cada 30 segundos
    const interval = setInterval(checkConnectionStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'getStatus' }
      });

      if (error) throw error;

      const isOpen = data?.instance?.state === 'open';
      setIsConnected(isOpen);
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  return { isConnected, isChecking, refresh: checkConnectionStatus };
}
