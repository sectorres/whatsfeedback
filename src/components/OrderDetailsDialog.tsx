import { Package, MapPin, Calendar, DollarSign, Truck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Produto {
  descricao: string;
  quantidade: number;
  pesoBruto: number;
}

interface Cliente {
  nome: string;
  documento: string;
  telefone: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  referencia?: string;
}

interface Pedido {
  id: number;
  pedido: string;
  notaFiscal: string;
  data: string;
  valor: number;
  rota: string;
  cliente: Cliente;
  produtos: Produto[];
}

interface OrderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: Pedido | null;
}

export function OrderDetailsDialog({ open, onOpenChange, pedido }: OrderDetailsDialogProps) {
  if (!pedido) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatCEP = (cep: string) => {
    if (!cep) return '';
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const totalPeso = pedido.produtos?.reduce((sum, p) => sum + (p.pesoBruto || 0), 0) || 0;
  const totalItens = pedido.produtos?.reduce((sum, p) => sum + (p.quantidade || 0), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Pedido
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="space-y-4 pr-4">
            {/* Cabeçalho do Pedido */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Pedido</p>
                <p className="font-semibold text-lg">{pedido.pedido}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Nota Fiscal</p>
                <p className="font-semibold text-lg">{pedido.notaFiscal}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{formatDate(pedido.data)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <p className="font-semibold text-lg text-primary">{formatCurrency(pedido.valor)}</p>
                </div>
              </div>
            </div>

            {pedido.rota && (
              <div>
                <p className="text-sm text-muted-foreground">Rota</p>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{pedido.rota}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Informações do Cliente */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Cliente
              </h3>
              <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
                <div>
                  <p className="font-semibold">{pedido.cliente.nome}</p>
                </div>
                {pedido.cliente.documento && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">CPF/CNPJ: </span>
                    <span>{pedido.cliente.documento}</span>
                  </div>
                )}
                {pedido.cliente.telefone && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Telefone: </span>
                    <span>{pedido.cliente.telefone}</span>
                  </div>
                )}
                {pedido.cliente.endereco && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Endereço: </span>
                    <span>{pedido.cliente.endereco}</span>
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Bairro: </span>
                  <span>{pedido.cliente.bairro}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Cidade: </span>
                  <span>{pedido.cliente.cidade}/{pedido.cliente.estado}</span>
                </div>
                {pedido.cliente.cep && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">CEP: </span>
                    <span>{formatCEP(pedido.cliente.cep)}</span>
                  </div>
                )}
                {pedido.cliente.referencia && (
                  <div className="text-sm mt-2 p-2 bg-background rounded border border-border">
                    <span className="text-muted-foreground">Referência: </span>
                    <span>{pedido.cliente.referencia}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Produtos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Produtos ({pedido.produtos?.length || 0})
                </h3>
                <div className="flex gap-4 text-sm">
                  <Badge variant="outline">
                    {totalItens} itens
                  </Badge>
                  <Badge variant="outline">
                    {totalPeso.toFixed(2)} kg
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                {pedido.produtos?.map((produto, index) => (
                  <div
                    key={index}
                    className="bg-muted/50 p-3 rounded-lg space-y-1"
                  >
                    <p className="font-medium text-sm">{produto.descricao}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Quantidade: {produto.quantidade}</span>
                      <span>Peso: {produto.pesoBruto?.toFixed(2) || 0} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
