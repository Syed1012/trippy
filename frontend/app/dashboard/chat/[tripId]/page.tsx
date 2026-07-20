"use client";

import { useEffect, useRef, useState, useCallback, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Paperclip,
  Loader2,
  Users,
  File as FileIcon,
  Download,
  X,
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { GlassCard, Button, Avatar } from "@/components/ui";
import { chatApi, getValidAccessToken, tripsApi, usersApi, type ChatMessage, type UserPublicProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notification-context";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:8080/ws";

function MessageAttachment({
  attachment,
  isImage,
  isOwn,
  onError,
}: {
  attachment: NonNullable<ChatMessage["attachment"]>;
  isImage: boolean;
  isOwn: boolean;
  onError: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isImage) return;

    let objectUrl: string | null = null;
    let cancelled = false;
    chatApi.getAttachment(attachment.fileUrl)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(onError);

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.fileUrl, isImage, onError]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const blob = await chatApi.getAttachment(attachment.fileUrl);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      onError();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={downloading}
      className={cn(
        "flex max-w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs disabled:opacity-60",
        isOwn ? "bg-white/20" : "bg-surface",
      )}
    >
      {isImage && previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt={attachment.fileName}
          className="max-h-48 max-w-full rounded-lg"
        />
      ) : (
        <FileIcon size={14} className="shrink-0" />
      )}
      <span className="truncate">{attachment.fileName}</span>
      {downloading ? (
        <Loader2 size={14} className="ml-auto shrink-0 animate-spin" />
      ) : (
        <Download size={14} className="ml-auto shrink-0" />
      )}
    </button>
  );
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { notifications, markRead } = useNotifications();
  const tripId = params.tripId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [participants, setParticipants] = useState<UserPublicProfile[]>([]);
  const [onlineParticipantIds, setOnlineParticipantIds] = useState<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const stompRef = useRef<Client | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const unreadForTrip = notifications.filter(
      (notification) => notification.type === "NEW_MESSAGE"
        && !notification.read
        && notification.metadata?.tripId === tripId,
    );
    unreadForTrip.forEach((notification) => void markRead(notification.id));
  }, [tripId, notifications, markRead]);

  const loadParticipantProfiles = useCallback(async (userIds: string[]) => {
    const profiles = await usersApi.batchProfiles(userIds).catch(() => []);
    setParticipants(profiles);
  }, []);

  const resolveSenderNames = useCallback(async (chatMessages: ChatMessage[]) => {
    const unresolvedIds = [...new Set(chatMessages
      .filter((message) => !message.senderDisplayName || message.senderDisplayName === "Anonymous")
      .map((message) => message.senderId)
      .filter(Boolean))];
    if (unresolvedIds.length === 0) return chatMessages;

    const profiles = await usersApi.batchProfiles(unresolvedIds).catch(() => []);
    const namesById = new Map(profiles.map((profile) => [profile.id, profile.displayName]));
    return chatMessages.map((message) => ({
      ...message,
      senderDisplayName: namesById.get(message.senderId) ?? message.senderDisplayName,
    }));
  }, []);

  // Load initial messages
  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    Promise.all([
      chatApi.getMessages(tripId).catch(() => ({ messages: [], page: 0, size: 50, totalMessages: 0, hasMore: false })),
      tripsApi.get(tripId).then((trip) => trip.participants
        .filter((participant) => participant.status === "ACCEPTED")
        .map((participant) => participant.userId)).catch(() => []),
      chatApi.getParticipants(tripId).catch(() => []),
    ]).then(async ([msgData, parts, onlineIds]) => {
      setMessages(await resolveSenderNames(msgData.messages.reverse()));
      void loadParticipantProfiles(parts);
      setOnlineParticipantIds(new Set(onlineIds));
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    });
  }, [tripId, scrollToBottom, loadParticipantProfiles, resolveSenderNames]);

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
          client?.subscribe(`/topic/trips.${tripId}.participants`, (msg) => {
            try {
              const userIds: string[] = JSON.parse(msg.body);
              setOnlineParticipantIds(new Set(userIds));
            } catch {
              // ignore parse errors
            }
          }, connectHeaders);
          client?.subscribe(`/topic/trips.${tripId}.messages`, (msg) => {
            try {
              const chatMsg: ChatMessage = JSON.parse(msg.body);
              setMessages((prev) => {
                if (prev.some((m) => m.id === chatMsg.id)) return prev;
                return [...prev, chatMsg];
              });
              if (!chatMsg.senderDisplayName || chatMsg.senderDisplayName === "Anonymous") {
                void resolveSenderNames([chatMsg]).then(([resolved]) => {
                  setMessages((prev) => prev.map((message) =>
                    message.id === resolved.id ? resolved : message));
                });
              }
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
  }, [tripId, scrollToBottom, loadParticipantProfiles, resolveSenderNames, user?.userId, user?.displayName]);

  function handleLeaveChat() {
    router.push(`/dashboard/trips/${tripId}`);
  }

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
      const resolved = msg.senderDisplayName === "Anonymous" && user?.displayName
        ? { ...msg, senderDisplayName: user.displayName }
        : msg;
      setMessages((prev) => prev.some((existing) => existing.id === resolved.id) ? prev : [...prev, resolved]);
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
            <button
              type="button"
              onClick={handleLeaveChat}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Leave chat"
            >
              <ArrowLeft size={20} />
            </button>
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
                        <MessageAttachment
                          attachment={msg.attachment}
                          isImage={msg.type === "IMAGE"}
                          isOwn={isOwn}
                          onError={() => addToast("Failed to download attachment", "error")}
                        />
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
              <p className="text-xs text-muted">No trip participants</p>
            ) : (
              participants.map((participant) => {
                const isOnline = onlineParticipantIds.has(participant.id);
                return (
                <div key={participant.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface transition-colors">
                  <Avatar name={participant.displayName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{participant.displayName}</p>
                    <p className={cn("text-[10px]", isOnline ? "text-success" : "text-muted")}>
                      {isOnline ? "online" : "offline"}
                    </p>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
