import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-black text-foreground">About Trippy</h1>
      <p className="mt-4 text-muted leading-7">
        Trippy is a collaborative trip planning platform that helps groups plan itineraries,
        coordinate logistics, and explore destinations with AI-assisted suggestions.
      </p>
      <p className="mt-4 text-muted leading-7">
        Build your trip step by step, invite your travel companions, and keep everyone aligned
        from planning to departure.
      </p>
      <div className="mt-8">
        <Link href={ROUTES.home} className="text-trippy-500 hover:text-trippy-600 font-medium">
          Back to home
        </Link>
      </div>
    </main>
  );
}
