import { Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardNav } from "../components/dashboard/DashboardNav";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { Panel } from "../components/dashboard/Panel";
import { statusLabel, useInvoices } from "../lib/dashboardData";
import { money } from "../lib/format";

/**
 * Read-only, and it has to be: `billing` has a select-own policy and no
 * insert policy at all, so this page could not create an invoice even if
 * it tried. Payment instructions live on the request that is awaiting
 * payment, where the amount and the reason are both in view.
 */
export function Invoices() {
  const invoices = useInvoices();
  const outstanding = invoices.rows
    .filter((row) => row.status === "pending")
    .reduce((total, row) => total + Number(row.amount), 0);

  return (
    <DashboardShell title="Invoices & Payments">
      <DashboardNav />
      <section className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">
              Invoices &amp; Payments
            </h1>
            <p className="mt-1.5 text-sm text-fg-muted">
              30% to start, the balance on completion. Paid in USDT on BNB Smart Chain.
            </p>
          </div>
          {outstanding > 0 ? (
            <div className="rounded-xl border-2 border-cyan-400 bg-cyan-400/5 px-4 py-2.5 text-right">
              <p className="text-xs font-semibold tracking-wide text-fg-faint uppercase">
                Outstanding
              </p>
              <p className="font-display text-xl font-semibold text-cyan-400 tabular-nums">
                {money(outstanding)}
              </p>
            </div>
          ) : null}
        </div>

        <Panel
          loading={invoices.loading}
          failed={invoices.failed}
          reload={invoices.reload}
          empty={invoices.rows.length === 0}
          emptyIcon={Receipt}
          emptyText={
            <>
              Nothing invoiced yet. Invoices appear here once a price is agreed —{" "}
              <Link to="/orders" className="font-semibold text-cyan-400 hover:underline">
                see your orders
              </Link>
              .
            </>
          }
        >
          <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-md text-left text-sm">
              <thead className="bg-surface-2 text-xs tracking-wide text-fg-faint uppercase">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Stage</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Paid</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border bg-surface">
                    <td className="px-4 py-3 text-fg-muted">
                      {row.payment_type === "upfront" ? "Deposit (30%)" : row.payment_type}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-fg tabular-nums">
                      {money(Number(row.amount))}
                      {Number(row.points_used) > 0 ? (
                        <span className="block text-xs font-normal text-fg-faint">
                          {Number(row.points_used)} points used
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-fg-muted">
                      {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
                          row.status === "pending"
                            ? "bg-cyan-400 text-void"
                            : "bg-surface-2 text-fg-muted"
                        }`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-xs text-fg-faint">
            A payment is confirmed by our system seeing it on the chain. A screenshot or a
            transaction hash sent to us is not, by itself, confirmation.
          </p>
        </Panel>
      </section>
    </DashboardShell>
  );
}
