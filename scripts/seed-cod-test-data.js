/* eslint-disable */
// Seeds (and cleans up) fake Retail COD data so the COD screens can be checked
// with a realistic volume. Plain JS so it runs with just `node` (no tsx).
//
//   node scripts/seed-cod-test-data.js --business "Dummy Business"            # 150 orders
//   node scripts/seed-cod-test-data.js --business "Dummy Business" --count 200
//   node scripts/seed-cod-test-data.js --business "Dummy Business" --enable-cod
//   node scripts/seed-cod-test-data.js --business "Dummy Business" --clean    # remove ONLY the seeded rows
//
// Everything it creates is recognisable and removable:
//   - products with SKU starting "SEED-"
//   - sales whose note starts with "[SEED-COD]"
//   - settlements whose reference starts with "SEED-"
//   - customers named "... (test)" with fake 0700 000 xxxx numbers
// It only ever touches the business named by --business, never anything else.
// Stock is kept consistent: a reserved order has its stock taken off, a
// refused/cancelled one has it put back, exactly as the app itself would.

const { PrismaClient, Prisma } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();
const D = (n) => new Prisma.Decimal(n);
const id = () => "seed" + crypto.randomBytes(10).toString("hex");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};

const NOTE = "[SEED-COD]";
const DAY = 86_400_000;

