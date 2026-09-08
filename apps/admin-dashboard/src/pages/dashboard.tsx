import React, { useState, useEffect } from 'react';
import {
  useGetAgencyAdminStats,
  useAgencyAdminListJobs,
  useAgencyAdminListProjects,
  useAgencyAdminGetProjectFiles,
  useAgencyAdminGetAgentUsage,
  useAgencyAdminListTasks
} from '@workspace/api-client-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_BG: Record<string, string> = {
  queued: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  running: "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse",
  succeeded: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-500 border-rose-500/20",
  pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  processing: "bg-blue-500/10 text-blue-500 border-blue-500/20 animate-pulse",
  done: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
};

function RefreshTimer({ interval }: { interval: number }) {
  const [timeLeft, setTimeLeft] = useState(interval);

  useEffect(() => {
    const update = () => {
      setTimeLeft(prev => {
        if (prev <= 1000) return interval;
        return prev - 1000;
      });
    };
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [interval]);

  return <span className="text-muted-foreground">REFRESH IN {Math.ceil(timeLeft / 1000)}S</span>;
}

export function AdminGate() {
  const [adminKey, setAdminKey] = useState<string>('');
  const [inputKey, setInputKey] = useState('');

  if (!adminKey) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 font-mono">
        <div className="border border-border p-8 bg-card max-w-md w-full relative overflow-hidden flex flex-col gap-6">
          <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
          <h2 className="text-xl font-bold tracking-widest text-center">AGENCY SYSTEM</h2>
          
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground tracking-widest uppercase">AGENCY ADMIN KEY</label>
            <input 
              type="password"
              className="bg-background border border-border px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors font-mono"
              value={inputKey}
              onChange={e => setInputKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') setAdminKey(inputKey);
              }}
              autoFocus
            />
          </div>
          
          <button 
            className="w-full bg-primary text-background font-bold tracking-widest uppercase py-2 hover:opacity-90 transition-opacity"
            onClick={() => setAdminKey(inputKey)}
          >
            UNLOCK
          </button>
        </div>
      </div>
    );
  }

  return <Dashboard adminKey={adminKey} />;
}

