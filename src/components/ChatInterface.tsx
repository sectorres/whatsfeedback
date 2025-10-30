import { useState } from "react";
import { Send, Phone } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";

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
      text: "Olá! Sou seu assistente de pedidos. Como posso ajudar?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue("");

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: "Estou processando sua solicitação. Aguarde um momento...",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
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
                <p className="text-sm">{message.text}</p>
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
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-background">
        <div className="flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1"
          />
          <Button onClick={handleSend} className="bg-whatsapp hover:bg-whatsapp/90">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
