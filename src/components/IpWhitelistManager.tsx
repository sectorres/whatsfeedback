import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AllowedIP {
  id: string;
  ip_address: string;
  description: string | null;
  created_at: string;
}

export function IpWhitelistManager() {
  const [ips, setIps] = useState<AllowedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchIps();
  }, []);

  const fetchIps = async () => {
    try {
      const { data, error } = await supabase
        .from('allowed_ips')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIps(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar IPs:', error);
      toast.error("Erro ao carregar lista de IPs");
    } finally {
      setLoading(false);
    }
  };

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newIp.trim()) {
      toast.error("Digite um endereço IP válido");
      return;
    }

    // Validação básica de IP
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(newIp.trim())) {
      toast.error("Formato de IP inválido. Use o formato: 192.168.1.1");
      return;
    }

    setAdding(true);

    try {
      const { error } = await supabase
        .from('allowed_ips')
        .insert([
          {
            ip_address: newIp.trim(),
            description: newDescription.trim() || null
          }
        ]);

      if (error) {
        if (error.code === '23505') {
          toast.error("Este IP já está na lista");
        } else {
          throw error;
        }
        return;
      }

      toast.success("IP adicionado com sucesso");
      setNewIp("");
      setNewDescription("");
      fetchIps();
    } catch (error: any) {
      console.error('Erro ao adicionar IP:', error);
      toast.error("Erro ao adicionar IP");
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteIp = async (id: string, ipAddress: string) => {
    try {
      const { error } = await supabase
        .from('allowed_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`IP ${ipAddress} removido com sucesso`);
      fetchIps();
    } catch (error: any) {
      console.error('Erro ao remover IP:', error);
      toast.error("Erro ao remover IP");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Lista de IPs Permitidos</CardTitle>
        </div>
        <CardDescription>
          Apenas endereços IP desta lista podem fazer login no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleAddIp} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip">Endereço IP</Label>
              <Input
                id="ip"
                placeholder="192.168.1.1"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                placeholder="Ex: Escritório principal"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                disabled={adding}
              />
            </div>
          </div>
          <Button type="submit" disabled={adding}>
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar IP
              </>
            )}
          </Button>
        </form>

        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endereço IP</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Nenhum IP cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                ips.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono">{ip.ip_address}</TableCell>
                    <TableCell>{ip.description || "-"}</TableCell>
                    <TableCell>
                      {new Date(ip.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteIp(ip.id, ip.ip_address)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
