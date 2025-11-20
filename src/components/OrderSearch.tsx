import { useState, useEffect, useRef } from "react";
import { Search, Package, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";

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

interface Carga {
  id: number;
  motorista: number;
  nomeMotorista: string;
  status: string;
  pedidos: Pedido[];
}

interface OrderSearchProps {
  customerPhone?: string;
}

export function OrderSearch({ customerPhone }: OrderSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Pedido[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPedidoNumero, setSelectedPedidoNumero] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      return;
    }

    // Clear previous timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer for debounced search
    debounceTimer.current = setTimeout(() => {
      performSearch(searchTerm);
    }, 500); // 500ms delay

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchTerm]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      console.log("🔍 Buscando pedidos com query:", query);

      const { data, error } = await supabase.functions.invoke("fetch-cargas", {
        body: {},
      });

      console.log("📦 Resposta fetch-cargas:", {
        hasData: !!data,
        error,
        dataType: typeof data,
        isArray: Array.isArray(data),
      });

      if (error) {
        console.error("❌ Erro ao buscar cargas:", error);
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.warn("⚠️ Data inválido ou não é array:", data);
        setResults([]);
        return;
      }

      console.log(`📊 Total de cargas: ${data.length}`);

      // Search across all orders
      const foundOrders: Pedido[] = [];
      let totalPedidos = 0;

      data.forEach((carga: Carga) => {
        if (carga.pedidos && Array.isArray(carga.pedidos)) {
          totalPedidos += carga.pedidos.length;

          carga.pedidos.forEach((pedido: Pedido) => {
            // Search by order number, invoice, customer name, or document
            const searchLower = query.toLowerCase().trim();
            const searchNormalized = query.replace(/[^\w\s]/g, "").toLowerCase(); // Remove special chars

            // Normalize fields for comparison
            const pedidoNum = (pedido.pedido || "").toLowerCase();
            const notaFiscal = (pedido.notaFiscal || "").toLowerCase();
            const clienteNome = (pedido.cliente?.nome || "").toLowerCase();
            const clienteDoc = (pedido.cliente?.documento || "").toLowerCase();
            const clienteTel = (pedido.cliente?.telefone || "").replace(/\D/g, "");

            const matches =
              pedidoNum.includes(searchLower) ||
              pedidoNum.replace(/[^\w]/g, "").includes(searchNormalized) ||
              notaFiscal.includes(searchLower) ||
              notaFiscal.replace(/[^\w]/g, "").includes(searchNormalized) ||
              clienteNome.includes(searchLower) ||
              clienteDoc.includes(searchLower) ||
              clienteDoc.replace(/\D/g, "").includes(query.replace(/\D/g, "")) ||
              clienteTel.includes(query.replace(/\D/g, ""));

            if (matches) {
              foundOrders.push(pedido);
              console.log("✅ Match encontrado:", {
                pedido: pedido.pedido,
                nota: pedido.notaFiscal,
                cliente: pedido.cliente?.nome,
              });
            }
          });
        }
      });

      console.log(`🎯 Busca concluída: ${foundOrders.length} pedidos encontrados de ${totalPedidos} totais`);
      setResults(foundOrders.slice(0, 300)); // Limit to 20 results for performance
    } catch (error) {
      console.error("❌ Error searching orders:", error);
      toast.error("Erro ao buscar pedidos");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(6, 8)}/${dateStr.substring(4, 6)}/${dateStr.substring(0, 4)}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setResults([]);
  };

  const handlePedidoClick = (pedido: Pedido) => {
    setSelectedPedidoNumero(pedido.pedido);
    setDetailsOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-foreground">
            <Search className="h-4 w-4" />
            Buscar Pedidos
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[500px] p-0" align="start">
          <div className="flex items-center gap-2 border-b border-border p-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por pedido, nota, cliente ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 h-8"
              autoFocus
            />
            {searchTerm && (
              <Button variant="ghost" size="sm" onClick={clearSearch} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            )}
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          <ScrollArea className="h-[400px]">
            {!searchTerm.trim() && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Digite para buscar pedidos</p>
              </div>
            )}

            {searchTerm.trim() && !isSearching && results.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">Nenhum pedido encontrado</p>
              </div>
            )}

            {results.length > 0 && (
              <div className="p-2 space-y-2">
                {results.map((pedido, index) => (
                  <Card
                    key={`${pedido.id}-${index}`}
                    className="hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handlePedidoClick(pedido)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{pedido.pedido}</span>
                            <Badge variant="outline" className="text-xs">
                              NF: {pedido.notaFiscal}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{pedido.cliente?.nome}</p>
                        </div>
                        <div className="text-right text-sm space-y-1">
                          <div className="font-semibold text-primary">{formatCurrency(pedido.valor)}</div>
                          <div className="text-xs text-muted-foreground">{formatDate(pedido.data)}</div>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          <span>{pedido.produtos?.length || 0} produto(s)</span>
                        </div>
                        {pedido.cliente?.endereco && (
                          <div className="line-clamp-1">
                            📍 {pedido.cliente.endereco}, {pedido.cliente.bairro} - {pedido.cliente.cidade}
                          </div>
                        )}
                        {pedido.rota && <div className="text-xs">🚚 Rota: {pedido.rota}</div>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <OrderDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} pedidoNumero={selectedPedidoNumero} />
    </>
  );
}
