import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type AppModule = Database["public"]["Enums"]["app_module"];
type AppRole = Database["public"]["Enums"]["app_role"];

export const useUserPermissions = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedModules, setAllowedModules] = useState<AppModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setLoading(false);
          return;
        }

        // Check if user is admin
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        const userIsAdmin = roleData?.role === "admin";
        setIsAdmin(userIsAdmin);

        // Get user modules
        const { data: modulesData } = await supabase
          .from("user_modules")
          .select("module")
          .eq("user_id", user.id);

        const modules = modulesData?.map((m) => m.module as AppModule) || [];
        setAllowedModules(modules);
      } catch (error) {
        console.error("Error fetching permissions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, []);

  return { isAdmin, allowedModules, loading };
};
