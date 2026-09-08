import { Link } from 'wouter';
import {
  ArrowRight, Globe, BarChart3, Megaphone, BookOpen, Scale,
  Code, Image, FileText, Cpu, Share2, LineChart, TrendingUp, Bot,
  Briefcase, Zap, Rocket, ChevronRight, Sparkles,
} from 'lucide-react';
import PublicNav from '@/components/public-nav';
import ChatWidget from '@/components/chat-widget';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/images';
const LOGO = import.meta.env.BASE_URL.replace(/\/$/, '') + '/logo.png';

/* ── 3 feature images on home page ── */
const features = [
  {
    img: `${BASE}/crypto-forex-hero.jpg`,
    tag: 'Investment Platforms',
    title: 'Crypto & Forex Portals',
    desc: 'Full investor portals with dashboard, P&L tracking, trade history and built-in referral system.',
    href: '/services',
  },
  {
    img: `${BASE}/service-website.jpg`,
    tag: 'Web Development',
    title: 'Websites & Web Apps',
    desc: 'Multi-page sites, landing pages and full-stack web applications — designed, built and deployed.',
    href: '/services',
  },
  {
    img: `${BASE}/service-marketing.jpg`,
    tag: 'Marketing',
    title: '24/7 Marketing Campaigns',
    desc: 'Ad copy, social content, email campaigns and SEO — running around the clock, every day.',
    href: '/services',
  },
];

/* ── Full service list (simple) ── */
const serviceList = [
  { icon: Globe,       label: 'Website Builder',             category: 'Web' },
  { icon: TrendingUp,  label: 'Crypto & Forex Platforms',    category: 'Platforms' },
  { icon: Megaphone,   label: '24/7 Marketing Campaigns',    category: 'Marketing' },
  { icon: BarChart3,   label: 'Marketing Strategy',          category: 'Marketing' },
  { icon: LineChart,   label: 'SEO & Analytics',             category: 'Marketing' },
  { icon: Share2,      label: 'Social Media Strategy',       category: 'Marketing' },
  { icon: BookOpen,    label: 'Bookkeeping & Finance',       category: 'Finance' },
  { icon: Scale,       label: 'Legal Documents & Contracts', category: 'Legal' },
  { icon: Cpu,         label: 'Smart Contracts (Solidity)',  category: 'Blockchain' },
  { icon: Code,        label: 'Site Audit & Performance',    category: 'Web' },
  { icon: Image,       label: 'AI Image Generation',         category: 'Creative' },
  { icon: FileText,    label: 'PDF Reports',                 category: 'Reports' },
];