// Small deterministic PRNG so two runs produce the same shape of data.
let state = 20261028;
const rand = () => { state = (state * 1664525 + 1013904223) % 4294967296; return state / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const ago = (days, jitterDays = 0) => new Date(Date.now() - (days + rand() * jitterDays) * DAY);

const FIRST = ["Nimali", "Kasun", "Dilani", "Ruwan", "Sachini", "Tharindu", "Madhavi", "Chamara", "Ishara", "Pradeep", "Anusha", "Lahiru", "Hasini", "Dinesh", "Kavindi", "Sanjaya", "Thilini", "Nuwan", "Piyumi", "Gayan"];
const LAST = ["Perera", "Silva", "Fernando", "Jayasinghe", "Wickramasinghe", "Bandara", "Gunawardena", "Rajapaksa", "De Mel", "Herath", "Karunaratne", "Dissanayake"];
const TOWNS = ["Colombo 05", "Nugegoda", "Kandy", "Galle", "Negombo", "Matara", "Kurunegala", "Gampaha", "Jaffna", "Ratnapura", "Anuradhapura", "Badulla"];
const STREETS = ["Temple Road", "Main Street", "Lake Drive", "Station Road", "School Lane", "Hospital Road", "Flower Road"];
const COURIERS = ["Swift Couriers", "CityExpress", "Own rider"];
const REFUSE_REASONS = ["Customer not answering", "Refused to pay", "Changed mind at the door", "Wrong address", "Not at home, 3 attempts"];
const CANCEL_REASONS = ["Customer changed mind", "Out of the colour wanted", "Duplicate order"];

const PRODUCTS = [
  ["SEED-001", "Cotton frock", 2800, 4500], ["SEED-002", "Linen shirt", 3100, 5200],
  ["SEED-003", "Silk scarf", 900, 1800], ["SEED-004", "Denim jacket", 5200, 8900],
  ["SEED-005", "Summer dress", 3300, 5900], ["SEED-006", "Kids t-shirt", 700, 1400],
  ["SEED-007", "Leather belt", 1100, 2300], ["SEED-008", "Handloom sarong", 2400, 4200],
];

// Status mix (per 100 orders) chosen so every tab, badge and aging bucket has something to show.
const MIX = [
  ["PENDING_CONFIRMATION", 10], ["PENDING_DISPATCH", 13], ["OUT_FOR_DELIVERY", 13],
  ["DELIVERED", 22], ["REMITTED", 24], ["REFUSED", 12], ["CANCELLED", 6],
];

async function findBusiness() {
  const name = opt("business");
  if (!name) { console.error('Pass --business "<exact business name>"'); process.exit(1); }
  const matches = await prisma.business.findMany({ where: { name }, select: { id: true, name: true, codEnabled: true, plan: { select: { enabledSections: true } } } });
  if (matches.length !== 1) { console.error(`Expected exactly one business named "${name}", found ${matches.length}.`); process.exit(1); }
  return matches[0];
}

async function clean(business) {
  const seedSales = await prisma.inventorySale.findMany({ where: { businessId: business.id, note: { startsWith: NOTE } }, select: { id: true } });
  const saleIds = seedSales.map((s) => s.id);
  const products = await prisma.inventoryProduct.findMany({ where: { businessId: business.id, sku: { startsWith: "SEED-" } }, select: { id: true } });
  const productIds = products.map((p) => p.id);

  const [delSales, delSettle] = await prisma.$transaction([
    prisma.inventorySale.deleteMany({ where: { id: { in: saleIds } } }), // cascades items + delivery rows
    prisma.codSettlement.deleteMany({ where: { businessId: business.id, reference: { startsWith: "SEED-" } } }),
    prisma.inventoryStockMovement.deleteMany({ where: { productId: { in: productIds } } }),
    prisma.inventoryProduct.deleteMany({ where: { id: { in: productIds } } }),
  ]);
  console.log(`Removed ${delSales.count} seeded sales, ${delSettle.count} settlements and ${productIds.length} seed products from "${business.name}".`);
}

async function seed(business) {
  const count = Math.min(Math.max(Number.parseInt(opt("count", "150"), 10) || 150, 1), 500);
  if (!business.plan.enabledSections.includes("SALES") || !business.plan.enabledSections.includes("INVENTORY")) {
    console.error(`"${business.name}" isn't on a plan with Sales and Inventory, so COD can't be used there.`);
    process.exit(1);
  }
  const existing = await prisma.inventorySale.count({ where: { businessId: business.id, note: { startsWith: NOTE } } });
  if (existing > 0) { console.error(`"${business.name}" already has ${existing} seeded sales. Run with --clean first.`); process.exit(1); }

  const member = await prisma.businessMember.findFirst({ where: { businessId: business.id, role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { userId: true } });
  if (!member) { console.error("No admin found in that business."); process.exit(1); }
  const actorId = member.userId;

  // ---- products ----
  const OPENING = 600;
  const products = PRODUCTS.map(([sku, name, cost, price]) => ({ id: id(), sku, name, cost, price, onHand: OPENING }));
  const movements = products.map((p) => ({ id: id(), productId: p.id, businessId: business.id, type: "IN", quantity: OPENING, reason: "Opening stock (seed)", performedById: actorId, createdAt: ago(70) }));

  // ---- decide each order's status ----
  const statuses = [];
  for (const [s, per100] of MIX) for (let i = 0; i < Math.round((per100 * count) / 100); i++) statuses.push(s);
  while (statuses.length < count) statuses.push("DELIVERED");
  statuses.length = count;
  // shuffle
  for (let i = statuses.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [statuses[i], statuses[j]] = [statuses[j], statuses[i]]; }

  // A pool of repeat customers so some phone numbers accumulate refusals (the "frequent refuser" badge).
  const people = Array.from({ length: Math.ceil(count * 0.6) }, (_, i) => {
    const n = String(1000 + i).padStart(4, "0");
    return { name: `${pick(FIRST)} ${pick(LAST)} (test)`, phone: `070000${n}`, phone2: rand() < 0.2 ? `071000${n}` : null };
  });
  const repeatRefusers = people.slice(0, 6); // the first few get pulled into REFUSED orders repeatedly

  let dispatchNo = (await prisma.business.findUniqueOrThrow({ where: { id: business.id }, select: { lastDispatchNumber: true } })).lastDispatchNumber;

  const sales = [], items = [], deliveries = [], settlementsByKey = new Map();
  const stockDelta = new Map(products.map((p) => [p.id, 0]));

  statuses.forEach((status, idx) => {
    // Build each order's timeline BACKWARDS from the milestone that defines its
    // status, so no date is ever in the future and the aging buckets (0-7, 8-14,
    // 15+ days awaiting payout) all get some orders.
    const HR = 3_600_000;
    const now = Date.now();
    const cap = (t) => new Date(Math.min(t, now));
    const daysAgo = (lo, hi) => now - (lo + rand() * (hi - lo)) * DAY;
    let created, confirmedAt = null, dispatchedAt = null, deliveredAt = null, closedAt = null;
    if (status === "PENDING_CONFIRMATION") { created = new Date(daysAgo(0, 3)); }
    else if (status === "PENDING_DISPATCH") { confirmedAt = new Date(daysAgo(0, 3)); created = new Date(confirmedAt.getTime() - between(1, 24) * HR); }
    else if (status === "CANCELLED") { created = new Date(daysAgo(1, 30)); closedAt = cap(created.getTime() + between(1, 48) * HR); }
    else {
      if (status === "OUT_FOR_DELIVERY") dispatchedAt = new Date(daysAgo(0, 6));
      else if (status === "DELIVERED") { deliveredAt = new Date(daysAgo(0, 28)); dispatchedAt = new Date(deliveredAt.getTime() - between(24, 72) * HR); }
      else if (status === "REMITTED") { deliveredAt = new Date(daysAgo(8, 55)); dispatchedAt = new Date(deliveredAt.getTime() - between(24, 72) * HR); }
      else if (status === "REFUSED") { dispatchedAt = new Date(daysAgo(2, 45)); closedAt = cap(dispatchedAt.getTime() + between(24, 72) * HR); }
      confirmedAt = new Date(dispatchedAt.getTime() - between(3, 30) * HR);
      created = new Date(confirmedAt.getTime() - between(1, 24) * HR);
    }
    const person = status === "REFUSED" && rand() < 0.6 ? pick(repeatRefusers) : pick(people);
    const lineCount = between(1, 3);
    const chosen = [...products].sort(() => rand() - 0.5).slice(0, lineCount);
    const lines = chosen.map((p) => {
      const quantity = between(1, 3);
      const unitPrice = p.price;
      return { product: p, quantity, unitPrice, lineTotal: unitPrice * quantity };
    });
    const total = lines.reduce((s, l) => s + l.lineTotal, 0);
    const fee = pick([250, 300, 350, 400, 450]);
    const feePaidBy = rand() < 0.75 ? "CUSTOMER" : "BUSINESS";
    const codAmount = feePaidBy === "CUSTOMER" ? total + fee : total;

    dispatchNo += 1;
    const saleId = id();
    sales.push({ id: saleId, businessId: business.id, totalAmount: D(total), note: `${NOTE} order ${idx + 1}`, soldById: actorId, fulfilment: "COD_DELIVERY", createdAt: created });

    for (const l of lines) {
      items.push({ id: id(), saleId, productId: l.product.id, quantity: l.quantity, unitPrice: D(l.unitPrice), costPriceAtSale: D(l.product.cost), lineTotal: D(l.lineTotal) });
      movements.push({ id: id(), productId: l.product.id, businessId: business.id, type: "OUT", quantity: l.quantity, reason: "Sold (COD)", performedById: actorId, createdAt: created });
    }

    const needsLink = status === "PENDING_CONFIRMATION";
    const courier = dispatchedAt ? pick(COURIERS) : null;

    // Stock: reserved orders hold their units; refused/cancelled put them back.
    if (!["REFUSED", "CANCELLED"].includes(status)) {
      for (const l of lines) stockDelta.set(l.product.id, stockDelta.get(l.product.id) - l.quantity);
    } else {
      for (const l of lines) {
        movements.push({ id: id(), productId: l.product.id, businessId: business.id, type: "IN", quantity: l.quantity, reason: status === "REFUSED" ? "COD refused" : "COD cancelled", performedById: actorId, createdAt: closedAt });
      }
    }

    let settlementId = null;
    if (status === "REMITTED") {
      // Group paid-out orders into a settlement per courier per ISO-week of delivery.
      const wk = `${courier}|${Math.floor(deliveredAt.getTime() / (7 * DAY))}`;
      if (!settlementsByKey.has(wk)) settlementsByKey.set(wk, { id: id(), courierName: courier, orders: [], receivedAt: cap(deliveredAt.getTime() + between(2, 6) * DAY) });
      const st = settlementsByKey.get(wk);
      settlementId = st.id;
      st.orders.push({ codAmount, fee });
      st.receivedAt = cap(Math.max(st.receivedAt.getTime(), deliveredAt.getTime() + 2 * DAY));
    }

    deliveries.push({
      id: id(), saleId, businessId: business.id,
      dispatchRef: `COD-${String(dispatchNo).padStart(4, "0")}`,
      customerName: person.name, customerPhone: person.phone, customerPhone2: person.phone2,
      customerPhoneNormalized: `94${person.phone.slice(1)}`,
      deliveryAddress: `No. ${between(1, 250)}, ${pick(STREETS)}`, city: pick(TOWNS),
      courierName: courier, waybillNo: courier && courier !== "Own rider" ? `WB${100000 + idx}` : null,
      codAmount: D(codAmount), deliveryFee: D(fee), feePaidBy,
      status,
      dispatchedAt, deliveredAt, remittedAt: null /* set below once the settlement date is known */,
      closedAt, closedReason: status === "REFUSED" ? pick(REFUSE_REASONS) : status === "CANCELLED" ? pick(CANCEL_REASONS) : null,
      confirmToken: needsLink ? crypto.randomBytes(32).toString("base64url") : null,
      // Some pending links already expired, so the "Link expired" flag has something to show.
      confirmExpiresAt: needsLink ? (rand() < 0.3 ? new Date(Date.now() - between(1, 4) * DAY) : new Date(Date.now() + between(1, 3) * DAY)) : null,
      confirmedAt, confirmedBy: needsLink ? null : (rand() < 0.7 ? "CUSTOMER" : "SELLER"),
      settlementId, createdAt: created, updatedAt: created,
    });
  });

  // ---- settlements (a couple deliberately come up short, to show the variance flag) ----
  let n = 0;
  const settlements = [...settlementsByKey.values()].map((s) => {
    n += 1;
    const gross = s.orders.reduce((a, o) => a + o.codAmount, 0);
    const fees = s.orders.reduce((a, o) => a + o.fee, 0);
    const short = n % 4 === 0 ? between(100, 600) : 0;
    const net = gross - fees - short;
    for (const d of deliveries) if (d.settlementId === s.id) d.remittedAt = s.receivedAt;
    return {
      id: s.id, businessId: business.id, courierName: s.courierName, reference: `SEED-${String(n).padStart(3, "0")}`,
      receivedAt: s.receivedAt, grossCollected: D(gross), feesDeducted: D(fees), netReceived: D(net), variance: D(short),
      note: short ? "Courier short-paid (seed)" : null, createdById: actorId, createdAt: s.receivedAt,
    };
  });

  // ---- write everything in one transaction, in FK order ----
  await prisma.$transaction([
    prisma.inventoryProduct.createMany({
      data: products.map((p) => ({ id: p.id, businessId: business.id, sku: p.sku, name: p.name, costPrice: D(p.cost), sellingPrice: D(p.price), quantityOnHand: OPENING + stockDelta.get(p.id), createdById: actorId })),
    }),
    prisma.inventoryStockMovement.createMany({ data: movements }),
    prisma.inventorySale.createMany({ data: sales }),
    prisma.inventorySaleItem.createMany({ data: items }),
    prisma.codSettlement.createMany({ data: settlements }),
    prisma.inventorySaleDelivery.createMany({ data: deliveries }),
    prisma.business.update({ where: { id: business.id }, data: { lastDispatchNumber: dispatchNo, ...(flag("enable-cod") ? { codEnabled: true } : {}) } }),
  ], { timeout: 120_000 });

  const by = {};
  for (const d of deliveries) by[d.status] = (by[d.status] ?? 0) + 1;
  console.log(`Seeded ${count} COD orders into "${business.name}":`, by);
  console.log(`  ${settlements.length} settlements (${settlements.filter((s) => Number(s.variance) > 0).length} with a shortfall), ${products.length} SEED- products.`);
  console.log(flag("enable-cod") ? "  COD was switched ON for this business." : '  COD is still OFF unless it already was — switch it on from the Sales page to see the data.');
}

(async () => {
  const business = await findBusiness();
  if (flag("clean")) await clean(business);
  else await seed(business);
})()
  .catch((e) => { console.error("FAILED:", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
