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
  telefone?: string;
  celular?: string;
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
  pedidoNumero: string | null; // AGORA será o telefone vindo do Supabase
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
      fetchPedidoDetails();
    }
  }, [open, pedidoNumero]);

  const normalize = (v: string | null | undefined) => (v ? v.replace(/\D/g, "") : "");

  const fetchPedidoDetails = async () => {
    if (!pedidoNumero) return;

    setLoading(true);
    try {
      const { data: configs } = await supabase
        .from("app_config")
        .select("config_key, config_value")
        .in("config_key", ["api_url", "api_username", "api_password"]);

      const configMap = configs?.reduce(
        (acc, { config_key, config_value }) => {
          acc[config_key] = config_value;
          return acc;
        },
        {} as Record<string, string>,
      );

      if (!configMap?.api_url || !configMap?.api_username || !configMap?.api_password) {
        console.error("API configuration missing");
        return;
      }

      console.log("Buscando pedido pelo telefone:", pedidoNumero);

      const { data: cargasData, error: cargasError } = await supabase.functions.invoke("fetch-cargas");

      if (cargasError) {
        console.error("Erro ao buscar cargas:", cargasError);
        throw cargasError;
      }

      if (cargasData && cargasData.status === "SUCESSO" && cargasData.retorno?.cargas) {
        let foundPedido: Pedido | null = null;

        const telefoneBusca = normalize(pedidoNumero);

        for (const carga of cargasData.retorno.cargas) {
          const pedidoEncontrado = carga.pedidos.find((p: any) => {
            const tel = normalize(p.cliente?.telefone);
            const cel = normalize(p.cliente?.celular);

            return tel === telefoneBusca || cel === telefoneBusca;
          });

          if (pedidoEncontrado) {
            foundPedido = {
              ...pedidoEncontrado,
              carga: {
                id: carga.id,
                motorista: carga.motorista,
                nomeMotorista: carga.nomeMotorista,
                status: carga.status,
              },
            };
            break;
          }
        }

        if (foundPedido) {
          setPedido(foundPedido);
        } else {
          toast.error(`Nenhum pedido encontrado para o telefone: ${pedidoNumero}`);
        }
      } else {
        console.error("Estrutura de dados inválida:", cargasData);
        toast.error("Erro ao buscar dados das cargas");
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
                    {pedido.notaFiscal}
                  </div>
                  <div>
                    <span className="font-semibold">Data: </span>
                    {formatDate(pedido.data)}
                  </div>
                  <div>
                    <span className="font-semibold">Valor: </span>
                    {formatCurrency(pedido.valor)}
                  </div>
                  <div>
                    <span className="font-semibold">Carga: </span>
                    {pedido.carga?.id ?? "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold">Motorista: </span>
                    {pedido.carga?.nomeMotorista ?? "N/A"}
                  </div>
                  <div>
                    <span className="font-semibold">Setor: </span>
                    {pedido.rota ?? "N/A"}
                  </div>
                  <div className="col-span-2">
                    <span className="font-semibold">Status: </span>
                    {pedido.carga?.status ?? "Aberto"}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">Endereço de Entrega</h3>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Rua: </span>
                    {pedido.cliente.endereco}
                  </div>
                  <div>
                    <span className="font-semibold">Bairro: </span>
                    {pedido.cliente.bairro}
                  </div>
                  <div>
                    <span className="font-semibold">CEP: </span>
                    {formatCEP(pedido.cliente.cep)}
                  </div>
                  <div>
                    <span className="font-semibold">Cidade: </span>
                    {pedido.cliente.cidade}
                  </div>
                  <div>
                    <span className="font-semibold">Estado: </span>
                    {pedido.cliente.estado}
                  </div>
                  {pedido.cliente.referencia && (
                    <div>
                      <span className="font-semibold">Referência: </span>
                      {pedido.cliente.referencia}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Produtos */}
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold text-lg mb-3">Produtos do Pedido</h3>
                <div className="space-y-3">
                  {pedido.produtos.map((produto) => (
                    <div key={produto.id} className="flex justify-between items-start p-3 bg-accent/50 rounded-lg">
                      <div className="font-medium">{produto.descricao}</div>
                      <div className="text-sm text-muted-foreground">Qtd: {produto.quantidade}</div>
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
