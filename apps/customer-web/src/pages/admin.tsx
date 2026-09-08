import { useState } from 'react';
import {
  useGetAgencyAdminStats,
  useAgencyAdminListCustomers,
  useAgencyAdminListTasks,
  useAgencyAdminAdjustCredits,
  getGetAgencyAdminStatsQueryKey,
  getAgencyAdminListCustomersQueryKey,
  getAgencyAdminListTasksQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Users,
  ListTodo,
  Zap,
  Search,
  Loader2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SERVICE_LABELS: Record<string, string> = {
  feasibility: 'Feasibility',
  website: 'Website',
  social_media: 'Social Media',
  marketing: 'Marketing',
  bookkeeping: 'Bookkeeping',
  legal: 'Legal',
  seo: 'SEO',
  image: 'Image',
  video: 'Video',
  deep_analysis: 'Deep Analysis',
  site_audit: 'Site Audit',
  general: 'General',
};

// ── Admin panel — key passed via props, never persisted ─────────────────────
function AdminPanel({ adminKey }: { adminKey: string }) {
  const [tab, setTab] = useState<'overview' | 'customers' | 'tasks'>('overview');
  const [search, setSearch] = useState('');
  const [taskStatus, setTaskStatus] = useState('all');
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustDesc, setAdjustDesc] = useState('');
  const queryClient = useQueryClient();

  // All admin requests carry the key as a custom header. The key stays in
  // React component state only — it is never written to sessionStorage,
  // localStorage, cookies, or any other persistent store.
  const reqHeaders = { 'x-agency-admin-key': adminKey };

  const { data: stats, isLoading: statsLoading } = useGetAgencyAdminStats({
    query: { queryKey: getGetAgencyAdminStatsQueryKey() },
    request: { headers: reqHeaders },
  });

  const { data: customersData, isLoading: customersLoading } = useAgencyAdminListCustomers(
    { search: search || undefined },
    {
      query: { queryKey: getAgencyAdminListCustomersQueryKey({ search: search || undefined }) },
      request: { headers: reqHeaders },
    },
  );

  const { data: tasksData, isLoading: tasksLoading } = useAgencyAdminListTasks(
    { status: taskStatus as 'all' | 'pending' | 'processing' | 'done' | 'failed' },
    {
      query: { queryKey: getAgencyAdminListTasksQueryKey({ status: taskStatus as 'all' | 'pending' | 'processing' | 'done' | 'failed' }) },
      request: { headers: reqHeaders },
    },
  );

  const { mutate: adjustCredits, isPending: adjusting } = useAgencyAdminAdjustCredits({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getAgencyAdminListCustomersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAgencyAdminStatsQueryKey() });
        setAdjustingId(null);
        setAdjustAmount('');
        setAdjustDesc('');
      },
    },
    request: { headers: reqHeaders },
  });

  function handleAdjust(customerId: number) {
    const amount = Number(adjustAmount);
    if (!amount || !adjustDesc) return;
    adjustCredits({ customerId, data: { amount, description: adjustDesc } });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card/40 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <span className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </span>
            </Link>
            <span className="text-lg font-black gradient-text">AGENTICCORE</span>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 font-medium">
              Admin
            </span>
          </div>
          <div className="flex gap-1">
            {(['overview', 'customers', 'tasks'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all capitalize ${
                  tab === t
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Overview tab */}
        {tab === 'overview' && (
          <div>
            <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
            {statsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading stats…
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <Users className="w-4 h-4" /> Customers
                  </div>
                  <div className="text-3xl font-black">{stats?.totalCustomers ?? 0}</div>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <ListTodo className="w-4 h-4" /> Total Tasks
                  </div>
                  <div className="text-3xl font-black">{stats?.totalTasks ?? 0}</div>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed
                  </div>
                  <div className="text-3xl font-black">{stats?.tasksByStatus?.done ?? 0}</div>
                </div>
                <div className="p-5 rounded-2xl bg-card border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <Zap className="w-4 h-4 text-amber-400" /> Credits Issued
                  </div>
                  <div className="text-3xl font-black">{stats?.totalCreditsIssued ?? 0}</div>
                </div>
              </div>
            )}

            {stats && (
              <div className="mt-8 p-6 rounded-2xl bg-card border border-border">
                <h2 className="font-bold mb-4">Task Status Breakdown</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { key: 'pending', label: 'Pending', color: 'text-amber-400', icon: Clock },
                    { key: 'processing', label: 'Processing', color: 'text-blue-400', icon: Loader2 },
                    { key: 'done', label: 'Done', color: 'text-emerald-400', icon: CheckCircle2 },
                    { key: 'failed', label: 'Failed', color: 'text-red-400', icon: AlertCircle },
                  ].map((s) => {
                    const count = stats.tasksByStatus?.[s.key as keyof typeof stats.tasksByStatus] ?? 0;
                    const pct = stats.totalTasks
                      ? Math.round((count / stats.totalTasks) * 100)
                      : 0;
                    return (
                      <div key={s.key}>
                        <div className={`text-2xl font-black ${s.color}`}>{count}</div>
                        <div className="text-sm text-muted-foreground">
                          {s.label} ({pct}%)
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customers tab */}
        {tab === 'customers' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">Customers</h1>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="pl-9 pr-4 py-2 text-sm rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 w-64"
                />
              </div>
            </div>

            {customersLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Customer
                      </th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                        Company
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Credits
                      </th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(customersData?.customers ?? []).map((c) => (
                      <>
                        <tr key={c.id} className="hover:bg-muted/20 transition-all">
                          <td className="px-4 py-3">
                            <div className="font-medium">{c.fullName}</div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {c.company ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="inline-flex items-center gap-1 font-bold">
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              {c.creditBalance}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() =>
                                setAdjustingId(adjustingId === c.id ? null : c.id)
                              }
                              className="text-xs px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg hover:bg-primary/20 transition-all font-medium"
                            >
                              Adjust Credits
                            </button>
                          </td>
                        </tr>
                        {adjustingId === c.id && (
                          <tr key={`${c.id}-adjust`} className="bg-muted/30">
                            <td colSpan={4} className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <input
                                  type="number"
                                  value={adjustAmount}
                                  onChange={(e) => setAdjustAmount(e.target.value)}
                                  placeholder="Amount (+ or -)"
                                  className="w-36 px-3 py-1.5 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                                <input
                                  type="text"
                                  value={adjustDesc}
                                  onChange={(e) => setAdjustDesc(e.target.value)}
                                  placeholder="Reason / description"
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                />
                                <button
                                  onClick={() => handleAdjust(c.id)}
                                  disabled={adjusting}
                                  className="px-4 py-1.5 text-sm bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center gap-1"
                                >
                                  {adjusting ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : Number(adjustAmount) >= 0 ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  Apply
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                    {(customersData?.customers ?? []).length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          No customers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tasks tab */}
        {tab === 'tasks' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-bold">All Tasks</h1>
              <select
                value={taskStatus}
                onChange={(e) => setTaskStatus(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {tasksLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-2">
                {(tasksData?.tasks ?? []).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{task.id}
                        </span>
                        <span className="font-semibold text-sm">
                          {SERVICE_LABELS[task.serviceType] ?? task.serviceType}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            task.status === 'done'
                              ? 'bg-emerald-400/10 text-emerald-400'
                              : task.status === 'processing'
                                ? 'bg-blue-400/10 text-blue-400'
                                : task.status === 'failed'
                                  ? 'bg-red-400/10 text-red-400'
                                  : 'bg-amber-400/10 text-amber-400'
                          }`}
                        >
                          {task.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {task.brief.slice(0, 100)}
                        {task.brief.length > 100 ? '…' : ''}
                      </p>
                      {task.customerEmail && (
                        <p className="text-xs text-primary mt-1">{task.customerEmail}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
                {(tasksData?.tasks ?? []).length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No tasks found.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Key gate: key stored only in React state, never persisted ────────────────
function AdminKeyGate() {
  const [adminKey, setAdminKey] = useState('');
  const [input, setInput] = useState('');

  if (adminKey) {
    return <AdminPanel adminKey={adminKey} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background bg-grid">
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-black gradient-text tracking-tight">
            AGENTICCORE
          </span>
          <p className="text-muted-foreground mt-2">Admin Access</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAdminKey(input);
          }}
          className="glass rounded-2xl p-8 space-y-5"
        >
          <p className="text-sm text-muted-foreground">
            Enter your admin key to continue. The key is kept only in memory and
            cleared when you close or reload the page.
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">Admin Key</label>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
              className="w-full px-4 py-2.5 rounded-lg bg-input border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all"
          >
            Enter Admin Panel
          </button>
          <p className="text-center">
            <Link href="/dashboard">
              <span className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to dashboard
              </span>
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function Admin() {
  return <AdminKeyGate />;
}
