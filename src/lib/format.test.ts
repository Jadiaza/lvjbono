import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("keeps a calendar-only date on the selected day", () => {
    expect(formatDate("2026-08-15")).toBe("15 de agosto de 2026");
  });

  it("continues formatting timestamps as instants", () => {
    expect(formatDate("2026-08-15T12:00:00Z")).toContain("15 de agosto de 2026");
  });

  it("returns the original value when the date is invalid", () => {
    expect(formatDate("fecha pendiente")).toBe("fecha pendiente");
  });
});
