import { Link } from 'wouter';
import {
  useGetAgencyCustomerStats,
  getGetAgencyCustomerStatsQueryKey,
  useListAgencyTasks,
  getListAgencyTasksQueryKey,
} from '@workspace/api-client-react';
import { DashboardLayout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import {
  Zap,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_STYLES: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Clock },
  processing: { label: 'Processing', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: Loader2 },
  done: { label: 'Done', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: AlertCircle },
};

const SERVICE_LABELS: Record<string, string> = {
  feasibility: 'Feasibility Study',
  website: 'Website Build',
  social_media: 'Social Media',
  marketing: 'Marketing',
  bookkeeping: 'Bookkeeping',
  legal: 'Legal Docs',
  seo: 'SEO Audit',
  image: 'AI Imagery',
  video: 'AI Video',
  deep_analysis: 'Deep Analysis',
  site_audit: 'Site Audit',
  general: 'General',
};

export default function Dashboard() {
  const { customer } = useAuth();

  const { data: statsData, isLoading: statsLoading } = useGetAgencyCustomerStats({
    query: { queryKey: getGetAgencyCustomerStatsQueryKey(), refetchInterval: 30_000 },
  });

  const { data: tasksData, isLoading: tasksLoading } = useListAgencyTasks(
    { status: 'all' },
    { query: { queryKey: getListAgencyTasksQueryKey({ status: 'all' }), refetchInterval: 15_000 } },
  );

  const tasks = tasksData?.tasks ?? [];
  const recentTasks = [...tasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  ).slice(0, 5);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              Welcome back, {customer?.fullName.split(' ')[0]}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Here's what's happening with your AI tasks.
            </p>
          </div>
          <Link href="/submit">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 text-sm">
              <PlusCircle className="w-4 h-4" />
              New Task
            </span>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Credits
            </div>
            <div className="text-3xl font-black">
              {statsLoading ? '…' : statsData?.creditBalance ?? customer?.creditBalance}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Total Tasks
            </div>
            <div className="text-3xl font-black">
              {statsLoading ? '…' : statsData?.totalTasks ?? 0}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Completed
            </div>
            <div className="text-3xl font-black">
              {statsLoading ? '…' : statsData?.tasksByStatus?.done ?? 0}
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Loader2 className="w-4 h-4 text-blue-400" />
              In Progress
            </div>
            <div className="text-3xl font-black">
              {statsLoading
                ? '…'
                : ((statsData?.tasksByStatus?.pending ?? 0) + (statsData?.tasksByStatus?.processing ?? 0))}
            </div>
          </div>
        </div>

        {/* Recent Tasks */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-bold">Recent Tasks</h2>
            {tasks.length > 5 && (
              <Link href="/dashboard">
                <span className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            )}
          </div>

          {tasksLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading tasks…
            </div>
          ) : recentTasks.length === 0 ? (
            <div className="text-center py-16">
              <PlusCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm mb-4">No tasks yet. Submit your first one!</p>
              <Link href="/submit">
                <span className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-all text-sm">
                  <PlusCircle className="w-4 h-4" /> Submit Task
                </span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTasks.map((task) => {
                const s = STATUS_STYLES[task.status] ?? STATUS_STYLES.pending;
                const Icon = s.icon;
                return (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <div className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-all cursor-pointer">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`p-2 rounded-lg border ${s.color}`}>
                          <Icon className={`w-4 h-4 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">
                            {SERVICE_LABELS[task.serviceType] ?? task.serviceType}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {task.brief.slice(0, 80)}{task.brief.length > 80 ? '…' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 ml-4">
                        <span className={`hidden sm:block px-2.5 py-1 text-xs font-medium rounded-full border ${s.color}`}>
                          {s.label}
                        </span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                        </span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
