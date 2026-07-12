"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  Crown,
  Loader2,
  CreditCard,
  Plus,
  Trash2,
  Sparkles,
  Building2,
  Zap,
  ShieldCheck,
  Info,
  AlertTriangle,
  X,
  CalendarDays,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { GlassCard, Button, Badge } from "@/components/ui";
import { paymentsApi, ApiError, type SubscriptionInfo, type PaymentMethod, type TransactionRecord } from "@/lib/api";
import { useToast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// --- Types & Constants ---
interface PlanInfo {
  id: string;
  planId: string;
  name: string;
  price: number;
  interval: string;
  icon: any;
  features: string[];
  highlight?: boolean;
}

const PLANS: PlanInfo[] = [
  { id: "free", planId: "FREE", name: "Free", price: 0, interval: "forever", icon: Zap, features: ["Up to 3 trips", "Basic itinerary", "Trip chat", "5 AI generations/month"] },
  { id: "premium", planId: "PREMIUM", name: "Premium", price: 9.99, interval: "month", icon: Crown, highlight: true, features: ["Unlimited trips", "AI itineraries", "50 AI generations/month", "Priority support"] },
  { id: "pro", planId: "ENTERPRISE", name: "Pro", price: 29.99, interval: "month", icon: Building2, features: ["Everything in Premium", "Unlimited AI", "Team management", "API access"] },
];

const PAYMENTS_CACHE_KEY = "trippy-payments-cache";

type PaymentsCache = {
  subscription: SubscriptionInfo | null;
  methods: PaymentMethod[];
  transactions: TransactionRecord[];
};

function readPaymentsCache(): PaymentsCache | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(PAYMENTS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as PaymentsCache) : null;
  } catch {
    return null;
  }
}

function writePaymentsCache(cache: PaymentsCache) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(PAYMENTS_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage failures so the page still works.
  }
}

// --- Sub-Component: Input with Clear Button ---
const InputWithClear = ({ placeholder, value, onChange, maxLength, className, type = "text" }: any) => (
  <div className="relative w-full group">
    <input
      type={type}
      placeholder={placeholder}
      maxLength={maxLength}
      value={value}
      onChange={onChange}
      className={cn("w-full glass-sm px-4 py-2 pr-10 rounded-lg text-sm outline-none border border-transparent focus:border-trippy-500/50 transition-all font-mono", className)}
      required
    />
    <AnimatePresence>
      {value.length > 0 && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          type="button"
          onClick={() => onChange({ target: { value: "" } })}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={14} />
        </motion.button>
      )}
    </AnimatePresence>
  </div>
);

