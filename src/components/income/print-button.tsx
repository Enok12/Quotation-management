"use client";

import { Printer } from "lucide-react";

// Uses the browser's native print dialog — the dashboard layout and this
// page both carry print: variants so only the report itself ends up on paper
// (sidebar/controls hidden, content flows across pages instead of clipping).
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-outline">
      <Printer size={15} /> Print
    </button>
  );
}
