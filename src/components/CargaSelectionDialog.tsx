import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Package, Calendar, User, Truck } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Carga {
  id: number;
  data: string;
  motorista: number;
  nomeMotorista: string;
  transportadora: number;
  nomeTransportadora: string;
  status: string;
  pedidos: any[];
}

interface CargaSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCargaSelected: (cargaId: number) => void;
  campaignId: string;
}

export function CargaSelectionDialog({ 
  open, 
  onOpenChange, 
  onCargaSelected,
  campaignId 
}: CargaSelectionDialogProps) {
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCargaId, setSelectedCargaId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCargas();
    }
  }, [open]);

  const loadCargas = async () => {
    setLoading(true);
    try {
      // Buscar cargas dos últimos 30 dias
      const { data, error } = await supabase.functions.invoke('fetch-cargas', {
        body: {}
      });

    if (error) throw error;

    if (data?.retorno?.cargas) {
      setCargas(data.retorno.cargas);
    } else {
      toast({
        title: "Nenhuma carga encontrada",
        description: "Não há cargas disponíveis nos últimos 30 dias",
        variant: "destructive",
      });
    }
    } catch (error: any) {
      console.error('Erro ao carregar cargas:', error);
      toast({
        title: "Erro ao carregar cargas",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedCargaId) {
      onCargaSelected(selectedCargaId);
      onOpenChange(false);
      setSelectedCargaId(null);
    }
  };

  const formatDate = (dateString: string) => {
    // dateString vem como "20250806" (YYYYMMDD)
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return format(date, "dd/MM/yyyy", { locale: ptBR });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      'FATU': { label: 'Faturado', variant: 'default' },
      'PEND': { label: 'Pendente', variant: 'secondary' },
      'ENTR': { label: 'Entregue', variant: 'outline' },
    };

    const config = statusConfig[status] || { label: status, variant: 'secondary' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Selecionar Carga para Pesquisa
          </DialogTitle>
          <DialogDescription>
            Escolha a carga que deseja enviar para pesquisa de satisfação
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-4">
            <div className="space-y-3">
              {cargas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma carga disponível
                </div>
              ) : (
                cargas.map((carga) => (
                  <Card
                    key={carga.id}
                    className={`cursor-pointer transition-all hover:border-primary ${
                      selectedCargaId === carga.id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setSelectedCargaId(carga.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg">
                              Carga #{carga.id}
                            </div>
                            {getStatusBadge(carga.status)}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(carga.data)}</span>
                            </div>
                            
                            {carga.nomeMotorista && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <User className="h-4 w-4" />
                                <span>{carga.nomeMotorista}</span>
                              </div>
                            )}
                            
                            {carga.nomeTransportadora && (
                              <div className="flex items-center gap-2 text-muted-foreground col-span-2">
                                <Truck className="h-4 w-4" />
                                <span>{carga.nomeTransportadora}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <Package className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {carga.pedidos?.length || 0} pedido(s)
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              setSelectedCargaId(null);
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedCargaId || loading}
          >
            Confirmar Seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
