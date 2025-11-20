import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function OrderDetailsDialog({
  open,
  onOpenChange,
  pedidoNumero,
}: OrderDetailsDialogProps) {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && pedidoNumero) {
      fetchPedidoDetails();
    }
  }, [open, pedidoNumero]);

  const fetchPedidoDetails = async () => {
    if (!pedidoNumero) return;

    setLoading(true);
    try {
      // Buscar configurações da API
      const { data: configs } = await supabase
        .from("app_config")
        .select("config_key, config_value")
        .in("config_key", ["api_url", "api_username", "api_password"]);

      const configMap = configs?.reduce(
        (acc, { config_key, config_value }) => {
          acc[config_key] = config_value;
          return acc;
        },
        {} as Record<string, string>
      );

      if (!configMap?.api_url || !configMap?.api_username || !configMap?.api_password) {
        console.error("API configuration missing");
        return;
      }

      console.log('Buscando pedido número:', pedidoNumero);
      
      // Buscar todas as cargas para encontrar o pedido pelo número
      const { data: cargasData, error: cargasError } = await supabase.functions.invoke('fetch-cargas');
      
      if (cargasError) {
        console.error('Erro ao buscar cargas:', cargasError);
        throw cargasError;
      }
      
      console.log('Cargas recebidas:', cargasData);
      
      if (cargasData && cargasData.status === 'SUCESSO' && cargasData.retorno?.cargas) {
        // Procurar o pedido em todas as cargas
        let foundPedido: Pedido | null = null;
        
        console.log('Total de cargas:', cargasData.retorno.cargas.length);
        
        for (const carga of cargasData.retorno.cargas) {
          console.log(`Carga ${carga.id} - Total de pedidos:`, carga.pedidos.length);
          
          const pedidoEncontrado = carga.pedidos.find((p: any) => {
            console.log(`Comparando pedido: "${p.pedido}" com "${pedidoNumero}"`);
            return p.pedido === pedidoNumero;
          });
          
          if (pedidoEncontrado) {
            console.log('Pedido encontrado!', pedidoEncontrado);
            foundPedido = {
              ...pedidoEncontrado,
              carga: {
                id: carga.id,
                motorista: carga.motorista,
                nomeMotorista: carga.nomeMotorista,
                status: carga.status
              }
            };
            break;
          }
        }
        
        if (foundPedido) {
          setPedido(foundPedido);
        } else {
          console.error('Pedido não encontrado. Número buscado:', pedidoNumero);
          toast.error(`Pedido ${pedidoNumero} não encontrado nas cargas atuais`);
        }
      } else {
        console.error('Estrutura de dados inválida:', cargasData);
        toast.error('Erro ao buscar dados das cargas');
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
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
                    <span className="font-semibold">NF: </span>
                    <span>{pedido.notaFiscal}</span>
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
                    <span className="font-semibold">Carga: </span>
                    <span>{pedido.carga?.id || "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Motorista: </span>
                    <span>{pedido.carga?.nomeMotorista || "N/A"}</span>
                  </div>
                  <div>
                    <span className="font-semibold">Setor: </span>
                    <span>{pedido.rota || "N/A"}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">Status: </span>
                    <span>{pedido.carga?.status || "Aberto"}</span>
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
                      <div className="text-sm text-muted-foreground ml-4">
                        Qtd: {produto.quantidade}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
