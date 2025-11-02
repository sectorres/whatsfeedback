import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPermissions {
  isAdmin: boolean;
  allowedModules: string[];
  loading: boolean;
}

export const useUserPermissions = (): UserPermissions => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    isAdmin: false,
    allowedModules: [],
    loading: true,
  });

  useEffect(() => {
    loadPermissions();

    // Subscribe to changes
    const channel = supabase
      .channel('user-permissions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        () => loadPermissions()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_modules',
        },
        () => loadPermissions()
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setPermissions({ isAdmin: false, allowedModules: [], loading: false });
        return;
      }

      // Get user role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        console.error('Error loading role:', roleError);
      }

      const isAdmin = roleData?.role === 'admin';

      // Get user modules
      const { data: modulesData, error: modulesError } = await supabase
        .from('user_modules')
        .select('module')
        .eq('user_id', user.id);

      if (modulesError) {
        console.error('Error loading modules:', modulesError);
      }

      const allowedModules = modulesData?.map(m => m.module) || [];

      setPermissions({
        isAdmin,
        allowedModules,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading permissions:', error);
      setPermissions({ isAdmin: false, allowedModules: [], loading: false });
    }
  };

  return permissions;
};
