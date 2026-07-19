"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plane,
  CreditCard,
  MessageSquare,
  Info,
  CheckCheck,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { motion } from "framer-motion";
import { GlassCard, Button } from "@/components/ui";
import { participantsApi, type Notification } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/toast";
import { useNotifications } from "@/lib/notification-context";

const typeIcon: Record<string, typeof Bell> = {
  TRIP_INVITE: Plane,
  TRIP_JOINED: Plane,
  ITINERARY_READY: Plane,
  TRIP_INVITATION: Plane,
  INVITATION_ACCEPTED: Plane,
  INVITATION_DECLINED: Plane,
  TRIP_UPDATED: Plane,
  TRIP_CANCELLED: Plane,
  PAYMENT_SUCCESS: CreditCard,
  PAYMENT_FAILED: CreditCard,
  SUBSCRIPTION_EXPIRING: CreditCard,
  NEW_MESSAGE: MessageSquare,
  SYSTEM: Info,
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [page, setPage] = useState(0);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const {
    notifications,
    unreadCount,
    totalPages,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  } = useNotifications();

  useEffect(() => {
    fetchNotifications(page, 20);
  }, [page, fetchNotifications]);

  async function handleMarkAllRead() {
    await markAllRead();
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      await markRead(n.id);
    }
    if (n.actionUrl) router.push(n.actionUrl);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteNotification(id);
  }

  async function handleApprove(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    const requesterId = n.metadata?.requesterId as string;
    if (!tripId || !requesterId) return;

    setProcessingIds((prev) => new Set(prev).add(n.id));
    try {
      await participantsApi.approve(tripId, requesterId);
      addToast("Join request approved!", "success");
      await deleteNotification(n.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to approve";
      addToast(msg, "error");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(n.id); return s; });
    }
  }

  async function handleReject(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    const requesterId = n.metadata?.requesterId as string;
    if (!tripId || !requesterId) return;

    setProcessingIds((prev) => new Set(prev).add(n.id));
    try {
      await participantsApi.reject(tripId, requesterId);
      addToast("Join request rejected.", "success");
      await deleteNotification(n.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to reject";
      addToast(msg, "error");
    } finally {
      setProcessingIds((prev) => { const s = new Set(prev); s.delete(n.id); return s; });
    }
  }

  function isJoinRequest(n: Notification) {
    return n.type === "TRIP_INVITE" && n.title === "Join Request" && !!n.metadata?.requesterId;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Notifications
          </h1>
          <p className="mt-1 text-muted">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
              : "All caught up!"}
          </p>
        </motion.div>

        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck size={14} /> Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 size={32} className="animate-spin text-trippy-500" />
        </div>
      ) : notifications.length === 0 ? (
        <motion.div
          className="mt-16 flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-trippy-500/10">
            <Bell size={40} className="text-trippy-500" />
          </div>
          <h3 className="mt-6 text-lg font-semibold">You&apos;re all caught up!</h3>
          <p className="mt-2 text-muted max-w-sm">
            No notifications yet. When something happens, you&apos;ll see it here.
          </p>
        </motion.div>
      ) : (
        <>
          <div className="space-y-2">
            {notifications.map((n, i) => {
              const Icon = typeIcon[n.type] ?? Bell;
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <GlassCard
                    className={cn(
                      "flex items-start gap-4 p-4 cursor-pointer hover:bg-surface-hover transition-all",
                      !n.read && "ring-1 ring-trippy-500/20 bg-trippy-500/5",
                    )}
                    onClick={() => handleClick(n)}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                        !n.read
                          ? "bg-trippy-500/15 text-trippy-500"
                          : "bg-surface text-muted",
                      )}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={cn("text-sm", !n.read && "font-semibold")}>
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="h-2 w-2 rounded-full bg-trippy-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-muted mt-0.5">{n.message}</p>
                      <p className="text-xs text-muted mt-1">{timeAgo(n.createdAt)}</p>
                      {/* Approve / Reject actions for join requests */}
                      {isJoinRequest(n) && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={(e) => handleApprove(e, n)}
                            disabled={processingIds.has(n.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-600 disabled:opacity-50"
                          >
                            <UserCheck size={13} /> Approve
                          </button>
                          <button
                            onClick={(e) => handleReject(e, n)}
                            disabled={processingIds.has(n.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                          >
                            <UserX size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, n.id)}
                      className="mt-1 shrink-0 rounded p-1.5 text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                      aria-label="Delete notification"
                    >
                      <Trash2 size={14} />
                    </button>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
