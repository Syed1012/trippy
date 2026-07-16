"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check, Crown, Loader2, Building2, Zap, ShieldCheck, Info, ExternalLink
} from "lucide-react";
import { GlassCard, Button } from "@/components/ui";
import { paymentsApi, type SubscriptionInfo, type TransactionRecord } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const PLANS = [
  { id: "free", planId: "FREE", name: "Free", price: 0, interval: "forever", icon: Zap,
    features: ["Up to 3 trips", "Basic itinerary", "Trip chat", "5 AI generations/month"] },

  { id: "premium", planId: "PREMIUM", name: "Premium", price: 9.99, interval: "month", icon: Crown, highlight: true,
    features: ["Unlimited trips", "AI itineraries", "50 AI generations/month", "Priority support"] },

  { id: "enterprise", planId: "ENTERPRISE", name: "Enterprise", price: 29.99, interval: "month", icon: Building2,
    features: ["Everything in Premium", "Unlimited AI", "Team management", "API access"] },
];

export default function PaymentPage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("success")) {
      addToast("Payment successful! Your plan is being updated.", "success");
    }
    void loadData();
  }, [searchParams]);

  async function loadData() {
    try {
      const [sub, txns] = await Promise.all([
        paymentsApi.getSubscription().catch(() => null),
        paymentsApi.getTransactions().catch(() => []),
      ]);
      setSubscription(sub);
      setTransactions(txns || []);
    } finally { setLoading(false); }
  }

  const activePlanId = subscription?.plan?.toUpperCase() || "FREE";

  async function handleSelectPlan(plan: any) {
    if (plan.planId === activePlanId) return;

    setCheckoutLoading(plan.planId);
    try {
      const response = await paymentsApi.checkout(plan.planId);
      if (response.url) window.open(response.url, "_blank");
      else throw new Error("No checkout URL received");
    } catch {
      addToast("Failed to initiate checkout. Please try again.", "error");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function openCustomerPortal() {
    setIsActionLoading(true);
    try {
      const response = await paymentsApi.createPortalSession();
      window.location.href = response.url;
    } catch {
      addToast("Could not open billing management", "error");
    } finally {
      setIsActionLoading(false);
    }
  }

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-trippy-500" size={32} />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-10 px-4 pb-20">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
          {/* <p className="text-muted-foreground text-sm">Secure payments powered by Stripe</p> */}
        </div>
      </header>

      {/* Subscription Status */}
      {activePlanId !== "FREE" && subscription && (
        <GlassCard className={cn("border-l-4", subscription.cancelAtPeriodEnd ? "border-l-yellow-500" : "border-l-trippy-500")}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <ShieldCheck className="text-trippy-500" size={32} />
              <div>
                <p className="font-bold">{subscription.plan} Plan Active</p>
                <p className="text-xs text-muted-foreground">
                  {subscription.cancelAtPeriodEnd ? "Reverts to Free on " : "Renews on "} {subscription.currentPeriodEnd}
                </p>
              </div>
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <Button variant="ghost" className="text-destructive text-xs">Cancel Plan</Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <GlassCard key={plan.id} className={cn("relative flex flex-col", plan.highlight && "ring-2 ring-trippy-500")}>
            <div className="mb-6">
              <plan.icon className="text-trippy-500 mb-4" size={28} />
              <h3 className="font-bold text-xl">{plan.name}</h3>
              <p className="text-2xl font-black mt-2">
                €{plan.price}<span className="text-xs font-normal">/{plan.interval}</span>
              </p>
            </div>

            <ul className="flex-1 space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex gap-2 text-xs text-muted-foreground">
                  <Check size={14} className="text-success" /> {f}
                </li>
              ))}
            </ul>

            <Button
              className="w-full"
              variant={activePlanId === plan.planId ? "secondary" : "primary"}
              disabled={activePlanId === plan.planId || checkoutLoading === plan.planId}
              onClick={() => handleSelectPlan(plan)}
            >
              {checkoutLoading === plan.planId
                ? <Loader2 className="animate-spin" />
                : activePlanId === plan.planId
                  ? "Current Plan"
                  : "Upgrade Now"}
            </Button>
          </GlassCard>
        ))}
      </div>

      {/* Billing History */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Info size={20} className="text-trippy-500" /> Billing History
        </h2>
        <GlassCard className="p-0 overflow-hidden bg-muted/10 border-none">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/50 uppercase font-bold text-muted-foreground">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {transactions.map((tx) => (
                <tr key={tx.transactionId} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">{new Date(tx.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{tx.description}</td>
                  <td className="px-6 py-4 text-right font-bold">€{tx.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </div>
  );
}
