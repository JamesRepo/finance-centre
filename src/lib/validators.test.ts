import { describe, expect, it } from "vitest";
import {
  budgetListQuerySchema,
  budgetUpsertSchema,
  debtCreateSchema,
  debtPaymentCreateSchema,
  debtUpdateSchema,
  savingsContributionCreateSchema,
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
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

describe("[Unit] budgetListQuerySchema", () => {
  it("should accept the query when month is in YYYY-MM format", () => {
    const result = budgetListQuerySchema.parse({
      month: "2026-03",
    });

    expect(result).toEqual({
      month: "2026-03",
    });
  });

  it("should reject the query when month is missing", () => {
    expect(() => budgetListQuerySchema.parse({})).toThrow();
  });

  it("should reject the query when month is not in YYYY-MM format", () => {
    expect(() =>
      budgetListQuerySchema.parse({
        month: "2026-3",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });
});

describe("[Unit] budgetUpsertSchema", () => {
  it("should coerce a valid payload when amount uses a string", () => {
    const result = budgetUpsertSchema.parse({
      categoryId: "category-1",
      month: "2026-03",
      amount: "250.75",
    });

    expect(result).toEqual({
      categoryId: "category-1",
      month: "2026-03",
      amount: 250.75,
    });
  });

  it("should reject the payload when categoryId is blank", () => {
    expect(() =>
      budgetUpsertSchema.parse({
        categoryId: "   ",
        month: "2026-03",
        amount: 100,
      }),
    ).toThrow();
  });

  it("should accept the payload when amount is zero", () => {
    const result = budgetUpsertSchema.parse({
      categoryId: "category-1",
      month: "2026-03",
      amount: 0,
    });

    expect(result).toEqual({
      categoryId: "category-1",
      month: "2026-03",
      amount: 0,
    });
  });

  it("should reject the payload when month is invalid", () => {
    expect(() =>
      budgetUpsertSchema.parse({
        categoryId: "category-1",
        month: "2026-13",
        amount: 100,
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });
});

describe("[Unit] debtCreateSchema", () => {
  it("should coerce and trim a valid debt payload when optional fields use strings", () => {
    const result = debtCreateSchema.parse({
      name: " Visa Card ",
      debtType: "CREDIT_CARD",
      originalBalance: "2500.75",
      interestRate: "19.99",
      minimumPayment: "50",
      startDate: "2026-01-15T00:00:00.000Z",
      targetPayoffDate: "2026-12-31T00:00:00.000Z",
      notes: " Main card ",
    });

    expect(result).toEqual({
      name: "Visa Card",
      debtType: "CREDIT_CARD",
      originalBalance: 2500.75,
      interestRate: 19.99,
      minimumPayment: 50,
      startDate: new Date("2026-01-15T00:00:00.000Z"),
      targetPayoffDate: new Date("2026-12-31T00:00:00.000Z"),
      notes: "Main card",
    });
  });

  it("should convert blank optional fields to undefined when they are empty strings", () => {
    const result = debtCreateSchema.parse({
      name: "Student Loan",
      debtType: "STUDENT_LOAN",
      originalBalance: 12000,
      interestRate: 4.5,
      minimumPayment: "",
      startDate: "   ",
      targetPayoffDate: "",
      notes: "   ",
    });

    expect(result.minimumPayment).toBeUndefined();
    expect(result.startDate).toBeUndefined();
    expect(result.targetPayoffDate).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("should reject the payload when debtType is not allowed", () => {
    expect(() =>
      debtCreateSchema.parse({
        name: "Loan",
        debtType: "MORTGAGE",
        originalBalance: 1000,
        interestRate: 4,
      }),
    ).toThrow();
  });

  it("should reject the payload when originalBalance is zero", () => {
    expect(() =>
      debtCreateSchema.parse({
        name: "Loan",
        debtType: "OTHER",
        originalBalance: 0,
        interestRate: 4,
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when interestRate is negative", () => {
    expect(() =>
      debtCreateSchema.parse({
        name: "Loan",
        debtType: "OTHER",
        originalBalance: 1000,
        interestRate: -1,
      }),
    ).toThrow("Too small");
  });
});

describe("[Unit] debtUpdateSchema", () => {
  it("should accept a partial debt payload when one valid field is provided", () => {
    const result = debtUpdateSchema.parse({
      notes: " Refinance candidate ",
    });

    expect(result.notes).toBe("Refinance candidate");
  });

  it("should preserve explicit nulls when nullable debt fields are cleared", () => {
    const result = debtUpdateSchema.parse({
      minimumPayment: null,
      startDate: null,
      targetPayoffDate: null,
      notes: null,
    });

    expect(result).toEqual({
      minimumPayment: null,
      startDate: null,
      targetPayoffDate: null,
      notes: null,
    });
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => debtUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional fields are the only values provided", () => {
    expect(() =>
      debtUpdateSchema.parse({
        minimumPayment: "",
        startDate: "",
        notes: "   ",
      }),
    ).toThrow("At least one field is required");
  });
});

describe("[Unit] debtPaymentCreateSchema", () => {
  it("should coerce and trim a valid payment payload when the request uses strings", () => {
    const result = debtPaymentCreateSchema.parse({
      amount: "125.50",
      paymentDate: "2026-03-11T00:00:00.000Z",
      note: " March payment ",
    });

    expect(result).toEqual({
      amount: 125.5,
      paymentDate: new Date("2026-03-11T00:00:00.000Z"),
      note: "March payment",
    });
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      debtPaymentCreateSchema.parse({
        amount: 0,
        paymentDate: "2026-03-11T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when paymentDate is missing", () => {
    expect(() =>
      debtPaymentCreateSchema.parse({
        amount: 25,
      }),
    ).toThrow();
  });
});

describe("[Unit] savingsGoalCreateSchema", () => {
  it("should coerce and trim a valid savings goal payload when optional fields use strings", () => {
    const result = savingsGoalCreateSchema.parse({
      name: " Holiday Fund ",
      targetAmount: "1500.25",
      targetDate: "2026-12-01T00:00:00.000Z",
      priority: "HIGH",
    });

    expect(result).toEqual({
      name: "Holiday Fund",
      targetAmount: 1500.25,
      targetDate: new Date("2026-12-01T00:00:00.000Z"),
      priority: "HIGH",
    });
  });

  it("should convert blank optional targetDate to undefined when it is an empty string", () => {
    const result = savingsGoalCreateSchema.parse({
      name: "Emergency Fund",
      targetAmount: 5000,
      targetDate: "   ",
    });

    expect(result.targetDate).toBeUndefined();
  });

  it("should reject the payload when targetAmount is zero", () => {
    expect(() =>
      savingsGoalCreateSchema.parse({
        name: "Emergency Fund",
        targetAmount: 0,
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when priority is not allowed", () => {
    expect(() =>
      savingsGoalCreateSchema.parse({
        name: "Emergency Fund",
        targetAmount: 100,
        priority: "URGENT",
      }),
    ).toThrow();
  });
});

describe("[Unit] savingsGoalUpdateSchema", () => {
  it("should accept a partial savings goal payload when one valid field is provided", () => {
    const result = savingsGoalUpdateSchema.parse({
      name: " House Deposit ",
    });

    expect(result).toEqual({
      name: "House Deposit",
    });
  });

  it("should preserve explicit nulls when nullable savings goal fields are cleared", () => {
    const result = savingsGoalUpdateSchema.parse({
      targetDate: null,
      priority: null,
    });

    expect(result).toEqual({
      targetDate: null,
      priority: null,
    });
  });

  it("should reject the payload when no fields remain after preprocessing", () => {
    expect(() =>
      savingsGoalUpdateSchema.parse({
        targetDate: "",
      }),
    ).toThrow("At least one field is required");
  });
});

describe("[Unit] savingsContributionCreateSchema", () => {
  it("should coerce and trim a valid contribution payload when the request uses strings", () => {
    const result = savingsContributionCreateSchema.parse({
      amount: "250.5",
      contributionDate: "2026-03-11T00:00:00.000Z",
      note: " Pay day ",
    });

    expect(result).toEqual({
      amount: 250.5,
      contributionDate: new Date("2026-03-11T00:00:00.000Z"),
      note: "Pay day",
    });
  });

  it("should reject the payload when amount is negative", () => {
    expect(() =>
      savingsContributionCreateSchema.parse({
        amount: -1,
        contributionDate: "2026-03-11T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when contributionDate is missing", () => {
    expect(() =>
      savingsContributionCreateSchema.parse({
        amount: 10,
      }),
    ).toThrow();
  });
});
