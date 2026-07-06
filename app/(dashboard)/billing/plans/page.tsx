"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MetricCard, MetricGrid } from "@/components/digit/metric-card"
import { toast } from "sonner"
import { Check, Gift, Percent, Ticket, Sparkles, AlertTriangle, BarChart3, Timer } from "lucide-react"

interface OrgTrial {
  orgId: string
  planId: string
  startedAt: string
  expiresAt: string
  status: 'active' | 'expired' | 'converted' | 'cancelled'
  daysRemaining: number
}

interface FoundingPlan {
  id: string
  name: string
  discountPercent: number
  validUntil: string
  maxSeats: number
  features: string[]
}

interface TrialAnalytics {
  activeTrials: number
  expiringSoon: number
  conversionRate: number
}

const REGULAR_PLANS = [
  { name: 'Starter', price: 2999, features: ['Basic analytics', '10 documents/mo', 'Email support'] },
  { name: 'Professional', price: 9999, features: ['Advanced analytics', 'Unlimited documents', 'AI-powered insights', 'Priority support', 'API access'] },
  { name: 'Enterprise', price: 29999, features: ['Everything in Pro', 'Custom integrations', 'Dedicated manager', 'SLA guarantee', 'Advanced security', 'On-premise option'] },
]

function formatPrice(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BillingPlansPage() {
  const [trial, setTrial] = useState<OrgTrial | null>(null)
  const [foundingPlans, setFoundingPlans] = useState<FoundingPlan[]>([])
  const [analytics, setAnalytics] = useState<TrialAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [discountCode, setDiscountCode] = useState('')
  const [discountValid, setDiscountValid] = useState<boolean | null>(null)
  const [discountValue, setDiscountValue] = useState<number | null>(null)
  const [discountReason, setDiscountReason] = useState('')
  const [applyingDiscount, setApplyingDiscount] = useState(false)
  const [startingTrial, setStartingTrial] = useState(false)

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [trialRes, discountRes] = await Promise.all([
          fetch('/api/v1/billing/trials'),
          fetch('/api/v1/billing/discounts'),
        ]);
        
        if (cancelled) return;
        
        if (!trialRes.ok || !discountRes.ok) {
          const errorData1 = await trialRes.json();
          const errorData2 = await discountRes.json();
          throw new Error(
            errorData1.error || errorData2.error || "Failed to load billing data"
          );
        }
        
        const trialData = await trialRes.json();
        const discountData = await discountRes.json();
        
        if (!cancelled) {
          setTrial(trialData.trial);
          setFoundingPlans(discountData.foundingPlans || []);
          setAnalytics(discountData.analytics || null);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error instanceof Error ? error.message : "Failed to load billing data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleStartTrial(planId: string) {
    setStartingTrial(true);
    try {
      const res = await fetch('/api/v1/billing/trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to start trial');
      }
      
      const data = await res.json();
      setTrial(data.trial);
      toast.success('Trial started successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start trial');
    } finally {
      setStartingTrial(false);
    }
  }

  async function handleApplyDiscount() {
    if (!discountCode.trim()) {
      toast.error("Please enter a discount code");
      return;
    }
    
    setApplyingDiscount(true);
    setDiscountValid(null);
    setDiscountValue(null);
    setDiscountReason('');
    
    try {
      const res = await fetch('/api/v1/billing/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim(), plan: trial?.planId || '' }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to validate discount code');
      }
      
      const data = await res.json();
      if (data.valid) {
        setDiscountValid(true);
        setDiscountValue(data.discount);
        toast.success(`Discount applied! ${data.discount}% off`);
      } else {
        setDiscountValid(false);
        setDiscountReason(data.reason || 'Invalid code');
        toast.error(data.reason || 'Invalid discount code');
      }
    } catch (error) {
      setDiscountValid(false);
      setDiscountReason(error.message || 'Failed to validate code');
      toast.error(error.message || 'Failed to validate discount code');
    } finally {
      setApplyingDiscount(false);
    }
  }

  const discountAmount = (price: number): number => {
    if (discountValid && discountValue) {
      return Math.round(price * (1 - discountValue / 100))
    }
    return price
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plans</h1>
        <p className="text-muted-foreground">Manage your subscription, trials, and discounts</p>
      </div>

      {trial && trial.status === 'active' && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Timer className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle className="text-lg">Free Trial Active</CardTitle>
                  <CardDescription>
                    {trial.daysRemaining > 0
                      ? `${trial.daysRemaining} day${trial.daysRemaining !== 1 ? 's' : ''} remaining`
                      : 'Expiring today'}
                  </CardDescription>
                </div>
              </div>
              <Button>
                <Sparkles className="mr-2 h-4 w-4" />
                Upgrade Now
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check className="h-4 w-4 text-emerald-500" />
              Started {formatDate(trial.startedAt)} &middot; Expires {formatDate(trial.expiresAt)}
            </div>
          </CardContent>
        </Card>
      )}

      {foundingPlans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {foundingPlans.map((plan) => {
            const expired = new Date(plan.validUntil) < new Date()
            return (
              <Card key={plan.id} className={expired ? 'opacity-50' : 'border-primary/30'}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{plan.name}</CardTitle>
                        {!expired && (
                          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                            <Percent className="mr-1 h-3 w-3" />
                            {plan.discountPercent}% OFF
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        <div className="flex items-center gap-1 mt-1">
                          <Gift className="h-3 w-3" />
                          {expired ? 'Expired' : `Valid until ${formatDate(plan.validUntil)}`}
                        </div>
                      </CardDescription>
                    </div>
                    {!expired && (
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{plan.discountPercent}%</div>
                        <div className="text-xs text-muted-foreground">discount</div>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  {!expired && (
                    <Button className="w-full" onClick={() => toast.success('Founding plan claim initiated')}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Claim Founding Plan
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Discount Code
          </CardTitle>
          <CardDescription>Enter a promo or founder discount code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Enter discount code"
                value={discountCode}
                onChange={(e) => { setDiscountCode(e.target.value); setDiscountValid(null); setDiscountValue(null); setDiscountReason('') }}
                className={discountValid === true ? 'border-emerald-500' : discountValid === false ? 'border-red-500' : ''}
              />
              {discountValid === true && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4 text-emerald-500" />
                </div>
              )}
            </div>
            <Button onClick={handleApplyDiscount} disabled={applyingDiscount || !discountCode.trim()}>
              {applyingDiscount ? 'Applying...' : 'Apply'}
            </Button>
          </div>
          {discountValid === false && discountReason && (
            <p className="mt-2 text-sm text-red-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {discountReason}
            </p>
          )}
          {discountValid === true && discountValue && (
            <p className="mt-2 text-sm text-emerald-500 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {discountValue}% discount applied to eligible plans
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Comparison</CardTitle>
          <CardDescription>Regular vs founding vs discounted pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plan</TableHead>
                <TableHead>Regular Price</TableHead>
                <TableHead>Founding Price</TableHead>
                <TableHead>Your Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REGULAR_PLANS.map((plan) => {
                const foundingPlan = foundingPlans.find(fp =>
                  fp.name.toLowerCase().includes(plan.name.toLowerCase())
                )
                const foundingPrice = foundingPlan
                  ? Math.round(plan.price * (1 - foundingPlan.discountPercent / 100))
                  : plan.price
                const discountedPrice = discountAmount(plan.price)
                const effectivePrice = discountValid ? discountedPrice : plan.price
                return (
                  <TableRow key={plan.name}>
                    <TableCell className="font-medium">{plan.name}</TableCell>
                    <TableCell>{formatPrice(plan.price)}<span className="text-xs text-muted-foreground">/mo</span></TableCell>
                    <TableCell>
                      {foundingPlan ? (
                        <span className="text-emerald-500 font-medium">
                          {formatPrice(foundingPrice)}
                          <span className="text-xs text-muted-foreground">/mo</span>
                          <Badge variant="outline" className="ml-2 text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/30">
                            -{foundingPlan.discountPercent}%
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {effectivePrice !== plan.price ? (
                        <span className="text-primary font-bold">
                          {formatPrice(effectivePrice)}
                          <span className="text-xs text-muted-foreground">/mo</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!trial && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Start Free Trial
            </CardTitle>
            <CardDescription>Try any plan free for 14 days</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Pro Trial</CardTitle>
                <CardDescription>14 days free &middot; 10 users</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm mb-4">
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Unlimited documents</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> AI-powered analysis</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Real-time monitoring</li>
                </ul>
                <Button className="w-full" onClick={() => handleStartTrial('pro-trial')} disabled={startingTrial}>
                  {startingTrial ? 'Starting...' : 'Start Pro Trial'}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Enterprise Trial</CardTitle>
                <CardDescription>30 days free &middot; 50 users</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm mb-4">
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Everything in Pro</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Custom integrations</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Dedicated account manager</li>
                </ul>
                <Button className="w-full" onClick={() => handleStartTrial('enterprise-trial')} disabled={startingTrial}>
                  {startingTrial ? 'Starting...' : 'Start Enterprise Trial'}
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Trial Analytics (Admin)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MetricGrid columns={3}>
              <MetricCard label="Active Trials" value={analytics.activeTrials} trend="up" change={12} />
              <MetricCard label="Expiring Soon" value={analytics.expiringSoon} trend={analytics.expiringSoon > 3 ? 'down' : 'stable'} />
              <MetricCard label="Conversion Rate" value={`${analytics.conversionRate}%`} trend={analytics.conversionRate > 50 ? 'up' : 'down'} change={5} />
            </MetricGrid>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
