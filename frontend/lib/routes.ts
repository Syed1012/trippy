export const ROUTES = {
  home: "/",
  login: "/login",
  forgotPassword: "/forgot-password",
  register: "/register",
  verifyEmail: "/verify-email",
  notifications: "/notifications",
  aiTrip: "/ai-trip",
  dashboard: "/dashboard",
  dashboardChat: "/dashboard/chat",
  dashboardPayments: "/dashboard/payments",
  dashboardNotifications: "/dashboard/notifications",
  dashboardProfile: "/dashboard/profile",
  dashboardSettings: "/dashboard/settings",
  dashboardAdminModeration: "/dashboard/admin/moderation",
  about: "/about",
  privacy: "/privacy",
  terms: "/terms",
} as const;

export const LANDING_ANCHORS = {
  features: "/#features",
  howItWorks: "/#how-it-works",
} as const;
