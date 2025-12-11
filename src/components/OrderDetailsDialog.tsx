import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface Produto {
  id: number;
  descricao: string;
  quantidade: number;
}

interface Cliente {
  nome: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  referencia: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal: string;
  data: string;
  valor: number;
  cliente: Cliente;
  produtos: Produto[];
  carga?: {
    id: number;
    motorista: number;
    nomeMotorista: string;
    status: string;
  };
  rota?: string;
  motorista?: string;
}

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidoNumero: string | null;
}

const formatDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return `${day}/${month}/${year}`;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const formatCEP = (cep: string) => {
  if (!cep || cep.length !== 8) return cep;
  return `${cep.substring(0, 5)}-${cep.substring(5)}`;
};

export function OrderDetailsDialog({ open, onOpenChange, pedidoNumero }: OrderDetailsDialogProps) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && pedidoNumero) {
      setPedido(null); // Limpa o pedido anterior ao abrir o modal
      fetchPedidoDetails();
    } else if (!open) {
      setPedido(null); // Limpa o pedido ao fechar o modal
    }
  }, [open, pedidoNumero]);

  const fetchPedidoDetails = async () => {
    if (!pedidoNumero) {
      console.log("OrderDetailsDialog: pedidoNumero está vazio");
      return;
    }

    setLoading(true);
    try {
      console.log("OrderDetailsDialog: Buscando pedido salvo no banco:", pedidoNumero);

      // Buscar dados completos salvos no banco
      const { data: savedOrder, error: orderError } = await supabase
        .from('campaign_sends')
        .select('*')
        .eq('pedido_numero', pedidoNumero)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("OrderDetailsDialog: Dados salvos:", savedOrder);

      // Se tem produtos salvos, usar dados do banco
      if (savedOrder && savedOrder.produtos) {
        const pedidoFromDb: Pedido = {
          id: savedOrder.pedido_id || 0,
          pedido: savedOrder.pedido_numero || pedidoNumero,
          notaFiscal: savedOrder.nota_fiscal || "",
          data: savedOrder.data_pedido || "",
          valor: savedOrder.valor_total || 0,
          rota: savedOrder.rota || "",
          motorista: savedOrder.driver_name || "",
          cliente: {
            nome: savedOrder.customer_name || "Cliente",
            endereco: savedOrder.endereco_completo || "",
            bairro: savedOrder.bairro || "",
            cep: savedOrder.cep || "",
            cidade: savedOrder.cidade || "",
            estado: savedOrder.estado || "",
            referencia: savedOrder.referencia || "",
          },
          produtos: (savedOrder.produtos as any as Produto[]) || [],
        };

        console.log("OrderDetailsDialog: Pedido carregado do banco:", pedidoFromDb);
        setPedido(pedidoFromDb);
        return;
      }

      // Se não tem produtos, buscar da API (envios automáticos não salvam produtos)
      console.log("OrderDetailsDialog: Dados incompletos no banco, buscando da API");
      
      const { data: apiData, error: apiError } = await supabase.functions.invoke("fetch-cargas", {
        body: { searchTerm: pedidoNumero }
      });

      if (apiError) {
        console.error("OrderDetailsDialog: Erro na API:", apiError);
        throw apiError;
      }

      // Procurar o pedido específico nos dados da API
      let foundPedido: Pedido | null = null;
      if (apiData?.cargas) {
        for (const carga of apiData.cargas) {
          for (const p of carga.pedidos || []) {
            if (p.pedido === pedidoNumero) {
              foundPedido = {
                id: p.id,
                pedido: p.pedido,
                notaFiscal: p.notaFiscal || "",
                data: p.data || "",
                valor: p.valor || 0,
                rota: p.rota || "",
                cliente: p.cliente ? {
                  nome: p.cliente.nome || "Cliente",
                  endereco: p.cliente.endereco || "",
                  bairro: p.cliente.bairro || "",
                  cep: p.cliente.cep || "",
                  cidade: p.cliente.cidade || "",
                  estado: p.cliente.estado || "",
                  referencia: p.cliente.referencia || "",
                } : {
                  nome: savedOrder?.customer_name || "Cliente",
                  endereco: "",
                  bairro: "",
                  cep: "",
                  cidade: "",
                  estado: "",
                  referencia: "",
                },
                produtos: p.produtos || [],
                carga: {
                  id: carga.id,
                  motorista: carga.motorista,
                  nomeMotorista: carga.nomeMotorista || "",
                  status: carga.status || "",
                }
              };
              break;
            }
          }
          if (foundPedido) break;
        }
      }

      if (foundPedido) {
        console.log("OrderDetailsDialog: Pedido carregado da API:", foundPedido);
        setPedido(foundPedido);
      } else {
        console.log("OrderDetailsDialog: Pedido não encontrado na API");
        toast.error(`Pedido ${pedidoNumero} não encontrado`);
        onOpenChange(false);
      }
    } catch (error) {
      console.error("OrderDetailsDialog: Erro ao buscar detalhes:", error);
      toast.error("Erro ao buscar detalhes do pedido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Pedido</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : pedido ? (
          <div className="space-y-4">
            {/* Cliente */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Cliente: </span>
                    <span>{pedido.cliente.nome}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Informações do Pedido */}
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold">Pedido: </span>
                    <span>{pedido.pedido}</span>
                  </div>
                  <div>
                    <span className="font-semibold">NF: </span>
                    <span>{pedido.notaFiscal}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Motorista: </span>
                    <span>{pedido.motorista || pedido.carga?.nomeMotorista || "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Data: </span>
                    <span>{formatDate(pedido.data)}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Valor: </span>
                    <span>{formatCurrency(pedido.valor)}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Setor: </span>
                    <span>{pedido.rota || "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço de Entrega */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">Endereço de Entrega</h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Rua: </span>
                    <span>{pedido.cliente.endereco}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Bairro: </span>
                    <span>{pedido.cliente.bairro}</span>
                  </div>
                  <div>
                    <span className="font-semibold">CEP: </span>
                    <span>{formatCEP(pedido.cliente.cep)}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Cidade: </span>
                    <span>{pedido.cliente.cidade}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Estado: </span>
                    <span>{pedido.cliente.estado}</span>
                  </div>
                  {pedido.cliente.referencia && (
                    <div>
                      <span className="font-semibold">Referência: </span>
                      <span>{pedido.cliente.referencia}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Produtos do Pedido */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">Produtos do Pedido</h3>
                <div className="space-y-3">
                  {pedido.produtos.map((produto) => (
                    <div key={produto.id} className="flex justify-between items-start p-3 bg-accent/50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{produto.descricao}</div>
                      </div>
                      <div className="text-sm text-muted-foreground ml-4">Qtd: {produto.quantidade}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
