import { describe, it, expect } from "vitest";
import {
  customerName,
  customerInitial,
  cleanDisplayName,
} from "@/lib/identity";
describe("customer identity is distinct from budget names", () => {
  it("uses verified account metadata, with compatible email and customer fallbacks", () => {
    expect(
      customerName(
        { id: "a", email: "alex@example.test", displayName: "Alex 李" },
        "Untrusted guest",
      ),
    ).toBe("Alex 李");
    expect(
      customerName({ id: "a", email: "alex@example.test" }, "Untrusted guest"),
    ).toBe("alex");
    expect(customerName({ id: "a" })).toBe("Customer");
  });
  it("identifies guests and samples explicitly without inventing a customer", () => {
    expect(customerName(null)).toBe("Guest");
    expect(customerName(null, "  Élodie 王  ")).toBe("Élodie 王");
    expect(customerName(null, "Guest", true)).toBe("Demo");
    expect(customerInitial("🪷 Guest")).toBe("🪷");
  });
  it("ignores non-string metadata and bounds long display values", () => {
    expect(cleanDisplayName({ full_name: "Forged" })).toBeUndefined();
    expect(cleanDisplayName(" ")).toBeUndefined();
    expect(cleanDisplayName("李".repeat(300))).toHaveLength(200);
  });
});