// --- Modal Component ---
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, description, confirmText, variant = "default", isLoading = false, secondOptionText = "", onSecondOption = null }: any) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md overflow-hidden rounded-2xl border bg-card p-6 shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn("p-2 rounded-full", variant === "danger" ? "bg-red-500/10 text-red-500" : "bg-trippy-500/10 text-trippy-500")}>
              {variant === "danger" ? <AlertTriangle size={24} /> : <Sparkles size={24} />}
            </div>
            <h3 className="text-xl font-bold">{title}</h3>
          </div>
          <p className="text-muted-foreground mb-6 leading-relaxed text-sm">{description}</p>
          <div className="flex flex-col gap-2">
            <Button className={cn("w-full", variant === "danger" ? "bg-red-500 hover:bg-red-600 text-white" : "")} onClick={onConfirm} disabled={isLoading}>
              {isLoading ? <Loader2 className="animate-spin" size={18} /> : confirmText}
            </Button>
            {onSecondOption && (
                <Button variant="secondary" className="w-full" onClick={onSecondOption} disabled={isLoading}>
                    {secondOptionText}
                </Button>
            )}
            <Button variant="ghost" className="w-full" onClick={onClose} disabled={isLoading}>Cancel</Button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export default function PaymentPage() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);
  const [modalConfig, setModalConfig] = useState<{ type: 'cancel' | 'upgrade' | null, data?: any }>({ type: null });
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [formData, setFormData] = useState({ number: "", expiryMonth: "", expiryYear: "", brand: "visa" });

  useEffect(() => {
    const cached = readPaymentsCache();
    if (cached) {
      setSubscription(cached.subscription);
      setMethods(cached.methods);
      setTransactions(cached.transactions);
      setLoading(false);
    }

    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [sub, meth, txns] = await Promise.all([
        paymentsApi.getSubscription().catch(() => null),
        paymentsApi.getMethods().catch(() => []),
        paymentsApi.getTransactions().catch(() => []),
      ]);

      const nextCache: PaymentsCache = {
        subscription: sub ?? null,
        methods: meth ?? [],
        transactions: txns ?? [],
      };

      setSubscription(nextCache.subscription);
      setMethods(nextCache.methods);
      setTransactions(nextCache.transactions);
      writePaymentsCache(nextCache);
    } catch {
      const cached = readPaymentsCache();
      if (cached) {
        setSubscription(cached.subscription);
        setMethods(cached.methods);
        setTransactions(cached.transactions);
      }
    } finally {
      setLoading(false);
    }
  }

  const activePaidPlan = subscription && subscription.plan && subscription.plan !== "FREE" ? subscription.plan.toUpperCase() : "FREE";

  const handleNumberChange = (val: string) => {
    let clean = val.replace(/\D/g, "").slice(0, 16);
    let brand = "visa";
    if (clean.startsWith("4")) brand = "visa";
    else if (/^5[1-5]/.test(clean)) brand = "mastercard";
    setFormData({ ...formData, number: clean, brand });
  };

  async function handleAddCard(e: React.FormEvent) {
    e.preventDefault();
    setIsActionLoading(true);
    try {
      const method = await paymentsApi.addMethod({
        brand: formData.brand,
        last4: formData.number.slice(-4),
        expiryMonth: parseInt(formData.expiryMonth),
        expiryYear: parseInt(formData.expiryYear),
        setAsDefault: true,
      });
      setMethods([...methods, method]);
      setShowAddCard(false);
      setFormData({ number: "", expiryMonth: "", expiryYear: "", brand: "visa" });
      addToast("Card added successfully", "success");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleDeleteMethod(id: string) {
    try {
      await paymentsApi.deleteMethod(id);
      setMethods(methods.filter(m => m.paymentMethodId !== id));
      addToast("Card deleted", "success");
    } catch (e) {
      addToast("Error deleting card", "error");
    }
  }

  async function handleSelectPlan(plan: PlanInfo) {
    if (plan.planId === "FREE") {
      addToast("You are already on the free plan", "info");
      return;
    }

    const selectedMethod = methods.find((m) => m.isDefault) ?? methods[0];
    if (!selectedMethod) {
      addToast("Please add a payment method before upgrading", "error");
      setShowAddCard(true);
      return;
    }

    setCheckoutLoading(plan.planId);
    try {
      await paymentsApi.checkout(plan.planId, selectedMethod.paymentMethodId);
      await loadData();
      addToast("Plan upgraded successfully", "success");
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to complete checkout";
      addToast(message, "error");
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleCancelSubscription() {
    setIsActionLoading(true);
    try {
      await paymentsApi.cancelSubscription(false);
      await loadData();
      addToast("Plan will expire soon", "info");
    } finally {
      setIsActionLoading(false);
      setModalConfig({ type: null });
    }
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-trippy-500" size={32} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-10 px-4 pb-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
        <p className="text-muted-foreground text-sm">Manage your workspace subscription and invoicing.</p>
      </motion.div>

      {/* Subscription Status */}
      {subscription && subscription.plan !== "FREE" && (
        <GlassCard className={cn("border-l-4", subscription.cancelAtPeriodEnd ? "border-l-yellow-500 bg-yellow-500/5" : "border-l-trippy-500 bg-trippy-500/5")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("p-2 rounded-full text-white shadow-sm", subscription.cancelAtPeriodEnd ? "bg-yellow-500" : "bg-trippy-500")}>
                {subscription.cancelAtPeriodEnd ? <AlertTriangle size={20}/> : <ShieldCheck size={20}/>}
              </div>
              <div>
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <span>{subscription.plan} Plan</span>
                  <Badge variant={subscription.cancelAtPeriodEnd ? "default" : "success"}>
                    {subscription.cancelAtPeriodEnd ? "Ending Soon" : "Active"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {subscription.cancelAtPeriodEnd ? `Valid until ${subscription.currentPeriodEnd}` : `Renews on ${subscription.currentPeriodEnd}`}
                </p>
              </div>
            </div>
            {!subscription.cancelAtPeriodEnd && (
              <Button variant="ghost" className="text-destructive text-xs h-8 hover:bg-destructive/10" onClick={() => setModalConfig({ type: 'cancel' })}>Cancel Plan</Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = activePaidPlan === plan.planId.toUpperCase();
          const isProcessing = checkoutLoading === plan.planId;
          return (
            <motion.div key={plan.id} whileHover={{ y: -5 }}>
              <GlassCard className={cn("h-full flex flex-col relative transition-all", plan.highlight && "ring-2 ring-trippy-500/50 shadow-lg")}>
                {plan.highlight && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-trippy-500 text-white border-none shadow-md">Best Value</Badge>}
                <div className="mb-6">
                  <plan.icon className="text-trippy-500 mb-4" size={28} />
                  <h3 className="font-bold text-xl">{plan.name}</h3>
                  <p className="text-2xl font-black mt-2">€{plan.price}<span className="text-xs font-normal text-muted-foreground">/{plan.interval}</span></p>
                </div>
                <ul className="flex-1 space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex gap-2 text-xs text-muted-foreground"><Check size={14} className="text-success shrink-0" /> {f}</li>
                  ))}
                </ul>
                <Button className="w-full" variant={isCurrent ? "secondary" : "primary"} disabled={isCurrent || isProcessing} onClick={() => handleSelectPlan(plan)}>
                  {isProcessing ? <Loader2 className="animate-spin" /> : isCurrent ? "Current Plan" : "Select Plan"}
                </Button>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><CreditCard size={20} className="text-trippy-500"/> Payment Methods</h2>
            {showAddCard && (
               <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0 hover:bg-muted" onClick={() => setShowAddCard(false)}>
                  <X size={18} />
               </Button>
            )}
          </div>
          
          <div className="space-y-3">
            <LayoutGroup>
              <AnimatePresence mode="popLayout">
                {!showAddCard && methods.map((m) => (
                  <motion.div key={m.paymentMethodId} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <GlassCard className="flex items-center gap-4 p-4 group border-none shadow-sm bg-muted/20">
                      <div className="p-2 bg-background rounded-lg border shadow-sm"><CreditCard size={18} className="text-muted-foreground"/></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold uppercase">{m.brand} •••• {m.last4}</p>
                        <p className="text-[10px] text-muted-foreground">Expires {m.expiryMonth}/{m.expiryYear}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-destructive h-8 w-8 p-0" onClick={() => handleDeleteMethod(m.paymentMethodId)}><Trash2 size={14} /></Button>
                    </GlassCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </LayoutGroup>

            {showAddCard ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                {/* Visual Card Preview h-48 */}
                <div className="h-48 w-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white shadow-2xl relative overflow-hidden mb-6 border border-white/10">
                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-14 h-10 bg-yellow-500/80 rounded-lg shadow-inner" />
                    <span className="text-xl font-bold italic uppercase tracking-tighter">{formData.brand || 'Card'}</span>
                  </div>
                  <p className="text-2xl tracking-[0.15em] font-mono mt-10 relative z-10 text-center">
                    {formData.number.padEnd(16, "•").replace(/(.{4})/g, "$1 ").trim() || "•••• •••• •••• ••••"}
                  </p>
                  <div className="mt-8 flex justify-between relative z-10 opacity-70">
                    <div className="text-[10px] uppercase font-mono tracking-widest">{formData.expiryMonth || "MM"}/{formData.expiryYear.slice(-2) || "YY"}</div>
                    <ShieldCheck size={18} />
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-trippy-500/10 rounded-full blur-3xl pointer-events-none" />
                </div>
                
                <form onSubmit={handleAddCard} className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 mb-1 block">Card Number</label>
                      <InputWithClear 
                        placeholder="0000 0000 0000 0000" 
                        value={formData.number} 
                        onChange={(e: any) => handleNumberChange(e.target.value)} 
                        maxLength={16}
                      />
                    </div>
                    <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 mb-1 block">Month</label>
                          <InputWithClear placeholder="MM" value={formData.expiryMonth} onChange={(e: any) => setFormData({...formData, expiryMonth: e.target.value.replace(/\D/g, "")})} maxLength={2} />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1 mb-1 block">Year</label>
                          <InputWithClear placeholder="YYYY" value={formData.expiryYear} onChange={(e: any) => setFormData({...formData, expiryYear: e.target.value.replace(/\D/g, "")})} maxLength={4} />
                        </div>
                    </div>
                    <Button className="w-full h-10 text-sm font-bold" type="submit" disabled={isActionLoading}>
                        {isActionLoading ? <Loader2 size={16} className="animate-spin" /> : "Verify & Save Card"}
                    </Button>
                </form>
              </motion.div>
            ) : (
                <Button variant="secondary" className="w-full h-12 border-dashed text-xs gap-2 hover:bg-muted/50" onClick={() => setShowAddCard(true)}>
                    <Plus size={14} /> Add Payment Method
                </Button>
            )}
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Info size={20} className="text-trippy-500"/> Billing History</h2>
          <GlassCard className="p-0 overflow-hidden bg-muted/10 border-none shadow-inner">
            <table className="w-full text-xs">
                <thead className="bg-muted/50 text-[10px] uppercase font-bold text-muted-foreground tracking-widest text-left">
                    <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4 text-right">Amount</th>
                        <th className="px-6 py-4 text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/20 text-foreground">
                    {transactions.length > 0 ? transactions.map(tx => (
                        <tr key={tx.transactionId} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-medium">{new Date(tx.createdAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4">{tx.description}</td>
                            <td className="px-6 py-4 text-right font-bold">€{tx.amount}</td>
                            <td className="px-6 py-4 text-center">
                                <Badge variant={tx.status === "COMPLETED" ? "success" : "default"} className="text-[9px] px-2 py-0">{tx.status === "COMPLETED" ? "Paid" : tx.status}</Badge>
                            </td>
                        </tr>
                    )) : (
                        <tr><td className="px-6 py-12 text-center text-muted-foreground" colSpan={4}><CalendarDays size={24} className="mx-auto mb-2 opacity-20" /> No payments yet.</td></tr>
                    )}
                </tbody>
            </table>
          </GlassCard>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={modalConfig.type === 'cancel'}
        onClose={() => setModalConfig({ type: null })}
        onConfirm={handleCancelSubscription}
        isLoading={isActionLoading}
        variant="danger"
        title="Cancel Subscription"
        description="Your premium benefits will remain active until the end of your billing cycle. You won't be charged again."
        confirmText="Confirm Cancellation"
      />
    </div>
  );
}