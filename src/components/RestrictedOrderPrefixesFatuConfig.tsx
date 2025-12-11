import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, FileText } from "lucide-react";

interface RestrictedPrefix {
  prefix: string;
}

export function RestrictedOrderPrefixesFatuConfig() {
  const [prefixes, setPrefixes] = useState<RestrictedPrefix[]>([]);
  const [newPrefix, setNewPrefix] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPrefixes();
  }, []);

  const loadPrefixes = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "restricted_order_prefixes_fatu")
      .maybeSingle();

    if (data?.config_value) {
      try {
        const parsed = JSON.parse(data.config_value);
        setPrefixes(parsed);
      } catch {
        setPrefixes([]);
      }
    } else {
      setPrefixes([]);
    }
  };

  const savePrefixes = async (prefixList: RestrictedPrefix[]) => {
    setLoading(true);
    const { error } = await supabase
      .from("app_config")
      .upsert(
        {
          config_key: "restricted_order_prefixes_fatu",
          config_value: JSON.stringify(prefixList),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "config_key" }
      );

    setLoading(false);

    if (error) {
      toast.error("Erro ao salvar prefixos inibidos FATU");
      console.error(error);
    } else {
      toast.success("Prefixos inibidos FATU atualizados");
    }
  };

  const addPrefix = async () => {
    if (!newPrefix.trim()) {
      toast.error("Digite o prefixo do pedido");
      return;
    }

    const normalizedPrefix = newPrefix.trim().toUpperCase();
    
    if (prefixes.some(p => p.prefix.toUpperCase() === normalizedPrefix)) {
      toast.error("Prefixo já está na lista");
      return;
    }

    const updatedPrefixes = [...prefixes, { prefix: normalizedPrefix }];
    setPrefixes(updatedPrefixes);
    setNewPrefix("");
    await savePrefixes(updatedPrefixes);
  };

  const removePrefix = async (index: number) => {
    const updatedPrefixes = prefixes.filter((_, i) => i !== index);
    setPrefixes(updatedPrefixes);
    await savePrefixes(updatedPrefixes);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Prefixos de Pedidos Inibidos (FATU)
        </CardTitle>
        <CardDescription>
          Pedidos que iniciam com estes prefixos serão ignorados no envio automático quando status FATU + Serie N + NF 050/
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="prefix-fatu" className="sr-only">Prefixo do Pedido</Label>
            <Input
              id="prefix-fatu"
              placeholder="Prefixo (ex: 020/)"
              value={newPrefix}
              onChange={(e) => setNewPrefix(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPrefix()}
            />
          </div>
          <Button onClick={addPrefix} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {prefixes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum prefixo inibido configurado</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {prefixes.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-2 py-1.5 px-3"
                >
                  <span>{item.prefix}</span>
                  <button
                    onClick={() => removePrefix(index)}
                    className="hover:text-destructive transition-colors"
                    disabled={loading}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Os prefixos são comparados de forma case-insensitive. Exemplo: "020/" irá inibir pedidos como "020/0123456-P"
        </p>
      </CardContent>
    </Card>
  );
}
