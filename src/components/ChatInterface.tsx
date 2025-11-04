import { useState, useEffect, useRef } from "react";
import { Send, Phone, Loader2, Paperclip, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Message {
  id: number;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

export const ChatInterface = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Olá! Sou seu assistente de pedidos. Como posso ajudar? Digite o número do pedido para consultar o status.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchOrder = async (query: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('fetch-cargas');

      if (error) throw error;

      if (data && data.status === 'SUCESSO' && data.retorno?.cargas) {
        const allOrders = data.retorno.cargas.flatMap((carga: any) => 
          carga.pedidos.map((pedido: any) => ({
            ...pedido,
            carga: carga,
          }))
        );

        const foundOrder = allOrders.find((order: any) => 
          order.pedido.includes(query) || 
          order.notaFiscal?.includes(query) ||
          order.id.toString() === query
        );

        if (foundOrder) {
          const statusMsg = `📦 *Pedido: ${foundOrder.pedido}*\n\n` +
            `Status: ${foundOrder.carga.status === 'FATU' ? '✅ Faturado' : foundOrder.carga.status === 'SEPA' ? '📦 Em Separação' : '🔓 Aberto'}\n` +
            `Nota Fiscal: ${foundOrder.notaFiscal || 'N/A'}\n` +
            `Data: ${formatDate(foundOrder.data)}\n` +
            `Valor: R$ ${foundOrder.valor?.toFixed(2) || '0.00'}\n` +
            `Motorista: ${foundOrder.carga.nomeMotorista || 'Não atribuído'}\n` +
            `Cliente: ${foundOrder.cliente?.nome || 'N/A'}`;
          
          return statusMsg;
        } else {
          return `❌ Pedido "${query}" não encontrado. Verifique o número e tente novamente.`;
        }
      }

      return "❌ Erro ao buscar dados. Tente novamente.";
    } catch (error) {
      console.error('Error searching order:', error);
      return "❌ Erro ao consultar pedido. Tente novamente.";
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const day = dateStr.slice(6, 8);
    const month = dateStr.slice(4, 6);
    const year = dateStr.slice(0, 4);
    return `${day}/${month}/${year}`;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tamanho (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Tamanho máximo: 10MB");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      setUploadingFile(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `chat-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error("Erro ao fazer upload do arquivo");
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !selectedFile) || loading || uploadingFile) return;

    let messageText = inputValue;
    let fileUrl: string | null = null;

    // Upload do arquivo se houver
    if (selectedFile) {
      fileUrl = await uploadFile(selectedFile);
      if (!fileUrl) return;
      
      messageText = messageText || `📎 ${selectedFile.name}`;
    }

    const newMessage: Message = {
      id: messages.length + 1,
      text: fileUrl ? `${messageText}\n\n📎 Arquivo: ${fileUrl}` : messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    const userQuery = inputValue;
    setInputValue("");
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Simulate bot response (apenas se houver texto)
    if (userQuery.trim()) {
      const botResponse = await searchOrder(userQuery);
      
      const botMessage: Message = {
        id: messages.length + 2,
        text: botResponse,
        sender: "bot",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, botMessage]);
    }
  };

  return (
    <Card className="flex flex-col h-[600px]">
      <div className="bg-whatsapp text-white p-4 rounded-t-lg flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <Phone className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">WhatsApp Bot</h3>
          <p className="text-xs opacity-90">Online</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 bg-muted/30">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === "user"
                    ? "bg-whatsapp text-white"
                    : "bg-card border"
                }`}
              >
                <p className="text-sm whitespace-pre-line">{message.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    message.sender === "user"
                      ? "text-white/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {message.timestamp.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card border rounded-lg p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        {selectedFile && (
          <div className="mb-2 flex items-center gap-2 text-sm bg-muted p-2 rounded">
            <Paperclip className="h-4 w-4" />
            <span className="flex-1 truncate">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || uploadingFile}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Digite o número do pedido..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1"
            disabled={loading || uploadingFile}
          />
          <Button 
            onClick={handleSend} 
            className="bg-whatsapp hover:bg-whatsapp/90"
            disabled={loading || uploadingFile}
          >
            {(loading || uploadingFile) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Card>
  );
};
