import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Clock } from "lucide-react";

// Sequência progressiva de delays entre mensagens
const DELAY_STAGES = [2, 5, 7, 9, 11, 13, 17]; // em segundos

export const SendDelayConfig = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Intervalo Entre Mensagens
        </CardTitle>
        <CardDescription>
          Sequência progressiva de delays aplicada entre o envio de cada mensagem
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">Sequência de delays configurada:</p>
          <div className="flex flex-wrap gap-2">
            {DELAY_STAGES.map((delay, index) => (
              <span key={index} className="px-3 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium">
                {delay}s
              </span>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          A cada mensagem enviada, o sistema aguarda progressivamente: 2s → 5s → 7s → 9s → 11s → 13s → 17s, 
          e então reinicia o ciclo. Isso ajuda a evitar bloqueios do WhatsApp.
        </p>
      </CardContent>
    </Card>
  );
};

export const getProgressiveDelay = (messageIndex: number): number => {
  // Retorna o delay em segundos baseado no índice da mensagem
  const stageIndex = messageIndex % DELAY_STAGES.length;
  return DELAY_STAGES[stageIndex];
};