export function Dashboard({ adminKey }: { adminKey: string }) {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECTS' | 'JOBS' | 'TASKS'>('OVERVIEW');
  const reqOpts = { request: { headers: { 'x-agency-admin-key': adminKey } } };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6 flex flex-col gap-6 font-mono selection:bg-primary selection:text-primary-foreground">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold tracking-widest text-foreground">AGENTIC.CORE<span className="text-muted-foreground"> // AGENCY</span></h1>
          </div>
          <div className="text-sm uppercase tracking-widest flex items-center gap-4">
            <span className="text-muted-foreground">MULTI-AGENT PLATFORM MONITOR</span>
            <span className="hidden md:inline text-border">|</span>
            <RefreshTimer interval={15000} />
          </div>
        </div>
      </header>

      <div className="flex gap-2 border-b border-border overflow-x-auto pb-[-1px]">
        {(['OVERVIEW', 'PROJECTS', 'JOBS', 'TASKS'] as const).map(tab => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-bold tracking-widest border-b-2 transition-colors ${
              activeTab === tab 
                ? 'border-primary text-foreground' 
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/10'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1">
        {activeTab === 'OVERVIEW' && <OverviewTab reqOpts={reqOpts} />}
        {activeTab === 'PROJECTS' && <ProjectsTab reqOpts={reqOpts} />}
        {activeTab === 'JOBS' && <JobsTab reqOpts={reqOpts} />}
        {activeTab === 'TASKS' && <TasksTab reqOpts={reqOpts} />}
      </div>
    </div>
  );
}

function OverviewTab({ reqOpts }: { reqOpts: any }) {
  const { data: stats } = useGetAgencyAdminStats({ query: { refetchInterval: 15000 }, ...reqOpts });
  const { data: jobsData } = useAgencyAdminListJobs({ limit: 10 }, { query: { refetchInterval: 15000 }, ...reqOpts });
  const { data: usageData } = useAgencyAdminGetAgentUsage({ query: { refetchInterval: 15000 }, ...reqOpts });

  const jobs = jobsData?.jobs || [];
  const agents = usageData?.agents || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="border border-border p-4 flex flex-col gap-1 bg-card">
          <div className="text-xs text-muted-foreground tracking-wider uppercase">Customers</div>
          <div className="text-2xl font-bold">{stats?.totalCustomers ?? '--'}</div>
        </div>
        <div className="border border-border p-4 flex flex-col gap-1 bg-card">
          <div className="text-xs text-muted-foreground tracking-wider uppercase">Total Tasks</div>
          <div className="text-2xl font-bold">{stats?.totalTasks ?? '--'}</div>
        </div>
        <div className="border border-border p-4 flex flex-col gap-1 bg-card">
          <div className="text-xs text-amber-500 tracking-wider uppercase">Pending</div>
          <div className="text-2xl font-bold">{stats?.tasksByStatus.pending ?? '--'}</div>
        </div>
        <div className="border border-border p-4 flex flex-col gap-1 bg-card">
          <div className="text-xs text-blue-500 tracking-wider uppercase">Processing</div>
          <div className="text-2xl font-bold">{stats?.tasksByStatus.processing ?? '--'}</div>
        </div>
        <div className="border border-border p-4 flex flex-col gap-1 bg-card">
          <div className="text-xs text-rose-500 tracking-wider uppercase">Failed</div>
          <div className="text-2xl font-bold">{stats?.tasksByStatus.failed ?? '--'}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="border border-border flex flex-col h-full overflow-hidden bg-card">
          <div className="border-b border-border p-3 px-4 flex justify-between items-center bg-muted/10">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Recent Jobs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 font-normal">CUSTOMER</th>
                  <th className="px-4 py-3 font-normal">STATUS</th>
                  <th className="px-4 py-3 font-normal">AGENTS USED</th>
                  <th className="px-4 py-3 font-normal text-right">AGE</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-xs tracking-widest">NO RECENT JOBS</td>
                  </tr>
                ) : (
                  jobs.map(j => (
                    <tr key={j.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 text-xs">{j.customerRef}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 border ${STATUS_BG[j.status] || ''} uppercase font-bold`}>
                          {j.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={j.requestText.substring(0, 60)}>
                        {j.agentsUsed?.join(', ') || '--'}
                      </td>
                      <td className="px-4 py-3 text-xs text-right text-muted-foreground">
                        {Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 60000)}m
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="border border-border flex flex-col h-full overflow-hidden bg-card">
          <div className="border-b border-border p-3 px-4 flex justify-between items-center bg-muted/10">
            <h2 className="text-sm font-bold tracking-widest uppercase text-muted-foreground">Agent Usage</h2>
          </div>
          <div className="p-4 h-[300px]">
             {agents.length === 0 ? (
               <div className="h-full flex items-center justify-center text-muted-foreground text-xs tracking-widest uppercase">NO DATA</div>
             ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agents} layout="vertical" margin={{ top: 10, right: 20, left: 40, bottom: 10 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#888', fontSize: 11, fontFamily: 'monospace' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip 
                      cursor={{fill: '#222'}} 
                      contentStyle={{ backgroundColor: '#0a0a0a', borderColor: '#222', color: '#e8e8e8', fontFamily: 'monospace', borderRadius: 0 }}
                      itemStyle={{ color: '#6366f1' }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[0, 0, 0, 0]}>
                      {agents.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#4f46e5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JobsTab({ reqOpts }: { reqOpts: any }) {
  const [filter, setFilter] = useState<string>('ALL');
  const params = filter === 'ALL' ? { limit: 100 } : { status: filter.toLowerCase() as any, limit: 100 };
  const { data } = useAgencyAdminListJobs(params, { query: { refetchInterval: 15000 }, ...reqOpts });

  const jobs = data?.jobs || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {['ALL', 'QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-bold tracking-widest border ${
              filter === f ? 'bg-primary text-background border-primary' : 'border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-muted/5">
              <th className="px-4 py-3 font-normal">TIME</th>
              <th className="px-4 py-3 font-normal">CUSTOMER</th>
              <th className="px-4 py-3 font-normal">STATUS</th>
              <th className="px-4 py-3 font-normal">REQUEST</th>
              <th className="px-4 py-3 font-normal">AGENTS USED</th>
              <th className="px-4 py-3 font-normal text-right">DURATION</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs tracking-widest uppercase">NO JOBS MATCHING FILTER</td>
              </tr>
            ) : (
              jobs.map(j => {
                const duration = Math.floor((new Date(j.updatedAt).getTime() - new Date(j.createdAt).getTime()) / 1000);
                const reqText = j.requestText.length > 80 ? j.requestText.substring(0, 80) + '...' : j.requestText;
                
                return (
                  <tr key={j.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleTimeString()}</td>
                    <td className="px-4 py-3 text-xs font-bold">{j.customerRef}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`px-2 py-0.5 border ${STATUS_BG[j.status] || ''} uppercase font-bold`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[300px] truncate" title={j.requestText}>{reqText}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{j.agentsUsed?.join(', ') || '--'}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{duration > 0 ? `${duration}s` : '--'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectFileModal({ file, onClose }: { file: any, onClose: () => void }) {
  if (!file) return null;
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 font-mono">
      <div className="bg-card border border-border flex flex-col w-full max-w-5xl max-h-[90vh] shadow-2xl">
        <div className="border-b border-border p-4 flex justify-between items-center bg-muted/10">
          <h2 className="text-sm font-bold tracking-widest uppercase text-primary truncate pr-4">{file.filename}</h2>
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => { if (file.content) navigator.clipboard.writeText(file.content); }} 
              className="text-xs font-bold tracking-widest border border-border px-3 py-1.5 hover:bg-muted/20 hover:text-foreground transition-colors uppercase"
            >
              COPY
            </button>
            <button 
              onClick={onClose} 
              className="text-xs font-bold tracking-widest border border-border px-3 py-1.5 bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 transition-colors uppercase"
            >
              CLOSE
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 bg-[#080808]">
          <pre className="text-xs whitespace-pre-wrap text-foreground">{file.content || 'No content available.'}</pre>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, reqOpts }: { project: any, reqOpts: any }) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useAgencyAdminGetProjectFiles(project.id, { 
    query: { enabled: expanded, refetchInterval: expanded ? 15000 : false }, 
    ...reqOpts 
  });
  const [selectedFile, setSelectedFile] = useState<any>(null);

  return (
    <div className="border border-border flex flex-col bg-card">
      <div className="p-4 flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <div className="text-xs text-muted-foreground">{project.customerRef}</div>
          <div className="text-xs text-muted-foreground">UPDATED {new Date(project.updatedAt).toLocaleDateString()}</div>
        </div>
        <div className="text-lg font-bold truncate text-foreground">{project.name}</div>
        <div className="flex gap-4 text-xs mt-2">
          <span className="border border-border px-2 py-1 bg-muted/5 text-muted-foreground">{project.fileCount} FILES</span>
          <span className="border border-border px-2 py-1 bg-muted/5 text-muted-foreground">{project.deliverableCount} DELIVERABLES</span>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          {project.deliverableTypes?.map((t: string) => (
            <span key={t} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 uppercase tracking-wider font-bold border border-primary/20">{t}</span>
          ))}
        </div>
      </div>
      
      <button 
        className="border-t border-border p-3 text-xs tracking-widest uppercase font-bold text-left hover:bg-muted/10 transition-colors flex items-center gap-2 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`transform transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span> 
        {expanded ? 'HIDE FILES' : 'VIEW FILES'}
      </button>

      {expanded && (
        <div className="border-t border-border bg-muted/5 flex flex-col">
          {!data ? (
            <div className="p-4 text-xs text-muted-foreground animate-pulse tracking-widest uppercase">LOADING FILES...</div>
          ) : data.files.length === 0 ? (
            <div className="p-4 text-xs text-muted-foreground tracking-widest uppercase">NO FILES</div>
          ) : (
            data.files.map((f: any) => (
              <div 
                key={f.id} 
                className="border-b border-border/50 last:border-0 p-3 hover:bg-muted/10 cursor-pointer flex justify-between items-center group"
                onClick={() => setSelectedFile(f)}
              >
                <div className="flex flex-col gap-1 overflow-hidden">
                  <div className="text-sm font-bold truncate text-foreground group-hover:text-primary transition-colors">{f.filename}</div>
                  <div className="text-xs text-muted-foreground truncate">{f.purpose}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap pl-4">
                  {new Date(f.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {selectedFile && (
        <ProjectFileModal file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
}

function ProjectsTab({ reqOpts }: { reqOpts: any }) {
  const { data } = useAgencyAdminListProjects({ query: { refetchInterval: 15000 }, ...reqOpts });
  const projects = data?.projects || [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.length === 0 ? (
        <div className="col-span-1 md:col-span-2 text-center py-12 text-muted-foreground tracking-widest uppercase border border-border bg-card">
          NO PROJECTS FOUND
        </div>
      ) : (
        projects.map((p: any) => <ProjectCard key={p.id} project={p} reqOpts={reqOpts} />)
      )}
    </div>
  );
}

function TasksTab({ reqOpts }: { reqOpts: any }) {
  const [filter, setFilter] = useState<string>('ALL');
  const params = filter === 'ALL' ? {} : { status: filter.toLowerCase() as any };
  const { data } = useAgencyAdminListTasks(params, { query: { refetchInterval: 15000 }, ...reqOpts });

  const tasks = data?.tasks || [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {['ALL', 'PENDING', 'PROCESSING', 'DONE', 'FAILED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs font-bold tracking-widest border ${
              filter === f ? 'bg-primary text-background border-primary' : 'border-border text-muted-foreground hover:bg-muted/10 hover:text-foreground'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="border border-border overflow-x-auto bg-card">
        <table className="w-full text-sm text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground text-xs uppercase tracking-wider bg-muted/5">
              <th className="px-4 py-3 font-normal">ID</th>
              <th className="px-4 py-3 font-normal">CUSTOMER</th>
              <th className="px-4 py-3 font-normal">SERVICE TYPE</th>
              <th className="px-4 py-3 font-normal">STATUS</th>
              <th className="px-4 py-3 font-normal">CREDITS</th>
              <th className="px-4 py-3 font-normal text-right">CREATED</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-xs tracking-widest uppercase">NO TASKS MATCHING FILTER</td>
              </tr>
            ) : (
              tasks.map(t => (
                <tr key={t.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.id}</td>
                  <td className="px-4 py-3 text-xs font-bold">{t.customerEmail || t.customerId}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-0.5 border border-border bg-muted/10 text-muted-foreground uppercase font-bold">{t.serviceType}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`px-2 py-0.5 border ${STATUS_BG[t.status] || ''} uppercase font-bold`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-bold">{t.creditCost}</td>
                  <td className="px-4 py-3 text-xs text-right text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
