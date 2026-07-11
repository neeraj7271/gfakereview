"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button className="button-secondary" type="button" onClick={() => window.print()} title="Print packet">
      <Printer size={17} aria-hidden="true" />
      Print
    </button>
  );
}