const steps = [
  { icon: Briefcase, n: '01', title: 'Submit a Brief',    desc: 'Describe your task in plain language. No technical knowledge needed.' },
  { icon: Bot,       n: '02', title: 'Agents Dispatched', desc: 'Our manager agent assigns the right specialists to your task.' },
  { icon: Zap,       n: '03', title: 'AI Processing',     desc: 'Multiple specialist agents collaborate simultaneously to deliver results.' },
  { icon: Rocket,    n: '04', title: 'Receive Result',    desc: 'Download, export or deploy your completed deliverable.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white text-foreground font-sans">
      <PublicNav />
      <ChatWidget />

      {/* ══ HERO ══ */}
      <section className="pt-32 pb-20 px-6 bg-white border-b border-border">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <div className="p-4 rounded-2xl bg-white border border-border shadow-xl">
              <img src={LOGO} alt="AgenticCore" className="h-20 w-20 object-contain" />
            </div>
          </div>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/20 text-primary text-xs font-bold tracking-widest uppercase mb-6">
            <Sparkles className="w-3 h-3" />
            22 Specialist AI Agents
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-5 tracking-tight text-foreground">
            Your AI-Powered<br />
            <span className="gradient-text">Business Agency</span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Submit any business task. 22 specialist AI agents handle websites, marketing,
            legal, finance, crypto platforms and more — delivered in minutes, 24/7.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register">
              <span className="inline-flex items-center gap-2 gradient-bg text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition-opacity cursor-pointer">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/services">
              <span className="inline-flex items-center gap-2 bg-white text-foreground px-8 py-3.5 rounded-xl font-semibold text-sm border border-border shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                View All Services
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══ STATS STRIP ══ */}
      <section className="py-10 bg-muted/40 border-b border-border">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: '22+',   l: 'AI Agents'    },
            { v: '100%',  l: 'Autonomous'   },
            { v: '24/7',  l: 'Operations'   },
            { v: '<5min', l: 'Turnaround'   },
          ].map(s => (
            <div key={s.l}>
              <div className="text-2xl font-black gradient-text">{s.v}</div>
              <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ 3 FEATURE CARDS ══ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-foreground mb-3">
              Built for <span className="gradient-text">Real Business Results</span>
            </h2>
            <p className="text-muted-foreground">From investment platforms to full marketing campaigns — all AI-automated.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map(f => (
              <Link key={f.title} href={f.href}>
                <div className="group rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-shadow cursor-pointer bg-white">
                  <div className="h-44 overflow-hidden">
                    <img src={f.img} alt={f.title}
                         className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-5">
                    <span className="text-[10px] font-bold tracking-widest uppercase gradient-text">{f.tag}</span>
                    <h3 className="font-black text-base mt-1 mb-2 text-foreground">{f.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{f.desc}</p>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary group-hover:gap-2 transition-all">
                      Learn more <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SERVICES LIST ══ */}
      <section className="py-20 px-6 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-foreground mb-3">
              What We <span className="gradient-text">Deliver</span>
            </h2>
            <p className="text-muted-foreground">Every service handled end-to-end by specialist AI agents.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {serviceList.map(s => (
              <div key={s.label}
                   className="flex items-center gap-4 bg-white px-5 py-4 rounded-xl border border-border shadow-sm hover:border-primary/30 hover:shadow-md transition-all group cursor-default">
                <div className="p-2 rounded-lg gradient-bg-soft border border-primary/15 flex-shrink-0">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{s.label}</div>
                  <div className="text-[10px] font-medium text-muted-foreground tracking-widest uppercase">{s.category}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/services">
              <span className="inline-flex items-center gap-2 gradient-bg text-white px-8 py-3.5 rounded-xl font-bold text-sm shadow-md hover:opacity-90 transition-opacity cursor-pointer">
                See Full Service Details <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-foreground mb-3">
              From Brief to <span className="gradient-text">Delivered</span>
            </h2>
            <p className="text-muted-foreground">Four steps. Fully automated. Results in minutes.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((st, i) => (
              <div key={st.n} className="text-center">
                <div className="w-14 h-14 rounded-xl gradient-bg flex items-center justify-center mx-auto mb-4 shadow-md">
                  <st.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-xs font-bold text-muted-foreground mb-1 tracking-widest">{st.n}</div>
                <h3 className="font-black text-sm mb-2 text-foreground">{st.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="py-24 px-6 bg-gradient-to-br from-primary via-purple-600 to-secondary">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-5">
            Ready to Deploy Your AI Workforce?
          </h2>
          <p className="text-white/80 mb-10 leading-relaxed">
            Create an account and submit your first task in minutes.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/register">
              <span className="inline-flex items-center gap-2 bg-white text-primary px-10 py-4 rounded-xl font-black text-sm shadow-xl hover:shadow-2xl transition-shadow cursor-pointer">
                Start for Free <ArrowRight className="w-4 h-4" />
              </span>
            </Link>
            <Link href="/login">
              <span className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white px-8 py-4 rounded-xl font-semibold text-sm hover:bg-white/25 transition-colors cursor-pointer">
                Sign In
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="bg-foreground text-white/50 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
              <img src={LOGO} alt="AgenticCore" className="h-5 w-5 object-contain" />
            </div>
            <span className="text-xs font-black text-white/70 tracking-tight">AGENTICCORE<span className="gradient-text">.AGENCY</span></span>
          </div>
          <span className="text-xs text-white/25">© {new Date().getFullYear()} AgenticCore. All rights reserved.</span>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs">All systems operational</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
