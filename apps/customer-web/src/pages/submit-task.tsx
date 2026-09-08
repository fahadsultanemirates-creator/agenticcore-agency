import { useState } from 'react';
import { useLocation } from 'wouter';
import { useSubmitAgencyTask, getListAgencyTasksQueryKey, getGetAgencyCustomerStatsQueryKey, getGetAgencyAuthMeQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { Loader2, Zap, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

const SERVICES = [
  // ── Core services ──────────────────────────────────────────────────────
  { value: 'feasibility',           label: 'Feasibility Study',        desc: 'Market size, competition & viability analysis',      cost: 1, category: 'Strategy' },
  { value: 'deep_analysis',         label: 'Deep Analysis',             desc: 'In-depth research & strategy using Gemini 2.5 Pro',  cost: 4, category: 'Strategy' },
  { value: 'marketing_strategy',    label: 'Marketing Strategy',        desc: 'Full go-to-market plan, personas, 90-day roadmap',   cost: 4, category: 'Strategy' },
  // ── Web & Code ─────────────────────────────────────────────────────────
  { value: 'website',               label: 'Website Build',             desc: 'Multi-page website with nav, auth & responsive design', cost: 5, category: 'Web & Code' },
  { value: 'site_audit',            label: 'Site Audit',                desc: 'Performance, UX, SEO & accessibility review',       cost: 3, category: 'Web & Code' },
  { value: 'smart_contract',        label: 'Smart Contract',            desc: 'Solidity contract (ERC-20, NFT, DeFi, DAO) + deploy script', cost: 6, category: 'Web & Code' },
  { value: 'analytics',             label: 'Analytics Setup',           desc: 'GA4, event tracking, conversion goals & KPI dashboard', cost: 2, category: 'Web & Code' },
  // ── Marketing & Social ─────────────────────────────────────────────────
  { value: 'social_media_strategy', label: 'Social Media Strategy',     desc: '30-day content calendar, platform plan & hashtags', cost: 3, category: 'Marketing' },
  { value: 'social_media',          label: 'Social Media Posts',        desc: 'Ready-to-post captions, ad copy & campaign ideas',  cost: 2, category: 'Marketing' },
  { value: 'marketing',             label: 'Marketing Campaign',        desc: 'Ad copy, creatives & audience targeting plan',      cost: 3, category: 'Marketing' },
  { value: 'seo',                   label: 'SEO Strategy',              desc: 'Keyword research, meta tags & on-page optimisation', cost: 2, category: 'Marketing' },
  // ── Content & Copy ─────────────────────────────────────────────────────
  { value: 'pdf_report',            label: 'PDF Report / Proposal',     desc: 'Professional formatted report ready for printing',  cost: 3, category: 'Content' },
  { value: 'business_card',         label: 'Business Card Design',      desc: 'Print-ready card (front & back) at 3.5×2 inch',    cost: 2, category: 'Content' },
  { value: 'letterhead',            label: 'Letterhead Template',        desc: 'Branded A4 letterhead with sample letter body',    cost: 2, category: 'Content' },
  // ── Finance & Legal ────────────────────────────────────────────────────
  { value: 'bookkeeping',           label: 'Bookkeeping',               desc: 'Expense categorisation, P&L & budget analysis',    cost: 2, category: 'Finance & Legal' },
  { value: 'legal',                 label: 'Legal Documents',           desc: 'Contracts, T&Cs, privacy policies & compliance',   cost: 3, category: 'Finance & Legal' },
  // ── Media ──────────────────────────────────────────────────────────────
  { value: 'image',                 label: 'AI Imagery',                desc: 'Brand visuals & illustrations via Ideogram AI',     cost: 1, category: 'Media' },
  { value: 'video',                 label: 'AI Video',                  desc: 'Explainers & promos via Google Veo',                cost: 3, category: 'Media' },
  // ── General ────────────────────────────────────────────────────────────
  { value: 'general',               label: 'General Task',              desc: 'Any other business task for our AI agents',        cost: 1, category: 'General' },
];

export default function SubmitTask() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { customer } = useAuth();

  const [serviceType, setServiceType] = useState('');
  const [brief, setBrief] = useState('');
  const [error, setError] = useState('');

  const selected = SERVICES.find((s) => s.value === serviceType);
  const creditBalance = customer?.creditBalance ?? 0;
  const canAfford = selected ? creditBalance >= selected.cost : true;

  const { mutate, isPending } = useSubmitAgencyTask({
    mutation: {
      onSuccess: (task) => {
        queryClient.invalidateQueries({ queryKey: getListAgencyTasksQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgencyCustomerStatsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgencyAuthMeQueryKey() });
        navigate(`/tasks/${task.id}`);
      },
      onError: (err: unknown) => {
        const e = err as { data?: { error?: string } };
        setError(e?.data?.error ?? 'Failed to submit task. Please try again.');
      },
    },
  });

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError('');
    if (!serviceType) { setError('Please select a service type.'); return; }
    if (brief.trim().length < 20) { setError('Please provide a brief of at least 20 characters.'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutate({ data: { serviceType: serviceType as any, brief: brief.trim() } });
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard">
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </span>
          </Link>
          <h1 className="text-2xl font-bold">Submit New Task</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Describe your task and let our AI agents handle it.
          </p>
        </div>

        {/* Credit balance */}
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-400/5 border border-amber-400/20 text-amber-400 text-sm mb-6">
          <Zap className="w-4 h-4" />
          <span>You have <strong>{creditBalance}</strong> credit{creditBalance !== 1 ? 's' : ''} available.</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Service selection — grouped by category */}
          <div className="space-y-5">
            <label className="block text-sm font-medium">Service Type *</label>
            {Array.from(new Set(SERVICES.map((s) => s.category))).map((cat) => (
              <div key={cat}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">{cat}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICES.filter((s) => s.category === cat).map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setServiceType(s.value)}
                      className={`text-left p-4 rounded-xl border transition-all ${
                        serviceType === s.value
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-card hover:border-primary/40 text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm">{s.label}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          serviceType === s.value ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {s.cost} cr
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Brief */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Task Brief *
              <span className="text-muted-foreground font-normal ml-2">
                ({brief.length}/2000 chars, min 20)
              </span>
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              required
              rows={6}
              maxLength={2000}
              placeholder={`Describe your task in detail. The more context you provide, the better the result.\n\nExample: "Build a landing page for a B2B SaaS product called Flowly. It tracks team workflows. Target audience is startup founders. Modern, dark theme, with a hero section, feature highlights, pricing, and contact form."`}
              className="w-full px-4 py-3 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none text-sm leading-relaxed"
            />
          </div>

          {/* Cost preview */}
          {selected && (
            <div className={`px-4 py-3 rounded-xl border text-sm ${
              canAfford
                ? 'bg-emerald-400/5 border-emerald-400/20 text-emerald-400'
                : 'bg-destructive/5 border-destructive/20 text-destructive'
            }`}>
              {canAfford
                ? `This task costs ${selected.cost} credit${selected.cost !== 1 ? 's' : ''}. You'll have ${creditBalance - selected.cost} remaining.`
                : `Insufficient credits. This task costs ${selected.cost} credits but you only have ${creditBalance}. Contact support to get more.`}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending || !canAfford}
            className="w-full py-3.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-base"
          >
            {isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Submitting…
              </>
            ) : (
              <>Submit Task ({selected?.cost ?? '?'} cr)</>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
