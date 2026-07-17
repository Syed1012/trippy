import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/routes";

export default function ImprintPage() {
  redirect(ROUTES.impressum);
}
