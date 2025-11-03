import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

export const DataClearConfig = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleClearData = async () => {
    if (!password.trim()) {
      toast.error("Por favor, insira a senha do administrador");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("clear-data", {
        body: { password }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Todos os dados foram limpos com sucesso!");
        setPassword("");
        setDialogOpen(false);
      } else {
        toast.error(data.error || "Erro ao limpar dados");
      }
    } catch (error: any) {
      console.error("Error clearing data:", error);
      toast.error(error.message || "Erro ao limpar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <Trash2 className="h-5 w-5" />
          Limpar Dados do Sistema
        </CardTitle>
        <CardDescription>
          Remove todos os registros de campanhas, conversas, mensagens e pesquisas. 
          Mantém apenas usuários e configurações. Esta ação não pode ser desfeita.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar Todos os Dados
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Limpeza de Dados</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação irá deletar permanentemente:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Todas as campanhas e disparos</li>
                  <li>Todas as conversas e mensagens</li>
                  <li>Todas as pesquisas de satisfação</li>
                  <li>Lista de bloqueio (blacklist)</li>
                </ul>
                <p className="mt-3 font-semibold">
                  Usuários, senhas e configurações serão mantidos.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="admin-password">Senha do admin@admin.com</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="Digite a senha do administrador"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleClearData();
                }}
                disabled={loading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Limpando...
                  </>
                ) : (
                  "Confirmar Limpeza"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
