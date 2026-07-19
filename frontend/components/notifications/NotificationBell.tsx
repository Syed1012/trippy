"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  Plane,
  CreditCard,
  MessageSquare,
  CheckCheck,
  Info,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { notificationsApi, participantsApi, type Notification } from "@/lib/api";
import { cn } from "@/lib/utils";
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
  return `${days}d ago`;
}

export default function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markRead,
    markAllRead,
    deleteNotification,
  } = useNotifications();

  // Load notifications when dropdown opens
  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleMarkAllRead() {
    await markAllRead();
  }

  async function handleClickNotification(n: Notification) {
    if (!n.read) {
      await markRead(n.id);
    }
    setOpen(false);
    if (n.actionUrl) {
      router.push(n.actionUrl);
    }
  }

  async function handleDeleteNotification(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteNotification(id);
  }

  function isJoinRequest(n: Notification) {
    return n.type === "TRIP_INVITE" && n.title === "Join Request" && !!n.metadata?.requesterId;
  }

  function isInviteNotification(n: Notification) {
    return n.type === "TRIP_INVITE" && n.title === "Trip Invitation" && !!n.metadata?.tripId;
  }

  async function handleApprove(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    const requesterId = n.metadata?.requesterId as string;
    if (!tripId || !requesterId) return;
    try {
      await participantsApi.approve(tripId, requesterId);
      await deleteNotification(n.id);
    } catch {
      // ignore
    }
  }

  async function handleReject(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    const requesterId = n.metadata?.requesterId as string;
    if (!tripId || !requesterId) return;
    try {
      await participantsApi.reject(tripId, requesterId);
      await deleteNotification(n.id);
    } catch {
      // ignore
    }
  }

  async function handleAcceptInvite(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    if (!tripId) return;
    try {
      await participantsApi.accept(tripId);
      await deleteNotification(n.id);
    } catch {
      // ignore
    }
  }

  async function handleDeclineInvite(e: React.MouseEvent, n: Notification) {
    e.stopPropagation();
    const tripId = n.metadata?.tripId as string;
    if (!tripId) return;
    try {
      await participantsApi.decline(tripId);
      await deleteNotification(n.id);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell icon with badge */}
      <button
        onClick={() => setOpen(!open)}
        className={cn("relative flex items-center justify-center rounded-xl p-2 text-muted hover:text-foreground hover:bg-surface transition-all", className)}
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="fixed left-3 right-3 top-16 glass-strong shadow-2xl z-50 max-h-[calc(100vh-5rem)] flex flex-col sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-[32rem]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs text-trippy-400 hover:text-trippy-300 transition-colors"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-muted">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell size={24} className="mx-auto mb-2 text-muted" />
                <p className="text-sm text-muted">You&apos;re all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = typeIcon[n.type] ?? Bell;
                const hasActions = isJoinRequest(n) || isInviteNotification(n);
                return (
                  <div
                    key={n.id}
                    onClick={hasActions ? undefined : () => handleClickNotification(n)}
                    className={cn(
                      "group flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface transition-colors",
                      !n.read && "bg-trippy-500/5",
                      !hasActions && "cursor-pointer",
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                        !n.read ? "bg-trippy-500/15 text-trippy-500" : "bg-surface text-muted",
                      )}
                    >
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm line-clamp-1", !n.read && "font-medium")}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted line-clamp-2 mt-0.5">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-muted mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                      {isJoinRequest(n) && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleApprove({ stopPropagation: () => {} } as React.MouseEvent, n)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-green-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition-colors"
                          >
                            <UserCheck size={12} /> Approve
                          </button>
                          <button
                            onClick={() => handleReject({ stopPropagation: () => {} } as React.MouseEvent, n)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                          >
                            <UserX size={12} /> Reject
                          </button>
                        </div>
                      )}
                      {isInviteNotification(n) && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptInvite({ stopPropagation: () => {} } as React.MouseEvent, n)}
                            className="inline-flex items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-600 transition-colors"
                          >
                            <UserCheck size={12} /> Accept
                          </button>
                          <button
                            onClick={() => handleDeclineInvite({ stopPropagation: () => {} } as React.MouseEvent, n)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:bg-shore-100 transition-colors"
                          >
                            <UserX size={12} /> Decline
                          </button>
                        </div>
                      )}
                    </div>
                    {!n.read && (
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-trippy-500" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteNotification(e, n.id); }}
                      className="mt-1 shrink-0 rounded p-1 text-muted hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Delete notification"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
