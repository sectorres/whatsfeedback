import { useState, useEffect } from "react";
import { Loader2, Package, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";

interface CustomerOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string;
  customerName?: string;
}

interface Produto {
  id: number;
  descricao: string;
  pesoBruto: number;
  quantidade: number;
  periodoEntrega: string;
  empresaColeta: number;
}

interface Cliente {
  id: number;
  nome: string;
  documento: string;
  telefone: string;
  celular: string;
  cep: string;
  endereco: string;
  referencia: string;
  bairro: string;
  setor: string;
  cidade: string;
  estado: string;
  observacao: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal: string;
  empresa: number;
  documento: number;
  serie: string;
  data: string;
  pesoBruto: number;
  valor: number;
  rota: string;
  cliente: Cliente;
  produtos: Produto[];
  motorista?: string;
}

interface Carga {
  id: number;
  data: string;
  motorista: number;
  nomeMotorista: string;
  transportadora: number;
  nomeTransportadora: string;
  status: string;
  pedidos: Pedido[];
}

export const CustomerOrdersDialog = ({
  open,
  onOpenChange,
  customerPhone,
  customerName,
}: CustomerOrdersDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Pedido[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open && customerPhone) {
      fetchCustomerOrders();
    }
  }, [open, customerPhone]);

  const normalizePhone = (phone: string): string => {
    return phone.replace(/\D/g, '').replace(/^55/, '').replace(/^0+/, '');
  };

  const fetchCustomerOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-cargas');

      if (error) throw error;

      if (data && data.status === 'SUCESSO' && data.retorno?.cargas) {
        const normalizedCustomerPhone = normalizePhone(customerPhone);
        
        const customerOrders: Pedido[] = [];
        
        data.retorno.cargas.forEach((carga: Carga) => {
          carga.pedidos.forEach((pedido: Pedido) => {
            const pedidoTelefone = normalizePhone(pedido.cliente?.telefone || '');
            const pedidoCelular = normalizePhone(pedido.cliente?.celular || '');
            
            if (pedidoTelefone === normalizedCustomerPhone || pedidoCelular === normalizedCustomerPhone) {
              customerOrders.push({
                ...pedido,
                // Adicionar status da carga ao pedido para exibir
                rota: `${pedido.rota} - ${getStatusLabel(carga.status)}`,
                motorista: carga.nomeMotorista || 'Não atribuído'
              });
            }
          });
        });

        setOrders(customerOrders);
        
        if (customerOrders.length === 0) {
          toast.info("Nenhum pedido encontrado para este cliente");
        }
      }
    } catch (error) {
      console.error('Error fetching customer orders:', error);
      toast.error("Erro ao buscar pedidos do cliente");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const day = dateStr.slice(6, 8);
    const month = dateStr.slice(4, 6);
    const year = dateStr.slice(0, 4);
    return `${day}/${month}/${year}`;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'FATU': 'Faturado',
      'SEPA': 'Em Separação',
      'ABER': 'Aberto',
    };
    return statusMap[status] || status;
  };

  const toggleOrder = (orderId: number) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Pedidos do Cliente</DialogTitle>
          <DialogDescription>
            {customerName && <span className="font-medium">{customerName}</span>}
            {customerName && " - "}
            {customerPhone}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Package className="h-12 w-12 mb-2 opacity-50" />
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Card key={order.id} className="p-4">
                  <Collapsible
                    open={expandedOrders.has(order.id)}
                    onOpenChange={() => toggleOrder(order.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold text-sm">{order.pedido}</h4>
                          <Badge variant="outline" className="text-xs">
                            NF: {order.notaFiscal}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Data: {formatDate(order.data)}</p>
                          <p>Valor Total: R$ {order.valor?.toFixed(2) || '0.00'}</p>
                          {order.motorista && <p>Motorista: {order.motorista}</p>}
                          <p className="text-xs">{order.rota}</p>
                        </div>
                      </div>
                      <CollapsibleTrigger asChild>
                        <button className="p-2 hover:bg-accent rounded-md transition-colors">
                          {expandedOrders.has(order.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent className="mt-4">
                      <div className="border-t pt-4">
                        <h5 className="font-medium text-sm mb-3">Produtos</h5>
                        <div className="space-y-2">
                          {order.produtos?.map((produto) => (
                            <div
                              key={produto.id}
                              className="bg-muted/50 rounded-md p-3 text-sm"
                            >
                              <p className="font-medium mb-1">{produto.descricao}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                <p>Quantidade: {produto.quantidade}</p>
                                <p>Peso: {produto.pesoBruto} kg</p>
                                <p>Entrega: {produto.periodoEntrega}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
