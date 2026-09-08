import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Menu, X } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const LOGO = `${BASE}/logo.png`;

const navLinks = [
  { label: 'Home',         href: '/'           },
  { label: 'Services',     href: '/services'   },
  { label: 'AI Framework', href: '/framework'  },
];

export default function PublicNav() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" onClick={() => setMobileOpen(false)}>
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src={LOGO} alt="AgenticCore" className="h-9 w-9 object-contain rounded-md" style={{ filter: 'hue-rotate(55deg) saturate(1.3)' }} />
              <div className="leading-tight">
                <span className="text-sm font-black text-foreground tracking-tight block">AGENTICCORE</span>
                <span className="text-[9px] font-bold tracking-widest uppercase gradient-text">.AGENCY</span>
              </div>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}>
                <span className={`text-sm font-semibold transition-colors cursor-pointer ${
                  location === l.href ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}>
                  {l.label}
                </span>
              </Link>
            ))}
          </div>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login">
              <span className="px-4 py-2 rounded-lg text-sm font-semibold text-foreground border border-border bg-white hover:bg-muted/40 transition-colors cursor-pointer shadow-sm">
                Sign In
              </span>
            </Link>
            <Link href="/register">
              <span className="gradient-bg px-5 py-2 rounded-lg text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity cursor-pointer">
                Get Started
              </span>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-foreground/70 hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex flex-col" onClick={() => setMobileOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/20" />
          {/* Panel */}
          <div
            className="absolute top-16 inset-x-0 bg-white border-b border-border shadow-xl p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            {/* Nav links */}
            <div className="flex flex-col gap-1">
              {navLinks.map(l => (
                <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)}>
                  <span className={`block px-3 py-3 rounded-lg text-base font-semibold transition-colors cursor-pointer ${
                    location === l.href
                      ? 'text-primary bg-primary/5'
                      : 'text-foreground hover:bg-muted/50'
                  }`}>
                    {l.label}
                  </span>
                </Link>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Auth buttons */}
            <div className="flex flex-col gap-3">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <span className="block w-full text-center px-4 py-3 rounded-xl text-sm font-bold text-foreground border border-border bg-white hover:bg-muted/40 transition-colors cursor-pointer shadow-sm">
                  Sign In
                </span>
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                <span className="block w-full text-center gradient-bg px-4 py-3 rounded-xl text-white text-sm font-bold shadow-md hover:opacity-90 transition-opacity cursor-pointer">
                  Get Started Free
                </span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
