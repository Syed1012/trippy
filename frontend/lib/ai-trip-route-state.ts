const KEY_PREFIX = "trippy_ai_trip_state:";

interface StoredState<T> {
  createdAt: number;
  state: T;
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveAiTripRouteState<T>(state: T): string {
  if (!canUseSessionStorage() && !canUseLocalStorage()) {
    return "";
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload: StoredState<T> = {
    createdAt: Date.now(),
    state,
  };

  if (canUseLocalStorage()) {
    window.localStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(payload));
  }
  if (canUseSessionStorage()) {
    window.sessionStorage.setItem(`${KEY_PREFIX}${id}`, JSON.stringify(payload));
  }
  return id;
}

export function loadAiTripRouteState<T>(id: string): T | null {
  if ((!canUseSessionStorage() && !canUseLocalStorage()) || !id) {
    return null;
  }

  const sessionRaw = canUseSessionStorage()
    ? window.sessionStorage.getItem(`${KEY_PREFIX}${id}`)
    : null;
  const localRaw = canUseLocalStorage()
    ? window.localStorage.getItem(`${KEY_PREFIX}${id}`)
    : null;
  const raw = sessionRaw ?? localRaw;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredState<T>;
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

export function updateAiTripRouteState<T>(id: string, state: T, savedTripId?: string): void {
  if ((!canUseSessionStorage() && !canUseLocalStorage()) || !id) {
    return;
  }
  const key = `${KEY_PREFIX}${id}`;
  const sessionRaw = canUseSessionStorage() ? window.sessionStorage.getItem(key) : null;
  const localRaw = canUseLocalStorage() ? window.localStorage.getItem(key) : null;
  const raw = sessionRaw ?? localRaw;
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as StoredState<any>;
    parsed.state = {
      ...parsed.state,
      trip: state,
    };
    if (savedTripId) {
      parsed.state.savedTripId = savedTripId;
    }
    if (canUseLocalStorage()) {
      window.localStorage.setItem(key, JSON.stringify(parsed));
    }
    if (canUseSessionStorage()) {
      window.sessionStorage.setItem(key, JSON.stringify(parsed));
    }
  } catch (e) {
    console.error("Failed to update AI trip route state", e);
  }
}

