export interface MatchableCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

const digitsOnly = (s?: string | null) => (s ?? "").replace(/\D/g, "");

// Prefer a confident phone match (last 9 digits, ignoring country-code/
// formatting differences); fall back to an exact case-insensitive name match
// only when it's unambiguous. Shared by the single-upload and bulk-upload
// receipt flows so matching behavior never drifts between the two.
export function findCustomerMatch<T extends MatchableCustomer>(
  customers: T[],
  extracted: { phone: string | null; customerName: string | null },
): T | null {
  const phone = digitsOnly(extracted.phone).slice(-9);
  if (phone) {
    const byPhone = customers.filter((c) => digitsOnly(c.phone).slice(-9) === phone);
    if (byPhone.length === 1) return byPhone[0];
  }
  const name = extracted.customerName?.trim().toLowerCase();
  if (name) {
    const byName = customers.filter((c) => c.name.trim().toLowerCase() === name);
    if (byName.length === 1) return byName[0];
  }
  return null;
}
