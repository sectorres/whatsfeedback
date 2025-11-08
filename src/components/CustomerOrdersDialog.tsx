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
      <DialogContent className="max-w-4xl max-h-[85vh] bg-gradient-to-br from-blue-50 to-background border-blue-100">
        <DialogHeader className="pb-4 border-b border-blue-100">
          <DialogTitle className="text-xl font-bold bg-gradient-blue bg-clip-text text-transparent">
            Pedidos do Cliente
          </DialogTitle>
          <DialogDescription className="text-sm mt-2">
            {customerName && <span className="font-semibold text-blue-700">{customerName}</span>}
            {customerName && <span className="mx-2 text-blue-500">•</span>}
            <span className="text-blue-600">{customerPhone}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[65vh] pr-4 mt-2">
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
            <div className="space-y-4">
              {orders.map((order) => (
                <Card key={order.id} className="border-blue-100 bg-gradient-to-br from-white to-blue-50/30 dark:from-card dark:to-blue-100/5 shadow-md hover:shadow-lg transition-all duration-300">
                  <Collapsible
                    open={expandedOrders.has(order.id)}
                    onOpenChange={() => toggleOrder(order.id)}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="p-1.5 bg-gradient-blue rounded-lg">
                              <Package className="h-3.5 w-3.5 text-white" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-blue-700">{order.pedido}</h4>
                              <Badge variant="outline" className="text-[10px] mt-1 border-blue-300 text-blue-600">
                                NF: {order.notaFiscal}
                              </Badge>
                            </div>
                          </div>
                          <div className="ml-11 space-y-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-medium">Data:</span>
                                <span className="text-foreground">{formatDate(order.data)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-blue-600 font-medium">Valor:</span>
                                <span className="text-foreground font-semibold">R$ {order.valor?.toFixed(2) || '0.00'}</span>
                              </div>
                              {order.motorista && (
                                <div className="flex items-center gap-2 col-span-2">
                                  <span className="text-blue-600 font-medium">Motorista:</span>
                                  <span className="text-foreground">{order.motorista}</span>
                                </div>
                              )}
                            </div>
                            <div className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-100/10 px-2.5 py-1.5 rounded-md border border-blue-100 dark:border-blue-500/20">
                              {order.rota}
                            </div>
                          </div>
                        </div>
                        <CollapsibleTrigger asChild>
                          <button className="p-2 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors ml-4 border border-blue-200 dark:border-blue-500/30">
                            {expandedOrders.has(order.id) ? (
                              <ChevronUp className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            )}
                          </button>
                        </CollapsibleTrigger>
                      </div>

                      <CollapsibleContent className="mt-4">
                        <div className="border-t border-blue-100 pt-4">
                          <h5 className="font-bold text-xs mb-3 text-blue-700 flex items-center gap-2">
                            <div className="h-1 w-1 bg-blue-500 rounded-full"></div>
                            Produtos do Pedido
                          </h5>
                          <div className="space-y-2.5">
                            {order.produtos?.map((produto) => (
                              <div
                                key={produto.id}
                                className="bg-gradient-to-r from-blue-50/80 to-blue-100/50 dark:from-blue-100/10 dark:to-blue-500/5 rounded-lg p-3 border border-blue-100 dark:border-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/40 transition-colors"
                              >
                                <p className="font-semibold mb-2 text-xs text-blue-900 dark:text-blue-100">{produto.descricao}</p>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                  <div className="bg-white/60 dark:bg-card/60 px-2.5 py-1 rounded border border-blue-200/50 dark:border-blue-500/20">
                                    <span className="text-blue-600 font-medium">Qtd:</span>{' '}
                                    <span className="text-foreground">{produto.quantidade}</span>
                                  </div>
                                  <div className="bg-white/60 dark:bg-card/60 px-2.5 py-1 rounded border border-blue-200/50 dark:border-blue-500/20">
                                    <span className="text-blue-600 font-medium">Peso:</span>{' '}
                                    <span className="text-foreground">{produto.pesoBruto} kg</span>
                                  </div>
                                  <div className="bg-white/60 dark:bg-card/60 px-2.5 py-1 rounded border border-blue-200/50 dark:border-blue-500/20">
                                    <span className="text-blue-600 font-medium">{produto.periodoEntrega}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
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
