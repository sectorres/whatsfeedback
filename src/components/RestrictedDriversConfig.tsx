import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Truck } from "lucide-react";

interface RestrictedDriver {
  name: string;
}

export function RestrictedDriversConfig() {
  const [drivers, setDrivers] = useState<RestrictedDriver[]>([]);
  const [newDriverName, setNewDriverName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    const { data } = await supabase
      .from("app_config")
      .select("config_value")
      .eq("config_key", "restricted_drivers")
      .maybeSingle();

    if (data?.config_value) {
      try {
        const parsed = JSON.parse(data.config_value);
        setDrivers(parsed);
      } catch {
        setDrivers([]);
      }
    } else {
      // Default with CARGA MAE
      const defaultDrivers = [{ name: "CARGA MAE" }];
      setDrivers(defaultDrivers);
      await saveDrivers(defaultDrivers);
    }
  };

  const saveDrivers = async (driversList: RestrictedDriver[]) => {
    setLoading(true);
    const { error } = await supabase
      .from("app_config")
      .upsert(
        {
          config_key: "restricted_drivers",
          config_value: JSON.stringify(driversList),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "config_key" }
      );

    setLoading(false);

    if (error) {
      toast.error("Erro ao salvar motoristas restritos");
      console.error(error);
    } else {
      toast.success("Motoristas restritos atualizados");
    }
  };

  const addDriver = async () => {
    if (!newDriverName.trim()) {
      toast.error("Digite o nome do motorista");
      return;
    }

    const normalizedName = newDriverName.trim().toUpperCase();
    
    if (drivers.some(d => d.name.toUpperCase() === normalizedName)) {
      toast.error("Motorista já está na lista");
      return;
    }

    const updatedDrivers = [...drivers, { name: normalizedName }];
    setDrivers(updatedDrivers);
    setNewDriverName("");
    await saveDrivers(updatedDrivers);
  };

  const removeDriver = async (index: number) => {
    const updatedDrivers = drivers.filter((_, i) => i !== index);
    setDrivers(updatedDrivers);
    await saveDrivers(updatedDrivers);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Motoristas Restritos
        </CardTitle>
        <CardDescription>
          Pedidos de motoristas nesta lista serão ignorados no envio automático de templates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="driver-name" className="sr-only">Nome do Motorista</Label>
            <Input
              id="driver-name"
              placeholder="Nome do motorista (ex: CARGA MAE)"
              value={newDriverName}
              onChange={(e) => setNewDriverName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addDriver()}
            />
          </div>
          <Button onClick={addDriver} disabled={loading}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-2">
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum motorista restrito configurado</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {drivers.map((driver, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="flex items-center gap-2 py-1.5 px-3"
                >
                  <span>{driver.name}</span>
                  <button
                    onClick={() => removeDriver(index)}
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
          Os nomes são comparados de forma case-insensitive (maiúsculas/minúsculas são ignoradas)
        </p>
      </CardContent>
    </Card>
  );
}
