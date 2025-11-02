import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, X, Loader2, Archive } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SendSurveyForm } from "@/components/SendSurveyForm";

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string;
  status: string;
  assigned_to: string | null;
  unread_count: number;
  last_read_at: string | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_name: string | null;
  message_text: string;
  message_status: string | null;
  created_at: string;
  media_type?: string | null;
  media_url?: string | null;
  media_transcription?: string | null;
  media_description?: string | null;
}

export function ConversationsPanel() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadConversations();

    // Realtime para conversas
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);

      // Marcar como lida ao abrir
      markAsRead(selectedConversation.id);

      // Realtime para mensagens da conversa selecionada
      const messagesChannel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
            // Incrementar contador de não lidas se for mensagem do cliente
            if (payload.new.sender_type === 'customer') {
              supabase
                .from('conversations')
                .update({ 
                  unread_count: selectedConversation.unread_count + 1 
                })
                .eq('id', selectedConversation.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setLoading(true);
    const { data: activeData, error: activeError } = await supabase
      .from('conversations')
      .select('*')
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });

    const { data: archivedData, error: archivedError } = await supabase
      .from('conversations')
      .select('*')
      .eq('status', 'closed')
      .order('last_message_at', { ascending: false });

    if (activeError) {
      console.error('Error loading active conversations:', activeError);
      toast.error('Erro ao carregar conversas ativas');
    } else {
      setConversations(activeData || []);
    }

    if (archivedError) {
      console.error('Error loading archived conversations:', archivedError);
    } else {
      setArchivedConversations(archivedData || []);
    }
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } else {
      setMessages(data || []);
    }
  };

  const markAsRead = async (conversationId: string) => {
    await supabase
      .from('conversations')
      .update({ 
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    // Atualizar lista local
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0, last_read_at: new Date().toISOString() }
          : conv
      )
    );
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    setSending(true);
    try {
      // Enviar via Evolution API
      const response = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: selectedConversation.customer_phone,
          message: messageText
        }
      });

      if (response.error) throw response.error;

      // Salvar mensagem no banco
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: 'operator',
          sender_name: 'Operador',
          message_text: messageText,
          message_status: 'sent'
        });

      if (dbError) throw dbError;

      // Atualizar última mensagem da conversa
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setMessageText("");
      toast.success('Mensagem enviada!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!selectedConversation) return;

    const { error } = await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Erro ao encerrar conversa');
    } else {
      toast.success('Conversa encerrada');
      setSelectedConversation(null);
      loadConversations();
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-0">
      {/* Lista de conversas */}
      <Card className="p-4 flex flex-col h-full min-h-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "active" | "archived")} className="flex flex-col h-full min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="active" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Ativas
              <Badge variant="secondary">{conversations.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              Antigas
              <Badge variant="secondary">{archivedConversations.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa ativa
                </p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors relative ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{conv.customer_name || conv.customer_phone}</div>
                          {conv.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1">
                              {conv.unread_count}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {conv.customer_phone}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </div>
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : archivedConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa arquivada
                </p>
              ) : (
                archivedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-3 rounded-lg cursor-pointer mb-2 transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{conv.customer_name || conv.customer_phone}</div>
                      <div className="text-xs text-muted-foreground">
                        {conv.customer_phone}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Área de chat */}
      <Card className="md:col-span-2 p-4 flex flex-col h-full min-h-0 overflow-hidden">
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">
                  {selectedConversation.customer_name || selectedConversation.customer_phone}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.customer_phone}
                </p>
              </div>
              <div className="flex gap-2">
                <SendSurveyForm 
                  customerPhone={selectedConversation.customer_phone}
                  customerName={selectedConversation.customer_name || undefined}
                />
                <Button variant="outline" size="sm" onClick={closeConversation}>
                  <X className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              </div>
            </div>
            <Separator className="mb-4" />
            
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-4 pb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 ${
                      msg.sender_type === 'operator' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[70%] break-words ${
                        msg.sender_type === 'operator'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {/* Imagem */}
                      {msg.media_type === 'image' && msg.media_url && (
                        <div className="mb-2">
                          <img 
                            src={msg.media_url} 
                            alt="Imagem enviada" 
                            className="rounded max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(msg.media_url, '_blank')}
                          />
                          {msg.media_description && (
                            <p className="text-xs mt-2 opacity-80">
                              📝 {msg.media_description}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Áudio */}
                      {msg.media_type === 'audio' && msg.media_url && (
                        <div className="mb-2 space-y-2">
                          <audio 
                            controls 
                            className="w-full max-w-sm"
                            preload="metadata"
                          >
                            <source src={msg.media_url} type="audio/ogg; codecs=opus" />
                            <source src={msg.media_url} type="audio/mpeg" />
                            <source src={msg.media_url} />
                            Seu navegador não suporta áudio.
                          </audio>
                          {msg.media_transcription && (
                            <p className="text-xs opacity-80 bg-black/10 dark:bg-white/10 p-2 rounded">
                              🎤 Transcrição: {msg.media_transcription}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Vídeo */}
                      {msg.media_type === 'video' && msg.media_url && (
                        <div className="mb-2">
                          <video 
                            controls 
                            className="rounded max-w-full max-h-64"
                            preload="metadata"
                          >
                            <source src={msg.media_url} type="video/mp4" />
                            <source src={msg.media_url} />
                            Seu navegador não suporta vídeo.
                          </video>
                        </div>
                      )}

                      {/* Documento */}
                      {msg.media_type === 'document' && msg.media_url && (
                        <div className="mb-2">
                          <a 
                            href={msg.media_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm underline hover:opacity-80 transition-opacity bg-black/10 dark:bg-white/10 p-3 rounded"
                          >
                            <span className="text-2xl">📄</span>
                            <span>Visualizar documento</span>
                          </a>
                        </div>
                      )}
                      
                      <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4">
              <Input
                placeholder="Digite sua mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <Button onClick={sendMessage} disabled={sending || !messageText.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        )}
      </Card>
    </div>
  );
}