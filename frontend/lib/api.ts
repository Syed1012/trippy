const getApiBaseUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
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
      return url.toString().replace(/\/$/, "");
    } catch {
      return `http://${window.location.hostname}:8080`;
    }
  }
  return envUrl;
};

const API_BASE_URL = getApiBaseUrl();

const TOKEN_KEY = "trippy_access_token";
const REFRESH_KEY = "trippy_refresh_token";

/* ------------------------------------------------------------------ */
/*  Token helpers                                                      */
/* ------------------------------------------------------------------ */

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  if (expiresAt > Date.now() + 30_000) return token;

  const refreshed = await refreshAccessToken();
  return refreshed.accessToken;
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Decode JWT payload without verification (claims are already server-validated). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return {};
  }
}

/** Extract UserProfile from JWT access token claims. */
export function getUserFromToken(token: string): UserProfile | null {
  const claims = decodeJwtPayload(token);
  if (!claims.sub) return null;
  return {
    userId: claims.sub as string,
    email: (claims.email as string) ?? "",
    displayName: (claims.displayName as string) ?? "",
    role: (claims.role as UserProfile["role"]) ?? "MEMBER",
    emailVerified: (claims.emailVerified as boolean) ?? false,
  };
}

/* ------------------------------------------------------------------ */
/*  Generic fetch wrapper                                              */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(typeof body?.message === "string" ? body.message : `API error ${status}`);
  }
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error?: string;
  message?: string;
  details?: ApiFieldError[];
}

interface ApiRequestOptions extends RequestInit {
  auth?: boolean;
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  const token = getAccessToken();
  if (auth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestPublic<T>(path: string): Promise<T> {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return request<T>(path, { auth: false });
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Auth API                                                           */
/* ------------------------------------------------------------------ */

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  role: "MEMBER" | "HOST" | "ADMIN" | "USER";
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  bio?: string;
  country?: string;
  phoneNumber?: string;
  emailVerified: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: UserProfile;
}

export interface RegisterResponse {
  userId: string;
  email: string;
  message: string;
  verificationRequired: boolean;
}

export async function login(
  email: string,
  password: string,
  rememberMe = false,
): Promise<LoginResponse> {
  const data = await request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rememberMe }),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<RegisterResponse> {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  return request<{ message: string }>("/users/verify-email", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  return request<{ message: string }>("/users/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  phoneNumber?: string;
  country?: string;
  avatarUrl?: string;
}

export async function getProfile(): Promise<UserProfile> {
  return request<UserProfile>("/users/me", { method: "GET" });
}

export async function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  return request<UserProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    await request("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {
      /* best-effort — clear tokens regardless */
    });
  }
  clearTokens();
}

interface TokenRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function refreshAccessToken(): Promise<LoginResponse> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");

  const data = await request<TokenRefreshResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  setTokens(data.accessToken, data.refreshToken);

  // Backend refresh endpoint returns tokens only (no user field).
  // Extract user profile from the JWT claims.
  const user = getUserFromToken(data.accessToken);
  if (!user) throw new Error("Invalid token payload");

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresIn: data.expiresIn,
    tokenType: "Bearer",
    user,
  };
}

/* ------------------------------------------------------------------ */
/*  Generic helpers (re-export for convenience)                        */
/* ------------------------------------------------------------------ */

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

/* ------------------------------------------------------------------ */
/*  Trip API                                                           */
/* ------------------------------------------------------------------ */

