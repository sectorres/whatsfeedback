import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Package, TruckIcon } from "lucide-react";

const mockOrders = [
  {
    id: 1,
    empresa: "100",
    empresaColeta: "200",
    dataInicial: "20250101",
    dataFinal: "20250131",
    status: "SEPA",
    motorista: "João Silva",
  },
  {
    id: 2,
    empresa: "101",
    empresaColeta: "201",
    dataInicial: "20250102",
    dataFinal: "20250202",
    status: "ABER",
    motorista: "Maria Santos",
  },
  {
    id: 3,
    empresa: "102",
    empresaColeta: "202",
    dataInicial: "20250103",
    dataFinal: "20250303",
    status: "FATU",
    motorista: "Carlos Oliveira",
  },
];

const statusMap = {
  ABER: { label: "Aberta", variant: "default" as const },
  SEPA: { label: "Em Separação", variant: "secondary" as const },
  FATU: { label: "Faturada", variant: "outline" as const },
};

export const OrderStatusTable = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Status de Cargas
        </CardTitle>
        <CardDescription>
          Visualize e gerencie o status das cargas em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Coleta</TableHead>
              <TableHead>Data Inicial</TableHead>
              <TableHead>Data Final</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="flex items-center gap-1">
                <TruckIcon className="h-4 w-4" />
                Motorista
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.empresa}</TableCell>
                <TableCell>{order.empresaColeta}</TableCell>
                <TableCell>
                  {new Date(
                    order.dataInicial.slice(0, 4) +
                      "-" +
                      order.dataInicial.slice(4, 6) +
                      "-" +
                      order.dataInicial.slice(6, 8)
                  ).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  {new Date(
                    order.dataFinal.slice(0, 4) +
                      "-" +
                      order.dataFinal.slice(4, 6) +
                      "-" +
                      order.dataFinal.slice(6, 8)
                  ).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  <Badge variant={statusMap[order.status].variant}>
                    {statusMap[order.status].label}
                  </Badge>
                </TableCell>
                <TableCell>{order.motorista}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
