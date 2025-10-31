import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Clock } from "lucide-react";
import { toast } from "sonner";

const STORAGE_KEY = 'whatsapp-send-delay-config';

export const SendDelayConfig = () => {
  const [minDelay, setMinDelay] = useState(5);
  const [maxDelay, setMaxDelay] = useState(60);

  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const { min, max } = JSON.parse(savedConfig);
        setMinDelay(min);
        setMaxDelay(max);
      } catch (error) {
        console.error('Error loading delay config:', error);
      }
    }
  }, []);

  const handleMinChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num >= 0 && num <= maxDelay) {
      setMinDelay(num);
      saveConfig(num, maxDelay);
    } else if (num > maxDelay) {
      toast.error("O tempo mínimo não pode ser maior que o máximo");
    }
  };

  const handleMaxChange = (value: string) => {
    const num = parseInt(value) || 0;
    if (num >= minDelay && num <= 300) {
      setMaxDelay(num);
      saveConfig(minDelay, num);
    } else if (num < minDelay) {
      toast.error("O tempo máximo não pode ser menor que o mínimo");
    } else if (num > 300) {
      toast.error("O tempo máximo não pode exceder 300 segundos (5 minutos)");
    }
  };

  const saveConfig = (min: number, max: number) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ min, max }));
    toast.success("Configuração de intervalo salva");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Intervalo Entre Mensagens
        </CardTitle>
        <CardDescription>
          Configure o tempo de espera aleatório entre o envio de cada mensagem da campanha (em segundos)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minDelay">Tempo Mínimo (segundos)</Label>
            <Input
              id="minDelay"
              type="number"
              min="0"
              max={maxDelay}
              value={minDelay}
              onChange={(e) => handleMinChange(e.target.value)}
              placeholder="5"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxDelay">Tempo Máximo (segundos)</Label>
            <Input
              id="maxDelay"
              type="number"
              min={minDelay}
              max="300"
              value={maxDelay}
              onChange={(e) => handleMaxChange(e.target.value)}
              placeholder="60"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Entre cada mensagem será aplicado um intervalo aleatório entre {minDelay} e {maxDelay} segundos.
          Isso ajuda a evitar bloqueios do WhatsApp.
        </p>
      </CardContent>
    </Card>
  );
};

export const getSendDelayConfig = (): { min: number; max: number } => {
  const savedConfig = localStorage.getItem(STORAGE_KEY);
  if (savedConfig) {
    try {
      const { min, max } = JSON.parse(savedConfig);
      return { min, max };
    } catch (error) {
      console.error('Error loading delay config:', error);
    }
  }
  return { min: 5, max: 60 }; // valores padrão
};