export interface Trip {
  tripId: string;
  title: string;
  description?: string;
  destination: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  organizerId: string;
  status: "DRAFT" | "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  participantCount: number;
  currentUserStatus?: string | null;
  hasItinerary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripDetail extends Trip {
  participants: Participant[];
  itinerary?: Itinerary;
}

export interface Participant {
  participantId: string;
  tripId: string;
  userId: string;
  displayName?: string;
  avatarUrl?: string;
  role: "OWNER" | "EDITOR" | "VIEWER" | "MEMBER";
  status: "PENDING" | "PENDING_APPROVAL" | "ACCEPTED" | "DECLINED" | "LEFT" | "INVITED";
  invitedAt?: string;
  joinedAt?: string;
}

export interface Itinerary {
  itineraryId: string;
  tripId: string;
  days: DayPlan[];
  generatedAt?: string;
}

export interface WeatherSummary {
  condition?: string;
  temperatureCelsius?: number | null;
  advice?: string;
}

export interface TransportRecommendation {
  from?: string;
  to?: string;
  mode?: string;
  estimatedDuration?: string;
  notes?: string;
}

export interface DayPlan {
  dayPlanId: string;
  dayNumber: number;
  date?: string;
  title?: string;
  activities: Activity[];
  votingEnabled?: boolean;
  votingFrozen?: boolean;
  votingDeadline?: string;
  upvotes?: number;
  downvotes?: number;
  currentUserVote?: "UPVOTE" | "DOWNVOTE" | null;
  weather?: WeatherSummary;
  transportRecommendations?: TransportRecommendation[];
}

export interface Activity {
  activityId: string;
  time?: string;
  title: string;
  description?: string;
  location?: string;
  category?: string;
  estimatedCost?: string;
  currency?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  upvotes?: number;
  downvotes?: number;
  currentUserVote?: "UPVOTE" | "DOWNVOTE" | null;
}

export interface ActivityVoteSummary {
  activityId: string;
  upvotes: number;
  downvotes: number;
  currentUserVote: "UPVOTE" | "DOWNVOTE" | null;
}

export interface VoteSummary {
  dayPlanId: string;
  dayNumber: number;
  upvotes: number;
  downvotes: number;
  currentUserVote: "UPVOTE" | "DOWNVOTE" | null;
  votingEnabled: boolean;
  votingFrozen: boolean;
  votingDeadline?: string;
}

export interface TripPage {
  content: Trip[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

interface RawTrip {
  id: string;
  title: string;
  description?: string;
  destination: string;
  coverImageUrl?: string;
  startDate?: string;
  endDate?: string;
  createdBy: string;
  status: "DRAFT" | "PLANNED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  maxParticipants?: number;
  currentUserStatus?: string | null;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface RawParticipant {
  id: string;
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER" | "MEMBER";
  status: "PENDING" | "PENDING_APPROVAL" | "ACCEPTED" | "DECLINED" | "LEFT" | "INVITED";
  joinedAt?: string;
}

interface RawTripDetail extends RawTrip {
  participants?: RawParticipant[];
}

interface RawTripPage {
  trips?: RawTrip[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

function normalizeTrip(raw: RawTrip, participantCount = 0): Trip {
  return {
    tripId: raw.id,
    title: raw.title,
    description: raw.description,
    destination: raw.destination,
    coverImageUrl: raw.coverImageUrl,
    startDate: raw.startDate,
    endDate: raw.endDate,
    organizerId: raw.createdBy,
    status: raw.status,
    visibility: raw.visibility,
    participantCount: raw.memberCount ?? participantCount,
    currentUserStatus: raw.currentUserStatus ?? null,
    hasItinerary: false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function normalizeParticipant(raw: RawParticipant, tripId: string): Participant {
  return {
    participantId: raw.id,
    tripId,
    userId: raw.userId,
    role: raw.role,
    status: raw.status,
    invitedAt: undefined,
    joinedAt: raw.joinedAt,
  };
}

function normalizeTripPage(raw: RawTripPage): TripPage {
  const trips = Array.isArray(raw.trips) ? raw.trips : [];
  return {
    content: trips.map((trip) => normalizeTrip(trip)),
    number: raw.page,
    size: raw.size,
    totalElements: raw.totalElements,
    totalPages: raw.totalPages,
  };
}

function normalizeTripDetail(raw: RawTripDetail): TripDetail {
  const participants = Array.isArray(raw.participants)
    ? raw.participants.map((participant) => normalizeParticipant(participant, raw.id))
    : [];

  return {
    ...normalizeTrip(raw, participants.length),
    participants,
  };
}

export interface CreateTripRequest {
  title: string;
  destination: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  visibility?: string;
  status?: string;
  budgetLevel?: "ECONOMY" | "MODERATE" | "LUXURY";
  coverImageUrl?: string;
}

export const tripsApi = {
  list: async (page = 0, size = 12) =>
    normalizeTripPage(await api.get<RawTripPage>(`/trips?page=${page}&size=${size}`)),
  listPublic: async (page = 0, size = 12) =>
    normalizeTripPage(await requestPublic<RawTripPage>(`/trips/public?page=${page}&size=${size}`)),
  search: async (q: string, page = 0, size = 12) =>
    normalizeTripPage(
      await api.get<RawTripPage>(`/trips?search=${encodeURIComponent(q)}&page=${page}&size=${size}`),
    ),
  get: async (id: string) => normalizeTripDetail(await api.get<RawTripDetail>(`/trips/${id}`)),
  getShared: async (id: string) => normalizeTripDetail(await api.get<RawTripDetail>(`/trips/shared/${id}`)),
  getAccessible: async (id: string) => {
    try {
      return await tripsApi.get(id);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return tripsApi.getShared(id);
      }
      throw error;
    }
  },
  create: async (data: CreateTripRequest) => normalizeTrip(await api.post<RawTrip>("/trips", data), 1),
  update: (id: string, data: Partial<CreateTripRequest>) =>
    api.patch<RawTrip>(`/trips/${id}`, data).then((trip) => normalizeTrip(trip)),
  /** Dedicated trip status lifecycle transition (owner-only). */
  updateStatus: (id: string, status: Trip["status"]) =>
    api.patch<RawTrip>(`/trips/${id}/status`, { status }).then((trip) => normalizeTrip(trip)),
  delete: (id: string) => api.delete<void>(`/trips/${id}`),
};

/* ------------------------------------------------------------------ */
/*  Trip Preferences API                                               */
/* ------------------------------------------------------------------ */

export type TripType =
  | "BEACH"
  | "MOUNTAIN"
  | "CITY"
  | "NATURE"
  | "ADVENTURE"
  | "CULTURE";

export type BudgetTier = "ECONOMY" | "MODERATE" | "LUXURY";

export type PreferredWeather = "WARM" | "MILD" | "COLD" | "ANY";

/** Preference fields captured at trip creation and used by the AI service. */
export interface TripPreferenceInput {
  tripType?: TripType;
  budgetTier?: BudgetTier;
  preferredWeather?: PreferredWeather;
  notes?: string;
}

export interface TripPreference extends TripPreferenceInput {
  preferenceId: string;
  userId: string;
  tripId: string;
  createdAt?: string;
  updatedAt?: string;
}

/** True when at least one preference field has a value worth persisting. */
export function hasTripPreferences(input: TripPreferenceInput): boolean {
  return Boolean(
    input.tripType || input.budgetTier || input.preferredWeather || input.notes?.trim(),
  );
}

export const preferencesApi = {
  save: (tripId: string, data: TripPreferenceInput) =>
    api.post<TripPreference>("/users/trip-preferences", { tripId, ...data }),
  getForTrip: (tripId: string) =>
    api.get<TripPreference>(`/users/trip-preferences/${tripId}`),
};

/* ------------------------------------------------------------------ */
/*  AI Itinerary Recommendations (local Ollama)                        */
/* ------------------------------------------------------------------ */

export interface RecommendationOption {
  id: string;
  vibe: string;
  title: string;
  startTime?: string;
  endTime?: string;
  cost?: number;
  currency?: string;
  mapsUrl?: string;
  notes?: string;
  location?: string;
}

export interface DayRecommendations {
  dayNumber: number;
  options: RecommendationOption[];
}

export interface RecommendationResponse {
  tripId?: string;
  model?: string;
  source?: string;
  generatedAt?: string;
  days: DayRecommendations[];
}

export interface RecommendationInput {
  tripId?: string;
  destination: string;
  days: number;
  /** When set, regenerate suggestions for only this day. */
  dayNumber?: number;
  preferences?: TripPreferenceInput;
  existingItinerary?: {
    dayNumber: number;
    title?: string;
    activities: { time?: string; title: string; estimatedCost?: string }[];
  }[];
}

export const recommendationsApi = {
  /** Generate AI itinerary suggestions via the local Ollama proxy route. */
  async generate(input: RecommendationInput): Promise<RecommendationResponse> {
    const token = getAccessToken();
    const res = await fetch("/api/ai/recommendations", {
      method: "POST",
      headers: token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`AI recommendations failed (${res.status})`);
    }
    return res.json() as Promise<RecommendationResponse>;
  },

  /** Fetch the previously stored recommendations for a trip (empty days if none). */
  async getStored(tripId: string): Promise<RecommendationResponse> {
    const token = getAccessToken();
    const res = await fetch(`/api/ai/recommendations/${tripId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      throw new Error(`Fetching recommendations failed (${res.status})`);
    }
    return res.json() as Promise<RecommendationResponse>;
  },
};

/* ------------------------------------------------------------------ */
/*  Trip cover images (local model prompt + text-to-image)             */
/* ------------------------------------------------------------------ */

export interface TripImageResult {
  tripId?: string;
  imageUrl: string | null;
  prompt?: string;
  model?: string;
  source?: string;
  status?: string;
}

export interface TripImageInput {
  tripId: string;
  destination: string;
  preferences?: TripPreferenceInput;
}

export const tripImageApi = {
  /** Generate a cover image URL for a trip via the AI proxy route. */
  async generate(input: TripImageInput): Promise<TripImageResult> {
    const token = getAccessToken();
    const res = await fetch("/api/ai/trip-images", {
      method: "POST",
      headers: token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      throw new Error(`Trip image generation failed (${res.status})`);
    }
    return res.json() as Promise<TripImageResult>;
  },
};

/**
 * Generate a cover image for a trip and persist it onto the trip. Safe to call
 * fire-and-forget: it runs in the background and a failed persist (e.g. a viewer
 * without edit rights) is swallowed. Returns the image URL, or null if disabled.
 */
export async function ensureTripCoverImage(
  tripId: string,
  destination: string,
  preferences?: TripPreferenceInput,
): Promise<string | null> {
  const result = await tripImageApi.generate({ tripId, destination, preferences });
  if (!result.imageUrl) return null;
  try {
    await tripsApi.update(tripId, { coverImageUrl: result.imageUrl });
  } catch {
    // Non-owners can't persist; the URL is still usable for the current session.
  }
  return result.imageUrl;
}

/* ------------------------------------------------------------------ */
/*  Participants API                                                    */
/* ------------------------------------------------------------------ */

export const participantsApi = {
  invite: (tripId: string, userId: string, email?: string, message?: string, inviterName?: string) =>
    api.post<{ message: string; participant?: unknown }>(`/trips/${tripId}/participants/invite`, { userId, email, message, inviterName }),
  inviteByEmail: (tripId: string, email: string, message?: string, inviterName?: string) =>
    api.post<{ message: string; participant?: unknown }>(`/trips/${tripId}/participants/invite-by-email`, { email, message, inviterName }),
  approve: (tripId: string, userId: string) =>
    api.post<{ message: string }>(`/trips/${tripId}/participants/approve`, { userId }),
  reject: (tripId: string, userId: string) =>
    api.post<{ message: string }>(`/trips/${tripId}/participants/reject`, { userId }),
  accept: (tripId: string) =>
    api.post<{ message: string }>(`/trips/${tripId}/participants/accept`, {}),
  decline: (tripId: string) =>
    api.post<{ message: string }>(`/trips/${tripId}/participants/decline`, {}),
  requestJoin: (tripId: string, requesterName?: string, message?: string) =>
    api.post<{ message: string }>(`/trips/${tripId}/participants/request-join`, { requesterName, message }),
  kick: (tripId: string, userId: string) =>
    api.delete<{ message: string }>(`/trips/${tripId}/participants/kick/${userId}`),
};

/* ------------------------------------------------------------------ */
/*  Itinerary API                                                      */
/* ------------------------------------------------------------------ */

interface RawDayPlanResponse {
  dayPlanId: string;
  dayNumber: number;
  date?: string;
  title?: string;
  activities: Array<{
    activityId: string;
    title: string;
    description?: string;
    location?: string;
    startTime?: string;
    endTime?: string;
    category?: string;
    notes?: string;
    estimatedCost?: number | string;
    currency?: string;
    orderIndex: number;
    upvotes?: number;
    downvotes?: number;
    currentUserVote?: string;
  }>;
  votingEnabled: boolean;
  votingFrozen: boolean;
  votingDeadline?: string;
  upvotes: number;
  downvotes: number;
  currentUserVote?: string;
}

interface RawItineraryResponse {
  tripId: string;
  dayPlans: RawDayPlanResponse[];
  createdAt?: string;
  updatedAt?: string;
}

function normalizeItinerary(raw: RawItineraryResponse): { days: DayPlan[]; createdAt?: string; updatedAt?: string } {
  return {
    days: (raw.dayPlans ?? []).map((dp) => ({
      dayPlanId: dp.dayPlanId,
      dayNumber: dp.dayNumber,
      date: dp.date,
      title: dp.title,
      activities: (dp.activities ?? []).map((a) => ({
        activityId: a.activityId,
        title: a.title,
        description: a.description ?? a.notes,
        location: a.location,
        category: a.category?.toLowerCase(),
        startTime: a.startTime,
        endTime: a.endTime,
        time: a.startTime && a.endTime ? `${a.startTime} - ${a.endTime}` : a.startTime || "",
        estimatedCost: a.estimatedCost != null && a.estimatedCost !== "" ? String(a.estimatedCost) : "",
        currency: a.currency ?? undefined,
        upvotes: a.upvotes ?? 0,
        downvotes: a.downvotes ?? 0,
        currentUserVote: a.currentUserVote as "UPVOTE" | "DOWNVOTE" | null,
      })),
      votingEnabled: dp.votingEnabled,
      votingFrozen: dp.votingFrozen,
      votingDeadline: dp.votingDeadline,
      upvotes: dp.upvotes,
      downvotes: dp.downvotes,
      currentUserVote: dp.currentUserVote as "UPVOTE" | "DOWNVOTE" | null,
    })),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export interface UpdateItineraryRequest {
  dayPlans: Array<{
    dayNumber: number;
    date?: string;
    title?: string;
    activities: Array<{
      title: string;
      description?: string;
      location?: string;
      startTime?: string;
      endTime?: string;
      category: string;
      notes?: string;
      estimatedCost?: number;
      currency?: string;
    }>;
  }>;
}

export const itineraryApi = {
  get: async (tripId: string) =>
    normalizeItinerary(await api.get<RawItineraryResponse>(`/trips/${tripId}/itinerary`)),
  getShared: async (tripId: string) =>
    normalizeItinerary(await api.get<RawItineraryResponse>(`/trips/shared/${tripId}/itinerary`)),
  getAccessible: async (tripId: string) => {
    try {
      return await itineraryApi.get(tripId);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return itineraryApi.getShared(tripId);
      }
      throw error;
    }
  },
  update: async (tripId: string, data: UpdateItineraryRequest) =>
    normalizeItinerary(await api.put<RawItineraryResponse>(`/trips/${tripId}/itinerary`, data)),
  castVote: (tripId: string, dayNumber: number, voteType: "UPVOTE" | "DOWNVOTE") =>
    api.post<VoteSummary>(`/trips/${tripId}/itinerary/days/${dayNumber}/vote`, { voteType }),
  removeVote: (tripId: string, dayNumber: number) =>
    api.delete<VoteSummary>(`/trips/${tripId}/itinerary/days/${dayNumber}/vote`),
  getVoteSummary: (tripId: string, dayNumber: number) =>
    api.get<VoteSummary>(`/trips/${tripId}/itinerary/days/${dayNumber}/votes`),
  updateVotingSettings: (tripId: string, votingEnabled: boolean, votingDeadline?: string) =>
    api.put<VoteSummary[]>(`/trips/${tripId}/itinerary/voting-settings`, {
      votingEnabled,
      votingDeadline: votingDeadline ?? null,
    }),
  castActivityVote: (tripId: string, activityId: string, voteType: "UPVOTE" | "DOWNVOTE") =>
    api.post<ActivityVoteSummary>(`/trips/${tripId}/itinerary/activities/${activityId}/vote`, { voteType }),
  removeActivityVote: (tripId: string, activityId: string) =>
    api.delete<ActivityVoteSummary>(`/trips/${tripId}/itinerary/activities/${activityId}/vote`),
};

/* ------------------------------------------------------------------ */
/*  Activity Comments API                                              */
/* ------------------------------------------------------------------ */

export interface ActivityComment {
  id: string;
  activityId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export const commentsApi = {
  list: (tripId: string, activityId: string) =>
    api.get<ActivityComment[]>(`/trips/${tripId}/activities/${activityId}/comments`),
  add: (tripId: string, activityId: string, content: string) =>
    api.post<ActivityComment>(`/trips/${tripId}/activities/${activityId}/comments`, { content }),
  delete: (tripId: string, activityId: string, commentId: string) =>
    api.delete<void>(`/trips/${tripId}/activities/${activityId}/comments/${commentId}`),
};

/* ------------------------------------------------------------------ */
/*  Users API                                                          */
/* ------------------------------------------------------------------ */

export interface UserPublicProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  country?: string;
  email?: string;
}

export const usersApi = {
  /** Fetch public profiles for a batch of user IDs */
  batchProfiles: async (userIds: string[]): Promise<UserPublicProfile[]> => {
    if (userIds.length === 0) return [];
    return api.post<UserPublicProfile[]>("/users/batch", userIds);
  },
  /** Search users by name or email */
  search: async (query: string, limit = 10): Promise<UserPublicProfile[]> => {
    if (!query || query.trim().length < 2) return [];
    return api.get<UserPublicProfile[]>(`/users/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  },
};

/* ------------------------------------------------------------------ */
/*  Notification API                                                   */
/* ------------------------------------------------------------------ */

export interface Notification {
  id: string;
  notificationId?: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  body?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationPage {
  content: Notification[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export const notificationsApi = {
  list: (page = 0, size = 10) =>
    api.get<NotificationPage>(`/notifications?page=${page}&size=${size}`),
  unreadCount: async () => {
    const data = await api.get<{ count?: number; unreadCount?: number }>("/notifications/unread-count");
    return { count: data.count ?? data.unreadCount ?? 0 };
  },
  markRead: (id: string) => api.patch<void>(`/notifications/${id}/read`),
  markAllRead: () => api.patch<void>("/notifications/read-all"),
  deleteNotification: (id: string) => api.delete<void>(`/notifications/${id}`),
};

/* ------------------------------------------------------------------ */
/*  Payment API                                                        */
/* ------------------------------------------------------------------ */

export interface SubscriptionInfo {
  subscriptionId: string;
  plan: "FREE" | "PREMIUM" | "ENTERPRISE";
  status: "ACTIVE" | "CANCELLED" | "PAST_DUE" | "TRIALING";
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  priceAmount?: number;
  currency?: string;
}

export interface PaymentMethod {
  paymentMethodId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface TransactionRecord {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  type: string;
  status: string;
  description: string;
  createdAt: string;
}

export const paymentsApi = {
  getSubscription: () => api.get<SubscriptionInfo>("/payments/subscription"),
  checkout: (planId: string, paymentMethodId: string) =>
    api.post<{ transactionId: string; status: string }>("/payments/checkout", {
      planId,
      paymentMethodId,
    }),
  cancelSubscription: (cancelImmediately = false) =>
    api.post<SubscriptionInfo>("/payments/subscription/cancel", { cancelImmediately }),
  getMethods: () => api.get<PaymentMethod[]>("/payments/methods"),
  addMethod: (data: { brand: string; last4: string; expiryMonth: number; expiryYear: number; setAsDefault?: boolean }) =>
    api.post<PaymentMethod>("/payments/methods", data),
  deleteMethod: (id: string) => api.delete<void>(`/payments/methods/${id}`),
  getTransactions: async () => {
    const subscription = await api.get<SubscriptionInfo | null>("/payments/subscription").catch(() => null);
    if (!subscription || subscription.plan === "FREE") {
      return [];
    }

    return [
      {
        transactionId: subscription.subscriptionId,
        userId: subscription.subscriptionId,
        amount: subscription.priceAmount ?? 0,
        currency: subscription.currency ?? "EUR",
        type: "SUBSCRIPTION",
        status: subscription.status,
        description: `${subscription.plan} subscription`,
        createdAt: subscription.currentPeriodStart ?? new Date().toISOString(),
      },
    ] satisfies TransactionRecord[];
  },
};

/* ------------------------------------------------------------------ */
/*  Chat API                                                           */
/* ------------------------------------------------------------------ */

export interface ChatMessage {
  id: string;
  senderId: string;
  senderDisplayName?: string;
  type: "TEXT" | "IMAGE" | "FILE" | "SYSTEM";
  content: string;
  attachment?: {
    attachmentId: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    contentType: string;
    thumbnailUrl?: string;
  };
  createdAt: string;
  edited: boolean;
}

export interface ChatMessagePage {
  messages: ChatMessage[];
  page: number;
  size: number;
  totalMessages: number;
  hasMore: boolean;
}

export const chatApi = {
  getMessages: (tripId: string, page = 0, size = 50) =>
    api.get<ChatMessagePage>(`/trips/${tripId}/chat/messages?page=${page}&size=${size}`),
  sendMessage: (tripId: string, content: string) =>
    api.post<ChatMessage>(`/trips/${tripId}/chat/messages`, { content }),
  uploadFile: async (tripId: string, file: File): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE_URL}/trips/${tripId}/chat/messages/file`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => ({})));
    return res.json();
  },
  getParticipants: (tripId: string) =>
    api.get<string[]>(`/chats/${tripId}/participants`),
};

/* ------------------------------------------------------------------ */
/*  Chat Moderation (ADMIN only)                                       */
/* ------------------------------------------------------------------ */

/**
 * Ticket 4.4 — Chat Moderation REST API. All endpoints require ADMIN role
 * (enforced by the chat-service Spring Security chain via X-User-Role header).
 * Pass {@code durationMinutes: 0} to apply the maximum 30-day ban/mute.
 */
export const moderationApi = {
  banUser: (userId: string, durationMinutes = 0) =>
    api.post<void>(`/admin/chat/users/${userId}/ban?durationMinutes=${durationMinutes}`, {}),
  unbanUser: (userId: string) =>
    api.delete<void>(`/admin/chat/users/${userId}/ban`),
  muteUser: (userId: string, durationMinutes = 0) =>
    api.post<void>(`/admin/chat/users/${userId}/mute?durationMinutes=${durationMinutes}`, {}),
  unmuteUser: (userId: string) =>
    api.delete<void>(`/admin/chat/users/${userId}/mute`),
  deleteMessage: (messageId: string) =>
    api.delete<void>(`/admin/chat/messages/${messageId}`),
};
