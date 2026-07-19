"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { ApiError, notificationsApi, getAccessToken, type Notification } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  totalPages: number;
  loading: boolean;
  fetchNotifications: (page?: number, size?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectDelayRef = useRef(1000); // Start reconnect delay at 1s

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || isAuthLoading) return;
    try {
      const data = await notificationsApi.unreadCount();
      setUnreadCount(data.count);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
      console.error("Failed to fetch unread count:", err);
    }
  }, [isAuthenticated, isAuthLoading]);

  const fetchNotifications = useCallback(async (page = 0, size = 20) => {
    if (!isAuthenticated || isAuthLoading) return;
    setLoading(true);
    try {
      const data = await notificationsApi.list(page, size);
      setNotifications(data.content);
      setTotalPages(data.totalPages);
      await fetchUnreadCount();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return;
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthLoading, fetchUnreadCount]);

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    try {
      const removed = notifications.find((n) => n.id === id);
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (removed && !removed.read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  }, [notifications]);

  // Connect to SSE stream
  const connectSSE = useCallback(() => {
    if (!isAuthenticated || isAuthLoading) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = getAccessToken();
    if (!token) return;

    const envUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
    let apiBase = envUrl;
    if (typeof window !== "undefined") {
      try {
        const url = new URL(envUrl);
        const isLocalOrIp =
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1" ||
          /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname);

        if (isLocalOrIp) {
          url.hostname = window.location.hostname;
        }
        apiBase = url.toString().replace(/\/$/, "");
      } catch {
        apiBase = `http://${window.location.hostname}:8080`;
      }
    }

    const sseUrl = `${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`;
    console.log("Connecting to SSE notification stream:", sseUrl);
    
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      console.log("SSE notification stream connected successfully");
      reconnectDelayRef.current = 1000; // Reset reconnect delay on successful connection
    };

    es.addEventListener("notification", (event) => {
      try {
        const newNotif = JSON.parse(event.data) as Notification;
        console.log("Received SSE notification:", newNotif);

        // Update notifications list in real-time
        setNotifications((prev) => {
          // Prevent duplicates
          if (prev.some((n) => n.id === newNotif.id)) return prev;
          return [newNotif, ...prev].slice(0, 40);
        });

        // Increment unread count
        setUnreadCount((c) => c + 1);

        // Play a subtle notification sound or show a toast
        addToast(newNotif.title, "info");
      } catch (err) {
        console.error("Failed to parse real-time notification event:", err);
      }
    });

    es.onerror = (err) => {
      console.warn("SSE notification stream error, scheduling reconnect", err);
      es.close();
      
      // Schedule reconnect with exponential backoff (max 30s)
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
        connectSSE();
      }, reconnectDelayRef.current);
    };

  }, [isAuthenticated, isAuthLoading, addToast]);

  // Handle connection & cleanup on auth changes
  useEffect(() => {
    if (isAuthenticated && !isAuthLoading) {
      fetchNotifications();
      connectSSE();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isAuthenticated, isAuthLoading, fetchNotifications, connectSSE]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        totalPages,
        loading,
        fetchNotifications,
        fetchUnreadCount,
        markRead,
        markAllRead,
        deleteNotification,
        setNotifications,
        setUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
