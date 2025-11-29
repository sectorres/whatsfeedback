import { useState } from "react";
import { Button } from "./ui/button";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function OrderSyncButton() {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      toast.info("Iniciando sincronização de pedidos...");
      
      const { data, error } = await supabase.functions.invoke("sync-order-details");

      if (error) throw error;

      if (data?.success) {
        toast.success(
          `Sincronização concluída! ${data.synced} pedidos atualizados de ${data.total} verificados.`
        );
      } else {
        toast.error("Erro na sincronização");
      }
    } catch (error) {
      console.error("Erro ao sincronizar pedidos:", error);
      toast.error("Erro ao sincronizar pedidos");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button 
      onClick={handleSync} 
      disabled={syncing}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? "Sincronizando..." : "Sincronizar Pedidos"}
    </Button>
  );
}