import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, Users, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface User {
  id: string;
  email: string;
  role: string;
  modules: string[];
}

const MODULES = [
  { value: 'dashboard_stats', label: 'Estatísticas do Dashboard' },
  { value: 'conversations', label: 'Atendimento' },
  { value: 'campaigns', label: 'Campanhas' },
  { value: 'satisfaction_surveys', label: 'Pesquisas de Satisfação' },
  { value: 'order_status', label: 'Status de Pedidos' },
  { value: 'whatsapp_connection', label: 'Conexão WhatsApp' },
  { value: 'ip_whitelist', label: 'Lista de IPs' },
  { value: 'send_delay_config', label: 'Configuração de Delay' },
  { value: 'api_config', label: 'Configuração da API' },
  { value: 'webhook_config', label: 'Configuração de Webhook' },
  { value: 'change_password', label: 'Alterar Senha' },
];

export const PermissionsManager = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      const user = users.find(u => u.id === selectedUserId);
      setSelectedUser(user || null);
    }
  }, [selectedUserId, users]);

  const loadUsers = async () => {
    try {
      // Get all users with their roles
      const { data: usersData, error: usersError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (usersError) throw usersError;

      // Get user emails from auth
      const userIds = usersData.map(u => u.user_id);
      const userEmails: Record<string, string> = {};

      // For each user, get their email (you'll need to use an edge function for this in production)
      // For now, we'll just show user IDs
      
      // Get modules for each user
      const { data: modulesData, error: modulesError } = await supabase
        .from('user_modules')
        .select('user_id, module');

      if (modulesError) throw modulesError;

      const usersWithModules = usersData.map(user => ({
        id: user.user_id,
        email: userEmails[user.user_id] || user.user_id,
        role: user.role,
        modules: modulesData
          .filter(m => m.user_id === user.user_id)
          .map(m => m.module),
      }));

      setUsers(usersWithModules);
    } catch (error: any) {
      toast.error("Erro ao carregar usuários: " + error.message);
    }
  };

  const handleRoleChange = async (role: string) => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: role as 'admin' | 'user' })
        .eq('user_id', selectedUser.id);

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!");
      await loadUsers();
    } catch (error: any) {
      toast.error("Erro ao atualizar perfil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleToggle = (module: string) => {
    if (!selectedUser) return;

    setSelectedUser({
      ...selectedUser,
      modules: selectedUser.modules.includes(module)
        ? selectedUser.modules.filter(m => m !== module)
        : [...selectedUser.modules, module],
    });
  };

  const handleSaveModules = async () => {
    if (!selectedUser) return;

    setLoading(true);
    try {
      // Delete all current modules
      const { error: deleteError } = await supabase
        .from('user_modules')
        .delete()
        .eq('user_id', selectedUser.id);

      if (deleteError) throw deleteError;

      // Insert new modules
      if (selectedUser.modules.length > 0) {
        type ModuleType = 'dashboard_stats' | 'conversations' | 'campaigns' | 'satisfaction_surveys' | 
                         'order_status' | 'whatsapp_connection' | 'ip_whitelist' | 'send_delay_config' | 
                         'api_config' | 'webhook_config' | 'change_password';
        
        const { error: insertError } = await supabase
          .from('user_modules')
          .insert(
            selectedUser.modules.map(module => ({
              user_id: selectedUser.id,
              module: module as ModuleType,
            }))
          );

        if (insertError) throw insertError;
      }

      toast.success("Permissões salvas com sucesso!");
      await loadUsers();
    } catch (error: any) {
      toast.error("Erro ao salvar permissões: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gerenciamento de Permissões
          </CardTitle>
          <CardDescription>
            Defina os perfis e módulos que cada usuário pode acessar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Selecione um Usuário</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha um usuário" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email} - {user.role === 'admin' ? 'Administrador' : 'Usuário'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedUser && (
            <div className="space-y-6 pt-4 border-t">
              <div className="space-y-2">
                <Label>Perfil do Usuário</Label>
                <Select 
                  value={selectedUser.role} 
                  onValueChange={handleRoleChange}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador (Acesso Total)</SelectItem>
                    <SelectItem value="user">Usuário (Acesso Personalizado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedUser.role !== 'admin' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Módulos Permitidos</Label>
                    <Button 
                      onClick={handleSaveModules}
                      disabled={loading}
                      size="sm"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Permissões
                    </Button>
                  </div>
                  
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    <div className="space-y-3">
                      {MODULES.map(module => (
                        <div key={module.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={module.value}
                            checked={selectedUser.modules.includes(module.value)}
                            onCheckedChange={() => handleModuleToggle(module.value)}
                          />
                          <Label
                            htmlFor={module.value}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {module.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {selectedUser.role === 'admin' && (
                <div className="bg-primary/10 p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Administradores têm acesso total a todos os módulos do sistema
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
