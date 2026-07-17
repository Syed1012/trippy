import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 py-16">
      <h1 className="text-3xl font-black text-foreground">Forgot your password?</h1>
      <p className="mt-4 text-muted leading-7">
        Password reset is not available in this build yet. Please contact support or use your
        existing login credentials.
      </p>
      <div className="mt-8 flex gap-5">
        <Link href={ROUTES.login} className="text-trippy-500 hover:text-trippy-600 font-medium">
          Back to login
        </Link>
        <Link href={ROUTES.home} className="text-trippy-500 hover:text-trippy-600 font-medium">
          Go to home
        </Link>
      </div>
    </main>
  );
}
