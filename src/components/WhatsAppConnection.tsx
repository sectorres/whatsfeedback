import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Loader2, QrCode, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppConnectionProps {
  onConnectionChange?: (connected: boolean) => void;
}

export const WhatsAppConnection = ({ onConnectionChange }: WhatsAppConnectionProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string>("");
  const [showQRDialog, setShowQRDialog] = useState(false);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'getStatus' }
      });

      if (error) throw error;

      const isOpen = data?.instance?.state === 'open';
      setIsConnected(isOpen);
      onConnectionChange?.(isOpen);
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setShowQRDialog(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'getQRCode' }
      });

      if (error) throw error;

      if (data.status === 'connected') {
        setIsConnected(true);
        setShowQRDialog(false);
        onConnectionChange?.(true);
        toast.success("WhatsApp já está conectado!");
        setIsConnecting(false);
        return;
      }

      if (data.qrcode?.base64) {
        setQrCode(`data:image/png;base64,${data.qrcode.base64}`);
        setIsConnecting(false);

        const pollInterval = setInterval(async () => {
          try {
            const { data: statusData } = await supabase.functions.invoke('whatsapp-connect', {
              body: { action: 'getStatus' }
            });

            if (statusData?.instance?.state === 'open') {
              clearInterval(pollInterval);
              setIsConnected(true);
              setShowQRDialog(false);
              onConnectionChange?.(true);
              toast.success("WhatsApp conectado com sucesso!");
            }
          } catch (error) {
            console.error('Error polling status:', error);
          }
        }, 2000);

        setTimeout(() => clearInterval(pollInterval), 120000);
      }
    } catch (error) {
      console.error('Error connecting:', error);
      setIsConnecting(false);
      toast.error("Falha ao conectar WhatsApp. Verifique as configurações.");
    }
  };

  const handleDisconnect = async () => {
    try {
      const { error } = await supabase.functions.invoke('whatsapp-connect', {
        body: { action: 'disconnect' }
      });

      if (error) throw error;

      setIsConnected(false);
      setQrCode("");
      toast.info("WhatsApp desconectado");
      onConnectionChange?.(false);
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error("Falha ao desconectar WhatsApp");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Conexão WhatsApp
          </CardTitle>
          <CardDescription>
            Conecte seu WhatsApp para enviar campanhas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <CheckCircle className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {isConnected ? "WhatsApp Conectado" : "WhatsApp Desconectado"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {isConnected
                      ? "Pronto para enviar mensagens"
                      : "Escaneie o QR Code para conectar"}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <Button variant="outline" onClick={handleDisconnect}>
                  Desconectar
                </Button>
              ) : (
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" />
                  )}
                  Conectar
                </Button>
              )}
            </div>

            {isConnected && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <p className="text-sm text-success font-medium">
                  ✓ Você pode criar e enviar campanhas agora
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-6">
            {isConnecting ? (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="border-4 border-primary rounded-lg p-2">
                  <img 
                    src={qrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64"
                  />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">Como conectar:</p>
                  <ol className="text-xs text-muted-foreground space-y-1 text-left">
                    <li>1. Abra o WhatsApp no seu celular</li>
                    <li>2. Toque em Menu ou Configurações</li>
                    <li>3. Toque em Aparelhos conectados</li>
                    <li>4. Toque em Conectar um aparelho</li>
                    <li>5. Aponte seu celular para esta tela</li>
                  </ol>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
