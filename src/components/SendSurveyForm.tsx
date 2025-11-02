import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { normalizePhone } from "@/lib/phone-utils";

interface SendSurveyFormProps {
  customerPhone?: string;
  customerName?: string;
}

export function SendSurveyForm({ customerPhone = "", customerName = "" }: SendSurveyFormProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(customerPhone);
  const [name, setName] = useState(customerName);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phone.trim()) {
      toast.error("Por favor, informe o telefone do cliente");
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(phone);

      // Criar um campaign_send avulso para esta pesquisa
      const { data: campaignSend, error: sendError } = await supabase
        .from('campaign_sends')
        .insert({
          campaign_id: '00000000-0000-0000-0000-000000000000', // ID especial para pesquisas avulsas
          customer_phone: normalizedPhone,
          customer_name: name || normalizedPhone,
          message_sent: 'Pesquisa de satisfação avulsa',
          status: 'success'
        })
        .select()
        .single();

      if (sendError) throw sendError;

      // Criar a pesquisa
      const { data: survey, error: surveyError } = await supabase
        .from('satisfaction_surveys')
        .insert({
          campaign_send_id: campaignSend.id,
          customer_phone: normalizedPhone,
          customer_name: name || normalizedPhone,
          status: 'pending'
        })
        .select()
        .single();

      if (surveyError) throw surveyError;

      // Enviar a pesquisa imediatamente
      const { data: sendResult, error: invokeError } = await supabase.functions.invoke('send-satisfaction-survey', {
        body: {
          campaignSendIds: [campaignSend.id]
        }
      });

      if (invokeError) throw invokeError;

      if (sendResult.surveys_sent > 0) {
        toast.success("Pesquisa enviada com sucesso!");
        setOpen(false);
        setPhone("");
        setName("");
      } else {
        toast.error("Não foi possível enviar a pesquisa");
      }
    } catch (error) {
      console.error('Erro ao enviar pesquisa:', error);
      toast.error("Erro ao enviar pesquisa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="h-4 w-4 mr-2" />
          Enviar Pesquisa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar Pesquisa de Satisfação</DialogTitle>
          <DialogDescription>
            Envie uma pesquisa de satisfação avulsa para um cliente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="Ex: 5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Informe o número completo com DDI e DDD (ex: 5511999999999)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Cliente</Label>
            <Input
              id="name"
              type="text"
              placeholder="Nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
