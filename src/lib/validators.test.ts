import { describe, expect, it } from "vitest";
import {
  transactionCreateSchema,
  transactionListQuerySchema,
  transactionUpdateSchema,
} from "@/lib/validators";

describe("[Unit] transactionCreateSchema", () => {
  it("should coerce valid transaction input when the payload uses strings", () => {
    const result = transactionCreateSchema.parse({
      amount: "12.50",
      transactionDate: "2026-03-10T12:00:00.000Z",
      description: " Lunch ",
      vendor: " Cafe ",
      categoryId: "category-1",
    });

    expect(result.amount).toBe(12.5);
    expect(result.transactionDate).toEqual(new Date("2026-03-10T12:00:00.000Z"));
    expect(result.description).toBe("Lunch");
    expect(result.vendor).toBe("Cafe");
    expect(result.categoryId).toBe("category-1");
  });

  it("should convert blank optional strings to undefined when description and vendor are empty", () => {
    const result = transactionCreateSchema.parse({
      amount: 4,
      transactionDate: "2026-03-10T12:00:00.000Z",
      description: "   ",
      vendor: "",
      categoryId: "category-1",
    });

    expect(result.description).toBeUndefined();
    expect(result.vendor).toBeUndefined();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      transactionCreateSchema.parse({
        amount: 0,
        transactionDate: "2026-03-10T12:00:00.000Z",
        categoryId: "category-1",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when transactionDate is missing", () => {
    expect(() =>
      transactionCreateSchema.parse({
        amount: 10,
        categoryId: "category-1",
      }),
    ).toThrow();
  });
});

describe("[Unit] transactionUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = transactionUpdateSchema.parse({
      vendor: " Corner Shop ",
    });

    expect(result.vendor).toBe("Corner Shop");
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => transactionUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional strings are the only fields provided", () => {
    expect(() =>
      transactionUpdateSchema.parse({
        description: "   ",
        vendor: "",
      }),
    ).toThrow("At least one field is required");
  });
});

describe("[Unit] transactionListQuerySchema", () => {
  it("should accept valid month and category filters when both are provided", () => {
    const result = transactionListQuerySchema.parse({
      month: "2026-03",
      categoryId: "category-1",
    });

    expect(result).toEqual({
      month: "2026-03",
      categoryId: "category-1",
    });
  });

  it("should reject the query when month is not in YYYY-MM format", () => {
    expect(() =>
      transactionListQuerySchema.parse({
        month: "2026-3",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });

  it("should reject the query when month is zero", () => {
    expect(() =>
      transactionListQuerySchema.parse({
        month: "2026-00",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });

  it("should reject the query when month is greater than twelve", () => {
    expect(() =>
      transactionListQuerySchema.parse({
        month: "2026-13",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });

  it("should reject the query when categoryId is blank", () => {
    expect(() =>
      transactionListQuerySchema.parse({
        categoryId: "   ",
      }),
    ).toThrow();
  });
});
