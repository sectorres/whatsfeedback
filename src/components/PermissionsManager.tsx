import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";

type AppModule = Database["public"]["Enums"]["app_module"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface User {
  id: string;
  email: string;
  role: AppRole | null;
  modules: AppModule[];
}

const moduleLabels: Partial<Record<AppModule, string>> = {
  dashboard: "Dashboard",
  campaigns: "Aviso de Entregas",
  satisfaction_surveys: "Pesquisa de Satisfação",
  atendimento: "Atendimento",
  orders: "Pedidos",
  config: "Configurações",
  dashboard_stats: "Dashboard",
  conversations: "Atendimento",
  order_status: "Pedidos",
  whatsapp_connection: "Configurações",
  ip_whitelist: "Configurações",
  send_delay_config: "Configurações",
  api_config: "Configurações",
  webhook_config: "Configurações",
  change_password: "Configurações",
};

const mainModules = ["dashboard", "campaigns", "satisfaction_surveys", "atendimento", "orders", "config"] as const;

export const PermissionsManager = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Get all users from auth
      const { data: { users: authUsers } } = await supabase.auth.admin.listUsers();
      
      // Get roles
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      // Get modules
      const { data: modulesData } = await supabase
        .from("user_modules")
        .select("user_id, module");

      const usersWithPermissions = authUsers.map((user) => {
        const userRole = rolesData?.find((r) => r.user_id === user.id);
        const userModules = modulesData?.filter((m) => m.user_id === user.id) || [];
        
        return {
          id: user.id,
          email: user.email || "",
          role: (userRole?.role as AppRole) || null,
          modules: userModules.map((m) => m.module as AppModule),
        };
      });

      setUsers(usersWithPermissions);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, currentRole: AppRole | null) => {
    try {
      const newRole: AppRole = currentRole === "admin" ? "user" : "admin";
      
      if (currentRole) {
        await supabase
          .from("user_roles")
          .update({ role: newRole })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole });
      }

      toast.success("Função atualizada com sucesso");
      fetchUsers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar função");
    }
  };

  const toggleModule = async (userId: string, module: AppModule, hasModule: boolean) => {
    try {
      if (hasModule) {
        await supabase
          .from("user_modules")
          .delete()
          .eq("user_id", userId)
          .eq("module", module);
      } else {
        await supabase
          .from("user_modules")
          .insert({ user_id: userId, module });
      }

      toast.success("Permissão atualizada");
      fetchUsers();
    } catch (error) {
      console.error("Error updating module:", error);
      toast.error("Erro ao atualizar permissão");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Permissões</CardTitle>
        <CardDescription>
          Defina funções e módulos acessíveis para cada usuário
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {users.map((user) => (
          <div key={user.id} className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user.email}</p>
                <p className="text-sm text-muted-foreground">
                  Função: {user.role === "admin" ? "Administrador" : "Usuário"}
                </p>
              </div>
              <Button
                variant={user.role === "admin" ? "destructive" : "default"}
                size="sm"
                onClick={() => toggleRole(user.id, user.role)}
              >
                {user.role === "admin" ? "Remover Admin" : "Tornar Admin"}
              </Button>
            </div>

            {user.role !== "admin" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Módulos Permitidos:</Label>
                <div className="grid grid-cols-2 gap-3">
                  {mainModules.map((module) => {
                    const hasModule = user.modules.includes(module);
                    return (
                      <div key={module} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${user.id}-${module}`}
                          checked={hasModule}
                          onCheckedChange={() => toggleModule(user.id, module, hasModule)}
                        />
                        <label
                          htmlFor={`${user.id}-${module}`}
                          className="text-sm cursor-pointer"
                        >
                          {moduleLabels[module]}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
