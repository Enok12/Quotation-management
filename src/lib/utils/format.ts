export const fmtMoney = (n: number | string | { toNumber(): number }) => {
  const val = typeof n === "object" ? n.toNumber() : Number(n);
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(val);
};

export const fmtDate = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(d));

export const fmtDateTime = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
