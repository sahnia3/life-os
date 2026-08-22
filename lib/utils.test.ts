import { describe, expect, it } from "vitest";
import { cn, parseTemp, tempUnit } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("merges conflicting Tailwind classes, keeping the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });
});

describe("tempUnit", () => {
  it("returns °C for null", () => {
    expect(tempUnit(null)).toBe("°C");
  });

  it("returns °C for undefined", () => {
    expect(tempUnit(undefined)).toBe("°C");
  });

  it("returns °C for values <= 50", () => {
    expect(tempUnit(50)).toBe("°C");
    expect(tempUnit(-10)).toBe("°C");
  });

  it("returns °F for values > 50", () => {
    expect(tempUnit(51)).toBe("°F");
    expect(tempUnit(100)).toBe("°F");
  });
});

describe("parseTemp", () => {
  it("parses a value with a °F unit", () => {
    expect(parseTemp("Will it be 75°F in NYC on Monday?")).toEqual({
      value: 75,
      unit: "°F",
    });
  });

  it("parses a value with a °C unit", () => {
    expect(parseTemp("Will it be 20°C in London?")).toEqual({
      value: 20,
      unit: "°C",
    });
  });

  it("returns null when no match is found", () => {
    expect(parseTemp("Will Bitcoin hit $100k?")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(parseTemp(null)).toBeNull();
  });
});
