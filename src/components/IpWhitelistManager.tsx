import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Shield } from "lucide-react";

interface AllowedIp {
  id: string;
  ip_address: string;
  description: string | null;
  created_at: string;
}

export function IpWhitelistManager() {
  const [ips, setIps] = useState<AllowedIp[]>([]);
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
      toast.error('Erro ao carregar lista de IPs permitidos');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newIp.trim()) {
      toast.error('Digite um endereço IP válido');
      return;
    }

    // Validação básica de IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIp.trim())) {
      toast.error('Formato de IP inválido. Use o formato: 192.168.1.1');
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from('allowed_ips')
        .insert([{
          ip_address: newIp.trim(),
          description: newDescription.trim() || null
        }]);

      if (error) throw error;

      toast.success('IP adicionado com sucesso!');
      setNewIp("");
      setNewDescription("");
      fetchIps();
    } catch (error: any) {
      console.error('Erro ao adicionar IP:', error);
      if (error.code === '23505') {
        toast.error('Este IP já está na lista');
      } else {
        toast.error('Erro ao adicionar IP');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string, ip: string) => {
    if (!confirm(`Tem certeza que deseja remover o IP ${ip}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('allowed_ips')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('IP removido com sucesso!');
      fetchIps();
    } catch (error: any) {
      console.error('Erro ao remover IP:', error);
      toast.error('Erro ao remover IP');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Controle de Acesso por IP</CardTitle>
        </div>
        <CardDescription>
          Gerencie os endereços IP permitidos para fazer login no sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulário de adicionar IP */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
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
          <Button onClick={handleAdd} disabled={adding} className="w-full md:w-auto">
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
        </div>

        {/* Lista de IPs */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endereço IP</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Adicionado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhum IP cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                ips.map((ip) => (
                  <TableRow key={ip.id}>
                    <TableCell className="font-mono">{ip.ip_address}</TableCell>
                    <TableCell>{ip.description || '-'}</TableCell>
                    <TableCell>
                      {new Date(ip.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(ip.id, ip.ip_address)}
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