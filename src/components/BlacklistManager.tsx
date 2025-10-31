import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Trash2, UserX, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalizePhone } from "@/lib/phone-utils";

interface BlacklistEntry {
  id: string;
  phone: string;
  reason: string | null;
  added_at: string;
}

export function BlacklistManager() {
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    fetchBlacklist();

    // Realtime updates
    const channel = supabase
      .channel('blacklist-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blacklist'
        },
        () => {
          fetchBlacklist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBlacklist = async () => {
    try {
      const { data, error } = await supabase
        .from('blacklist')
        .select('*')
        .order('added_at', { ascending: false });

      if (error) throw error;
      setBlacklist(data || []);
    } catch (error) {
      console.error('Error fetching blacklist:', error);
      toast.error('Erro ao carregar blacklist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToBlacklist = async () => {
    if (!newPhone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    setAdding(true);
    try {
      const normalizedPhone = normalizePhone(newPhone);

      // Verificar se já existe
      const { data: existing } = await supabase
        .from('blacklist')
        .select('id')
        .eq('phone', normalizedPhone)
        .maybeSingle();

      if (existing) {
        toast.error('Este número já está na blacklist');
        setAdding(false);
        return;
      }

      const { error } = await supabase
        .from('blacklist')
        .insert({
          phone: normalizedPhone,
          reason: newReason.trim() || null
        });

      if (error) throw error;

      toast.success('Número adicionado à blacklist');
      setNewPhone('');
      setNewReason('');
    } catch (error) {
      console.error('Error adding to blacklist:', error);
      toast.error('Erro ao adicionar à blacklist');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveFromBlacklist = async (id: string, phone: string) => {
    try {
      const { error } = await supabase
        .from('blacklist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success(`${phone} removido da blacklist`);
    } catch (error) {
      console.error('Error removing from blacklist:', error);
      toast.error('Erro ao remover da blacklist');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserX className="h-5 w-5 text-destructive" />
          Blacklist de Números
        </CardTitle>
        <CardDescription>
          Números bloqueados não receberão mensagens de campanha
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulário de Adição */}
        <div className="border rounded-lg p-4 space-y-4">
          <h3 className="font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Adicionar Número à Blacklist
          </h3>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <Input
                id="phone"
                placeholder="Ex: (11) 98765-4321 ou 11987654321"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo (opcional)</Label>
              <Textarea
                id="reason"
                placeholder="Ex: Cliente solicitou não receber mais mensagens"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                disabled={adding}
                rows={2}
              />
            </div>
            <Button
              onClick={handleAddToBlacklist}
              disabled={adding || !newPhone.trim()}
              className="w-full"
            >
              {adding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar à Blacklist
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Lista de Números Bloqueados */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Números Bloqueados ({blacklist.length})
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : blacklist.length === 0 ? (
            <div className="text-center p-8 border rounded-lg bg-muted/50">
              <UserX className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nenhum número bloqueado
              </p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Adicionado</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blacklist.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.phone}
                      </TableCell>
                      <TableCell>
                        {entry.reason ? (
                          <span className="text-sm">{entry.reason}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">
                            Sem motivo especificado
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.added_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFromBlacklist(entry.id, entry.phone)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
