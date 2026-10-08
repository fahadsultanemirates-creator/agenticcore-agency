/** Money, always to the cent. A bare toLocaleString drops ".00". */
export function money(amount: number | string): string {
  return (
    "$" +
    Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** A date somebody can read, in their own locale. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
