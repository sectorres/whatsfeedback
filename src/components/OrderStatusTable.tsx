import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Package, TruckIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  ABER: { label: "Aberta", variant: "default" },
  SEPA: { label: "Em Separação", variant: "secondary" },
  FATU: { label: "Faturada", variant: "outline" },
};

export const OrderStatusTable = () => {
  const [cargas, setCargas] = useState<Carga[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCargas();
  }, []);

  const fetchCargas = async () => {
    try {
      setLoading(true);
      console.log('Fetching cargas from API...');
      
      // Últimos 30 dias
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, '');
      
      const { data, error } = await supabase.functions.invoke('fetch-cargas', {
        body: {
          dataInicial: formatDate(startDate),
          dataFinal: formatDate(endDate)
        }
      });

      if (error) {
        console.error('Error fetching cargas:', error);
        toast.error('Erro ao buscar cargas');
        return;
      }

      if (data && data.status === 'SUCESSO' && data.retorno?.cargas) {
        console.log('Cargas loaded:', data.retorno.cargas.length);
        setCargas(data.retorno.cargas);
      } else {
        console.error('Invalid response format:', data);
        toast.error('Formato de resposta inválido');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao conectar com a API');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.slice(0, 4);
    const month = dateStr.slice(4, 6);
    const day = dateStr.slice(6, 8);
    return `${day}/${month}/${year}`;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Status de Cargas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Status de Cargas
        </CardTitle>
        <CardDescription>
          Visualize e gerencie o status das cargas em tempo real ({cargas.length} cargas)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cargas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma carga encontrada
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Carga</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="flex items-center gap-1">
                  <TruckIcon className="h-4 w-4" />
                  Motorista
                </TableHead>
                <TableHead>Transportadora</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pedidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cargas.map((carga) => (
                <TableRow key={carga.id}>
                  <TableCell className="font-medium">{carga.id}</TableCell>
                  <TableCell>{formatDate(carga.data)}</TableCell>
                  <TableCell>
                    {carga.nomeMotorista || `ID: ${carga.motorista}`}
                  </TableCell>
                  <TableCell>
                    {carga.nomeTransportadora || (carga.transportadora ? `ID: ${carga.transportadora}` : '-')}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusMap[carga.status]?.variant || "default"}>
                      {statusMap[carga.status]?.label || carga.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{carga.pedidos?.length || 0}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};
