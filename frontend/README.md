# Trippy Frontend

Next.js 16 · React 19 · Tailwind CSS 4 · Framer Motion

## Getting Started

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint check
```

## Project Structure

```
frontend/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx       # Root layout (fonts, theme flash-prevention)
│   ├── page.tsx         # Landing / homepage
│   ├── globals.css      # Design tokens, dark mode, typography scale
│   ├── login/           # Login page
│   ├── register/        # Registration page
│   └── dashboard/       # Authenticated dashboard
├── components/
│   ├── ui/              # Reusable primitives (Button, Input, GlassCard, Badge, Avatar, ThemeToggle)
│   ├── layout/          # Navbar, Footer
│   ├── trips/           # Trip-specific components (TripCard, CreateTripModal)
│   └── ai/              # AI feature components
├── lib/
│   ├── api.ts           # API client (auth, request helpers, token management)
│   ├── useTheme.ts      # Theme hook (light/dark via CSS variables + localStorage)
│   └── utils.ts         # cn() class-name merge helper
└── public/              # Static assets
```

## How to Extend the Frontend

### Adding a New Page

1. **Public page** — create a folder under `app/`, e.g. `app/how-it-works/page.tsx` (see `about/`, `privacy/`, `terms/` for existing examples). It inherits only the root `app/layout.tsx` (fonts, theme flash-prevention).
2. **Authenticated page** — create it under `app/dashboard/`, e.g. `app/dashboard/trips/[id]/page.tsx`. Anything nested under `dashboard/` automatically inherits `app/dashboard/layout.tsx`, which wraps it in `ProtectedRoute` (redirects unauthenticated users) plus the shell (`Navbar`, ambient background, right-rail providers) — no manual wiring needed.

### Using UI Primitives

Import from the barrel export:

```tsx
import { Button, Input, GlassCard, Badge, Avatar, ThemeToggle } from "@/components/ui";
```

### Theme & Dark Mode

- CSS custom properties are defined in `globals.css` under `:root` (light) and `[data-theme="dark"]`
- Use `useTheme()` from `@/lib/useTheme` to read/toggle the theme
- All colour utilities (`bg-trippy-500`, `text-accent-600`, etc.) auto-switch with the theme
- Flash of wrong theme is prevented by an inline script in `layout.tsx`

### Design Tokens

| Token | Light | Usage |
|-------|-------|-------|
| `--trippy-500` | `#3e9b7e` | Primary brand |
| `--accent-500` | `#fc7a36` | CTA / vibrancy |
| `--background` | `#fdfcf9` | Page background |
| `--foreground` | `#1c2a24` | Body text |
| `--surface` | `rgba(255,255,255,0.75)` | Glass cards |

### Typography

Headings (`h1`–`h6`) and body text utilities (`.text-body`, `.text-body-sm`, `.text-caption`) are
defined in `globals.css` via `@layer base` with responsive breakpoints.

### API Integration

Use the typed API client in `lib/api.ts`:

```tsx
import { api } from "@/lib/api";

const trips = await api.get<Trip[]>("/trips");
await api.post("/trips", { title: "My Trip", ... });
```