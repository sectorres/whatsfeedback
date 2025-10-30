import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();

    // Realtime para atualizar o contador
    const channel = supabase
      .channel('unread-count-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadUnreadCount = async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select('unread_count')
      .eq('status', 'active');

    if (!error && data) {
      const total = data.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
      setUnreadCount(total);
    }
  };

  return unreadCount;
}
