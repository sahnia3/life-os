import { describe, expect, it } from "vitest"
import { cn, parseTemp, tempUnit } from "../../lib/utils"

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1")
  })

  it("resolves conflicting tailwind classes via tailwind-merge", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
  })

  it("drops falsy values", () => {
    expect(cn("px-2", false, null, undefined, "py-1")).toBe("px-2 py-1")
  })
})

describe("tempUnit", () => {
  it("returns °F for values above 50", () => {
    expect(tempUnit(75)).toBe("°F")
  })

  it("returns °C for values at or below 50", () => {
    expect(tempUnit(50)).toBe("°C")
    expect(tempUnit(-5)).toBe("°C")
  })

  it("returns °C for null", () => {
    expect(tempUnit(null)).toBe("°C")
  })

  it("returns °C for undefined", () => {
    expect(tempUnit(undefined)).toBe("°C")
  })
})

describe("parseTemp", () => {
  it("parses a Fahrenheit value from the question", () => {
    expect(parseTemp("Will it be above 90°F tomorrow?")).toEqual({
      value: 90,
      unit: "°F",
    })
  })

  it("parses a Celsius value from the question", () => {
    expect(parseTemp("Will it be above 20C tomorrow?")).toEqual({
      value: 20,
      unit: "°C",
    })
  })

  it("returns null when there is no match", () => {
    expect(parseTemp("Will it rain tomorrow?")).toBeNull()
  })

  it("returns null for a null question", () => {
    expect(parseTemp(null)).toBeNull()
  })
})
