import type { Section } from "@prisma/client";

// Single source of truth for the gateable sections and how they're labelled.
//
// Typed as Record<Section, string> deliberately: adding a value to the Section
// enum in schema.prisma WITHOUT adding it here is a compile error, so a new
// section can never again be silently missing from the Super Admin plan
// editor. (That's exactly how STYLES went missing — the list was copy-pasted
// into three separate files, and adding the enum value updated none of them.)
//
// Insertion order here is display order in the plan editor.
export const SECTION_LABELS: Record<Section, string> = {
  CUSTOMERS: "Customers",
  RECEIPTS: "Receipts",
  ORDERS: "Orders",
  PRODUCTION: "Production",
  EXPENSES: "Expenses",
  INCOME: "Income",
  STYLES: "Styles",
  TEAM: "Team",
  AUDIT_LOG: "Audit Log",
  SETTINGS: "Settings",
};

// `import type` above keeps this file free of any runtime Prisma import, so
// it stays safe to pull into a client component without dragging the Prisma
// client into the browser bundle.
export const ALL_SECTIONS = Object.keys(SECTION_LABELS) as Section[];
