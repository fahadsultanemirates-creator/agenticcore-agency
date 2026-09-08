import { useRoute, Link } from 'wouter';
import { useGetAgencyTask, getGetAgencyTaskQueryKey } from '@workspace/api-client-react';
import { DashboardLayout } from '@/components/layout';
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Zap,
  Bot,
  FileText,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock; description: string }> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10 border-amber-400/20',
    icon: Clock,
    description: 'Your task is queued and will start processing shortly.',
  },
  processing: {
    label: 'Processing',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10 border-blue-400/20',
    icon: Loader2,
    description: 'AI agents are working on your task. This may take a few minutes.',
  },
  done: {
    label: 'Completed',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10 border-emerald-400/20',
    icon: CheckCircle2,
    description: 'Your task has been completed. See the deliverable below.',
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-400/10 border-red-400/20',
    icon: AlertCircle,
    description: 'The task encountered an error. Please contact support.',
  },
};

const SERVICE_LABELS: Record<string, string> = {
  feasibility: 'Feasibility Study',
  website: 'Website Build',
  social_media: 'Social Media',
  marketing: 'Marketing Campaign',
  bookkeeping: 'Bookkeeping',
  legal: 'Legal Docs',
  seo: 'SEO Audit',
  image: 'AI Imagery',
  video: 'AI Video',
  deep_analysis: 'Deep Analysis',
  site_audit: 'Site Audit',
  general: 'General',
};

export default function TaskDetail() {
  const [, params] = useRoute('/tasks/:id');
  const taskId = Number(params?.id);

  const { data: task, isLoading, error } = useGetAgencyTask(taskId, {
    query: {
      queryKey: getGetAgencyTaskQueryKey(taskId),
      refetchInterval: (query) => {
        const status = (query.state.data as { status?: string } | undefined)?.status;
        if (status === 'pending' || status === 'processing') return 5_000;
        return false;
      },
    },
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !task) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto text-center py-20">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">Task not found.</p>
          <Link href="/dashboard">
            <span className="text-primary hover:underline text-sm">← Back to dashboard</span>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto">
        <Link href="/dashboard">
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </span>
        </Link>

        {/* Task header */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl font-bold">{SERVICE_LABELS[task.serviceType] ?? task.serviceType}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Task #{task.id} · Submitted {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
            </p>
          </div>
          <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-full border ${cfg.bg} ${cfg.color}`}>
            <Icon className={`w-4 h-4 ${task.status === 'processing' ? 'animate-spin' : ''}`} />
            {cfg.label}
          </span>
        </div>

        {/* Status card */}
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border mb-6 ${cfg.bg}`}>
          <Icon className={`w-4 h-4 mt-0.5 ${cfg.color} ${task.status === 'processing' ? 'animate-spin' : ''}`} />
          <p className={`text-sm ${cfg.color}`}>{cfg.description}</p>
        </div>

        {/* Brief */}
        <div className="bg-card border border-border rounded-2xl p-6 mb-6">
          <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
            <FileText className="w-4 h-4 text-muted-foreground" /> Your Brief
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{task.brief}</p>
        </div>

        {/* Agents used */}
        {task.agentsUsed && task.agentsUsed.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <Bot className="w-4 h-4 text-muted-foreground" /> Agents Involved
            </h3>
            <div className="flex flex-wrap gap-2">
              {task.agentsUsed.map((agent) => (
                <span key={agent} className="px-3 py-1 text-xs bg-primary/10 border border-primary/20 text-primary rounded-full">
                  {agent}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {task.result && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="flex items-center gap-2 font-semibold mb-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Deliverable
            </h3>
            <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {task.result}
            </div>
          </div>
        )}

        {/* Images */}
        {task.imageUrls && task.imageUrls.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
              <ImageIcon className="w-4 h-4 text-muted-foreground" /> Generated Images
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {task.imageUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt={`Generated image ${i + 1}`} className="rounded-lg border border-border w-full hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Videos */}
        {task.videoUrls && task.videoUrls.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-6 mb-6">
            <h3 className="flex items-center gap-2 font-semibold mb-4 text-sm">
              <Video className="w-4 h-4 text-muted-foreground" /> Generated Videos
            </h3>
            <div className="space-y-3">
              {task.videoUrls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary hover:underline text-sm">
                  <Video className="w-4 h-4" /> Video {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="font-semibold mb-4 text-sm">Task Details</h3>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Task ID</p>
              <p className="font-medium">#{task.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Credits Used</p>
              <p className="font-medium flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> {task.creditCost}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Submitted</p>
              <p className="font-medium">{format(new Date(task.createdAt), 'MMM d, yyyy HH:mm')}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Last Updated</p>
              <p className="font-medium">{format(new Date(task.updatedAt), 'MMM d, yyyy HH:mm')}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
