import { useListAgencyCreditTransactions } from '@workspace/api-client-react';
import { DashboardLayout } from '@/components/layout';
import { useAuth } from '@/lib/auth';
import { Zap, TrendingUp, TrendingDown, Loader2, Mail } from 'lucide-react';
import { format } from 'date-fns';

export default function Credits() {
  const { customer } = useAuth();
  const { data, isLoading } = useListAgencyCreditTransactions();
  const transactions = data?.transactions ?? [];

  const totalEarned = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalSpent = transactions.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Credits</h1>
          <p className="text-muted-foreground text-sm mt-1">Your credit balance and transaction history.</p>
        </div>

        {/* Balance card */}
        <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/20 via-violet-600/10 to-transparent border border-primary/20 mb-8">
          <p className="text-sm text-muted-foreground mb-1">Current Balance</p>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black">{customer?.creditBalance ?? '…'}</span>
            <span className="text-muted-foreground font-medium">credits</span>
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-3.5 h-3.5" />
              {totalEarned} received
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <TrendingDown className="w-3.5 h-3.5" />
              {totalSpent} spent
            </span>
          </div>
        </div>

        {/* Get more credits */}
        <div className="p-5 rounded-2xl bg-card border border-border mb-8 flex items-start gap-4">
          <div className="p-2.5 rounded-lg bg-amber-400/10 border border-amber-400/20">
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-sm mb-1">Need more credits?</p>
            <p className="text-sm text-muted-foreground mb-3">
              Credits are assigned by your account manager. Contact us to top up your balance.
            </p>
            <a
              href="mailto:support@agenticcore.agency?subject=Credit Top-up Request"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 font-semibold rounded-lg hover:bg-amber-400/20 transition-all text-sm"
            >
              <Mail className="w-4 h-4" /> Contact Support
            </a>
          </div>
        </div>

        {/* Transaction history */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-bold">Transaction History</h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              No transactions yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...transactions].reverse().map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg border ${tx.type === 'credit' ? 'bg-emerald-400/10 border-emerald-400/20' : 'bg-rose-400/10 border-rose-400/20'}`}>
                      {tx.type === 'credit'
                        ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                        : <TrendingDown className="w-4 h-4 text-rose-400" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(tx.createdAt), 'MMM d, yyyy · HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {tx.type === 'credit' ? '+' : '−'}{tx.amount}
                    </p>
                    <p className="text-xs text-muted-foreground">→ {tx.balanceAfter} cr</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
