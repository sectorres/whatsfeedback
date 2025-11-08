import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MapPin, Package, Truck, Calendar, Phone } from "lucide-react";

interface Produto {
  id: number;
  descricao: string;
  quantidade: number;
  pesoBruto: number;
  periodoEntrega: string;
}

interface Cliente {
  id: number;
  nome: string;
  documento: string;
  telefone: string;
  celular: string;
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
  pesoBruto: number;
  rota: string;
  cliente: Cliente;
  produtos: Produto[];
  cargaId: number;
  motorista: string;
  transportadora: string;
  statusCarga: string;
  dataCarga: string;
}

interface PedidoSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: Pedido | null;
}

export const PedidoSearchDialog = ({ open, onOpenChange, pedido }: PedidoSearchDialogProps) => {
  if (!pedido) return null;

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
  };

  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    ABER: { label: "Em Aberto", variant: "secondary" },
    SEPA: { label: "Em Separação", variant: "outline" },
    FATU: { label: "Faturado", variant: "default" },
    TRAN: { label: "Em Transporte", variant: "outline" },
  };

  const status = statusMap[pedido.statusCarga] || { label: pedido.statusCarga, variant: "default" };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Pedido {pedido.pedido}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Pedido */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Nota Fiscal</p>
              <p className="font-semibold">{pedido.notaFiscal}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data</p>
              <p className="font-semibold">{formatDate(pedido.data)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-semibold">R$ {pedido.valor.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Peso</p>
              <p className="font-semibold">{pedido.pesoBruto} kg</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rota</p>
              <p className="font-semibold">{pedido.rota}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>

          {/* Informações da Carga */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Informações da Carga
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Carga ID</p>
                <p className="font-semibold">{pedido.cargaId}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Data da Carga</p>
                <p className="font-semibold">{formatDate(pedido.dataCarga)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Motorista</p>
                <p className="font-semibold">{pedido.motorista || "Não definido"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transportadora</p>
                <p className="font-semibold">{pedido.transportadora || "Não definida"}</p>
              </div>
            </div>
          </div>

          {/* Informações do Cliente */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Cliente
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-semibold">{pedido.cliente.nome}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Documento</p>
                  <p className="font-semibold">{pedido.cliente.documento}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-semibold">{pedido.cliente.telefone || pedido.cliente.celular}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Endereço de Entrega */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Endereço de Entrega
            </h4>
            <div className="space-y-2">
              <p className="text-sm">{pedido.cliente.endereco}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Bairro:</span> {pedido.cliente.bairro}
                </div>
                <div>
                  <span className="text-muted-foreground">CEP:</span> {pedido.cliente.cep}
                </div>
                <div>
                  <span className="text-muted-foreground">Cidade:</span> {pedido.cliente.cidade}
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span> {pedido.cliente.estado}
                </div>
              </div>
              {pedido.cliente.referencia && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Referência:</span>
                  <p className="text-sm mt-1">{pedido.cliente.referencia}</p>
                </div>
              )}
            </div>
          </div>

          {/* Produtos */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos ({pedido.produtos?.length || 0})
            </h4>
            <div className="space-y-2">
              {pedido.produtos?.map((produto) => (
                <div key={produto.id} className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-semibold text-sm mb-2">{produto.descricao}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Qtd:</span> {produto.quantidade}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Peso:</span> {produto.pesoBruto} kg
                    </div>
                    <div>
                      <Badge variant="outline" className="text-xs">{produto.periodoEntrega}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
