import { ArrowRight, Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { activeServices, categories, formatPrice } from "../../data/catalog";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

/**
 * Creating a project without the model.
 *
 * Two jobs. It is the fallback when Forge cannot answer -- the brief is
 * explicit that an AI outage must not be the only path to starting a
 * project -- and it is how a conversation becomes a saved draft, so the
 * work of describing a project is not lost when the tab closes.
 *
 * It writes a `requests` row with status 'draft' and a NULL
 * agreed_price. Both matter. 'draft' means nothing is owed and nothing
 * is queued until a person has read it; a null price means the
 * catalogue figure is not mistaken for an agreed one, which for the
 * thirteen "From" services would be wrong by whatever the scope turns
 * out to be.
 */
export function ProjectDraftForm({
  initialDescription = "",
  onSaved,
}: {
  initialDescription?: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [serviceId, setServiceId] = useState("");
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const service = activeServices.find((s) => s.id === serviceId);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Sign in first and your draft will be saved to your account.");
      return;
    }
    if (description.trim().length < 20) {
      setError("A sentence or two about what you need is enough to start.");
      return;
    }
    setError("");
    setSaving(true);

    const categoryLabel = service
      ? (categories.find((c) => c.id === service.category)?.label ?? "Service")
      : "Not yet decided";

    const { data, error: insertError } = await supabase
      .from("requests")
      .insert({
        user_id: user.id,
        service_category: categoryLabel,
        task_type: service?.id ?? null,
        // requests.tier is a not-null leftover from a three-tier pricing
        // system that no longer exists; 'low' satisfies the constraint
        // without inventing a tier anybody chose.
        tier: "low",
        description: description.trim(),
        agreed_price: null,
        status: "draft",
      })
      .select("id")
      .single();

    setSaving(false);
    if (insertError || !data) {
      console.error("Saving draft failed:", insertError?.message);
      setError("Couldn't save that just now. Please try again.");
      return;
    }
    setSavedId(data.id as string);
    onSaved?.();
  };

  if (savedId) {
    return (
      <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/5 p-5">
        <Check className="h-6 w-6 text-cyan-400" />
        <h3 className="mt-2 font-display text-lg font-semibold text-fg">Draft saved</h3>
        <p className="mt-1.5 text-sm text-fg-muted">
          Nothing is charged and nothing has started. We read it, come back with a scope, a price
          and a timeline, and only then is there a deposit.
        </p>
        <Link
          to="/orders"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2.5 text-sm font-semibold text-void transition-transform hover:-translate-y-0.5"
        >
          See it in your orders
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-display text-lg font-semibold text-fg">Describe it yourself</h3>
      <p className="mt-1.5 text-sm text-fg-muted">
        No AI needed. Tell us what you want built and we take it from there.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            Closest service
          </span>
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className="rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg focus:border-cyan-400 focus:outline-none"
          >
            <option value="">I'm not sure — help me work it out</option>
            {categories.map((category) => (
              <optgroup key={category.id} label={category.label}>
                {activeServices
                  .filter((s) => s.category === category.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatPrice(s)}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
            What you need
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder="What the business does, what you want built, and anything it has to work with."
            className="rounded-xl border-2 border-border bg-void px-3.5 py-2.5 text-fg placeholder:text-fg-faint focus:border-cyan-400 focus:outline-none"
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-cyan-300">{error}</p> : null}

      {!user ? (
        <p className="mt-3 text-sm text-fg-muted">
          <Link to="/login" className="font-semibold text-cyan-400 hover:underline">
            Sign in
          </Link>{" "}
          or{" "}
          <Link to="/signup" className="font-semibold text-cyan-400 hover:underline">
            create an account
          </Link>{" "}
          to save this — it takes a moment and keeps the draft with your projects.
        </p>
      ) : null}

      <p className="mt-3 text-xs text-fg-faint">
        Saving a draft costs nothing and commits you to nothing. No price is set until we have
        agreed the scope with you.
      </p>

      <button
        type="submit"
        disabled={saving || !user}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-void shadow-glow-cyan transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save project draft"}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
