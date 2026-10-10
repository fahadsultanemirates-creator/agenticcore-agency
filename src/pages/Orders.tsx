import { AlertTriangle, FileText, Paperclip } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardNav } from "../components/dashboard/DashboardNav";
import { DashboardShell } from "../components/dashboard/DashboardShell";
import { Panel } from "../components/dashboard/Panel";
import { serviceById } from "../data/catalog";
import { statusLabel, useOrders, type OrderRow } from "../lib/dashboardData";
import { money } from "../lib/format";
import { taskTypeLabel, upfrontAmountDue } from "../lib/pricing";

/** Statuses where the client has something to do. */
const NEEDS_YOU = new Set(["awaiting_payment"]);

export function Orders() {
  const orders = useOrders();

  return (
    <DashboardShell title="Orders">
      <DashboardNav />
      <section className="py-8">
        <h1 className="font-display text-2xl font-semibold text-fg sm:text-3xl">Orders</h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Everything you have requested, newest first — including work that has already become a
          project.
        </p>

        <Panel
          loading={orders.loading}
          failed={orders.failed}
          reload={orders.reload}
          empty={orders.rows.length === 0}
          emptyIcon={FileText}
          emptyText={
            <>
              No orders yet.{" "}
              <Link to="/services" className="font-semibold text-cyan-400 hover:underline">
                Browse the 19 services
              </Link>{" "}
              to start one.
            </>
          }
        >
          <div className="mt-6 flex flex-col gap-3">
            {orders.rows.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </Panel>
      </section>
    </DashboardShell>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const service = order.task_type ? serviceById(order.task_type) : undefined;
  const price = order.agreed_price === null ? null : Number(order.agreed_price);
  const loud = NEEDS_YOU.has(order.status);

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-fg">
            {order.task_type ? taskTypeLabel(order.task_type) : order.service_category}
          </h2>
          <p className="mt-0.5 text-xs text-fg-faint">
            {order.service_category} · {new Date(order.created_at).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${
            loud ? "bg-cyan-400 text-void" : "bg-surface-2 text-fg-muted"
          }`}
        >
          {statusLabel(order.status)}
        </span>
      </div>

      {order.description ? (
        <p className="mt-3 text-sm whitespace-pre-wrap text-fg-muted">{order.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {price === null ? (
          <span className="flex items-center gap-1.5 text-fg-muted">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            No price yet — this one is quoted on scope
          </span>
        ) : (
          <>
            <span className="text-fg-muted">
              Agreed <span className="font-semibold text-fg">{money(price)}</span>
            </span>
            {order.status === "awaiting_payment" ? (
              <span className="text-fg-muted">
                Deposit <span className="font-semibold text-fg">{money(upfrontAmountDue(price))}</span>
              </span>
            ) : null}
          </>
        )}
        {order.attachment_path ? (
          <span className="flex items-center gap-1.5 text-xs text-fg-faint">
            <Paperclip className="h-3 w-3 shrink-0" /> 1 attachment
          </span>
        ) : null}
      </div>

      {service ? (
        <Link
          to={`/services/${service.id}`}
          className="mt-3 inline-block text-xs font-semibold text-cyan-400 hover:underline"
        >
          What this includes →
        </Link>
      ) : null}
    </article>
  );
}
