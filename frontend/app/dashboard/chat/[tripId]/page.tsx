"use client";

import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Loader2,
  Users,
  File as FileIcon,
  Image as ImageIcon,
  X,
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { GlassCard, Button, Avatar } from "@/components/ui";
import { chatApi, getValidAccessToken, type ChatMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const tripId = params.tripId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stompRef = useRef<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    Promise.all([
      chatApi.getMessages(tripId).catch(() => ({ messages: [], page: 0, size: 50, totalMessages: 0, hasMore: false })),
      chatApi.getParticipants(tripId).catch(() => []),
    ]).then(([msgData, parts]) => {
      setMessages(msgData.messages.reverse());
      setParticipants(parts);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    });
  }, [tripId, scrollToBottom]);

  // WebSocket connection
  useEffect(() => {
    if (!tripId) return;

    let cancelled = false;
    let client: Client | null = null;

    getValidAccessToken().then((token) => {
      if (cancelled || !token) return;

      const connectHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      if (user?.userId) connectHeaders["X-User-Id"] = user.userId;
      if (user?.displayName) connectHeaders["X-User-DisplayName"] = user.displayName;

      client = new Client({
        webSocketFactory: () => new SockJS(WS_URL),
        connectHeaders,
        beforeConnect: async () => {
          const currentToken = await getValidAccessToken();
          if (!currentToken) throw new Error("No valid chat access token");
          connectHeaders.Authorization = `Bearer ${currentToken}`;
        },
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          setConnected(true);
          client?.subscribe(`/topic/trips.${tripId}.messages`, (msg) => {
            try {
              const chatMsg: ChatMessage = JSON.parse(msg.body);
              setMessages((prev) => {
                if (prev.some((m) => m.id === chatMsg.id)) return prev;
                return [...prev, chatMsg];
              });
              setTimeout(scrollToBottom, 50);
            } catch {
              // ignore parse errors
            }
          }, connectHeaders);
        },
        onDisconnect: () => setConnected(false),
        onStompError: () => setConnected(false),
      });

      client.activate();
      stompRef.current = client;
    }).catch(() => setConnected(false));

    return () => {
      cancelled = true;
      client?.deactivate();
      stompRef.current = null;
    };
  }, [tripId, scrollToBottom, user?.userId, user?.displayName]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const text = input.trim();
    setInput("");

    try {
      // Try STOMP first, fallback to REST
      if (stompRef.current?.connected) {
        stompRef.current.publish({
          destination: `/app/trips/${tripId}/send`,
          body: JSON.stringify({ content: text }),
        });
      } else {
        const msg = await chatApi.sendMessage(tripId, text);
        setMessages((prev) => prev.some((existing) => existing.id === msg.id) ? prev : [...prev, msg]);
        scrollToBottom();
      }
    } catch {
      addToast("Failed to send message", "error");
      setInput(text); // Restore input
    } finally {
      setSending(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const msg = await chatApi.uploadFile(tripId, file);
      setMessages((prev) => prev.some((existing) => existing.id === msg.id) ? prev : [...prev, msg]);
      scrollToBottom();
      addToast("File uploaded", "success");
    } catch {
      addToast("Failed to upload file", "error");
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const userId = user?.userId;

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/trips/${tripId}`}
              className="text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="font-semibold">Trip Chat</h2>
              <p className="text-xs text-muted">
                {connected ? (
                  <span className="text-success">● Connected</span>
                ) : (
                  <span className="text-warning">● Connecting...</span>
                )}
                {" · "}{participants.length} participant{participants.length !== 1 && "s"}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="md:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Users size={14} />
          </Button>
        </div>

        {/* Messages */}
        <GlassCard className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 size={24} className="animate-spin text-trippy-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="text-muted">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isOwn = msg.senderId === userId;
              const isSystem = msg.type === "SYSTEM";

              if (isSystem) {
                return (
                  <div key={msg.id} className="text-center">
                    <span className="text-xs text-muted italic">{msg.content}</span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", isOwn ? "flex-row-reverse" : "flex-row")}
                >
                  {!isOwn && (
                    <Avatar
                      name={msg.senderDisplayName ?? "User"}
                      size="sm"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2",
                      isOwn
                        ? "bg-trippy-500 text-white rounded-tr-sm"
                        : "glass-sm rounded-tl-sm",
                    )}
                  >
                    {!isOwn && (
                      <p className="text-xs font-medium text-trippy-400 mb-0.5">
                        {msg.senderDisplayName ?? "Unknown"}
                      </p>
                    )}

                    {/* Attachment */}
                    {msg.attachment && (
                      <div className="mb-1">
                        {msg.type === "IMAGE" ? (
                          <a href={msg.attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={msg.attachment.fileUrl}
                              alt={msg.attachment.fileName}
                              className="max-w-full max-h-48 rounded-lg"
                            />
                          </a>
                        ) : (
                          <a
                            href={msg.attachment.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                              isOwn ? "bg-white/20" : "bg-surface",
                            )}
                          >
                            <FileIcon size={14} />
                            <span className="truncate">{msg.attachment.fileName}</span>
                          </a>
                        )}
                      </div>
                    )}

                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        isOwn ? "text-white/60" : "text-muted",
                      )}
                    >
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </GlassCard>

        {/* Input */}
        <form onSubmit={handleSend} className="mt-3 flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
          >
            <Paperclip size={16} />
          </Button>
          <div className="flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="glass-sm w-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:ring-2 focus:ring-trippy-500/40 transition-all"
            />
          </div>
          <Button type="submit" size="sm" disabled={!input.trim() || sending}>
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </Button>
        </form>
      </div>

      {/* Participants Sidebar */}
      <div
        className={cn(
          "w-64 shrink-0",
          showSidebar ? "block" : "hidden md:block",
        )}
      >
        <GlassCard className="h-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Participants</h3>
            <button
              className="md:hidden text-muted hover:text-foreground"
              onClick={() => setShowSidebar(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-xs text-muted">No participants online</p>
            ) : (
              participants.map((pId) => (
                <div key={pId} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface transition-colors">
                  <Avatar size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{pId.slice(0, 8)}...</p>
                    <p className="text-[10px] text-success">online</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
