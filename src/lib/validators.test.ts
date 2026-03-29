import { describe, expect, it } from "vitest";
import {
  budgetListQuerySchema,
  budgetUpsertSchema,
  debtCreateSchema,
  debtPaymentCreateSchema,
  debtPaymentUpdateSchema,
  debtUpdateSchema,
  holidayCreateSchema,
  holidayExpenseCreateSchema,
  holidayExpenseUpdateSchema,
  holidayUpdateSchema,
  housingExpenseCreateSchema,
  housingExpenseListQuerySchema,
  housingExpenseRouteUpdateSchema,
  housingExpenseUpsertSchema,
  housingExpenseUpdateSchema,
  incomeDeductionCreateSchema,
  incomeDeductionUpdateSchema,
  incomeSourceCreateWithDeductionsSchema,
  incomeSourceCreateSchema,
  incomeSourceListQuerySchema,
  incomeSourceUpdateWithDeductionsSchema,
  incomeSourceUpdateSchema,
  savingsContributionCreateSchema,
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  settingsUpdateSchema,
  subscriptionCreateSchema,
  subscriptionUpdateSchema,
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
      interestAmount: "25.50",
      paymentDate: "2026-03-11T00:00:00.000Z",
      note: " March payment ",
    });

    expect(result).toEqual({
      amount: 125.5,
      interestAmount: 25.5,
      paymentDate: new Date("2026-03-11T00:00:00.000Z"),
      note: "March payment",
    });
  });

  it("should default interestAmount to zero when it is omitted", () => {
    const result = debtPaymentCreateSchema.parse({
      amount: 125.5,
      paymentDate: "2026-03-11T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      amount: 125.5,
      interestAmount: 0,
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

  it("should reject the payload when interestAmount exceeds amount", () => {
    expect(() =>
      debtPaymentCreateSchema.parse({
        amount: 25,
        interestAmount: 30,
        paymentDate: "2026-03-11T00:00:00.000Z",
      }),
    ).toThrow("Interest amount cannot exceed the payment amount");
  });
});

describe("[Unit] debtPaymentUpdateSchema", () => {
  it("should coerce and trim a valid payment payload when the request uses strings", () => {
    const result = debtPaymentUpdateSchema.parse({
      amount: "95.25",
      interestAmount: "10.25",
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: " Updated payment ",
    });

    expect(result).toEqual({
      amount: 95.25,
      interestAmount: 10.25,
      paymentDate: new Date("2026-03-15T00:00:00.000Z"),
      note: "Updated payment",
    });
  });

  it("should default interestAmount to zero when it is omitted", () => {
    const result = debtPaymentUpdateSchema.parse({
      amount: 95.25,
      paymentDate: "2026-03-15T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      amount: 95.25,
      interestAmount: 0,
    });
  });

  it("should convert a blank note to undefined when the note field is omitted by preprocessing", () => {
    const result = debtPaymentUpdateSchema.parse({
      amount: 95.25,
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: "   ",
    });

    expect(result.note).toBeUndefined();
  });

  it("should preserve explicit null when clearing an existing note", () => {
    const result = debtPaymentUpdateSchema.parse({
      amount: 95.25,
      paymentDate: "2026-03-15T00:00:00.000Z",
      note: null,
    });

    expect(result.note).toBeNull();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      debtPaymentUpdateSchema.parse({
        amount: 0,
        paymentDate: "2026-03-15T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when paymentDate is missing", () => {
    expect(() =>
      debtPaymentUpdateSchema.parse({
        amount: 25,
      }),
    ).toThrow();
  });

  it("should reject the payload when interestAmount exceeds amount", () => {
    expect(() =>
      debtPaymentUpdateSchema.parse({
        amount: 25,
        interestAmount: 30,
        paymentDate: "2026-03-15T00:00:00.000Z",
      }),
    ).toThrow("Interest amount cannot exceed the payment amount");
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

// ====== Housing Expense ======

describe("[Unit] housingExpenseCreateSchema", () => {
  it("should coerce a valid housing expense when the payload uses strings", () => {
    const result = housingExpenseCreateSchema.parse({
      expenseType: "RENT",
      amount: "850.00",
      expenseMonth: "2026-03-01T00:00:00.000Z",
      frequency: "MONTHLY",
    });

    expect(result).toEqual({
      expenseType: "RENT",
      amount: 850,
      expenseMonth: new Date("2026-03-01T00:00:00.000Z"),
      frequency: "MONTHLY",
    });
  });

  it("should accept all valid expense types when each is provided individually", () => {
    const types = [
      "RENT",
      "COUNCIL_TAX",
      "ENERGY",
      "WATER",
      "INTERNET",
      "INSURANCE",
      "MAINTENANCE",
      "OTHER",
    ];

    for (const expenseType of types) {
      const result = housingExpenseCreateSchema.parse({
        expenseType,
        amount: 100,
        expenseMonth: "2026-01-01T00:00:00.000Z",
        frequency: "MONTHLY",
      });

      expect(result.expenseType).toBe(expenseType);
    }
  });

  it("should accept YEARLY frequency when provided", () => {
    const result = housingExpenseCreateSchema.parse({
      expenseType: "INSURANCE",
      amount: 1200,
      expenseMonth: "2026-01-01T00:00:00.000Z",
      frequency: "YEARLY",
    });

    expect(result.frequency).toBe("YEARLY");
  });

  it("should reject the payload when expenseType is not allowed", () => {
    expect(() =>
      housingExpenseCreateSchema.parse({
        expenseType: "MORTGAGE",
        amount: 500,
        expenseMonth: "2026-01-01T00:00:00.000Z",
        frequency: "MONTHLY",
      }),
    ).toThrow();
  });

  it("should reject the payload when frequency is not allowed", () => {
    expect(() =>
      housingExpenseCreateSchema.parse({
        expenseType: "RENT",
        amount: 500,
        expenseMonth: "2026-01-01T00:00:00.000Z",
        frequency: "WEEKLY",
      }),
    ).toThrow();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      housingExpenseCreateSchema.parse({
        expenseType: "RENT",
        amount: 0,
        expenseMonth: "2026-01-01T00:00:00.000Z",
        frequency: "MONTHLY",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when amount is negative", () => {
    expect(() =>
      housingExpenseCreateSchema.parse({
        expenseType: "RENT",
        amount: -100,
        expenseMonth: "2026-01-01T00:00:00.000Z",
        frequency: "MONTHLY",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when expenseMonth is missing", () => {
    expect(() =>
      housingExpenseCreateSchema.parse({
        expenseType: "RENT",
        amount: 500,
        frequency: "MONTHLY",
      }),
    ).toThrow();
  });
});

describe("[Unit] housingExpenseUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = housingExpenseUpdateSchema.parse({
      amount: 900,
    });

    expect(result).toMatchObject({ amount: 900 });
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => housingExpenseUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when expenseType is invalid", () => {
    expect(() =>
      housingExpenseUpdateSchema.parse({
        expenseType: "MORTGAGE",
      }),
    ).toThrow();
  });
});

describe("[Unit] housingExpenseListQuerySchema", () => {
  it("should accept an empty query when no month filter is provided", () => {
    const result = housingExpenseListQuerySchema.parse({});

    expect(result).toEqual({});
  });

  it("should accept the query when month is in YYYY-MM format", () => {
    const result = housingExpenseListQuerySchema.parse({
      month: "2026-03",
    });

    expect(result).toEqual({
      month: "2026-03",
    });
  });

  it("should reject the query when month is not in YYYY-MM format", () => {
    expect(() =>
      housingExpenseListQuerySchema.parse({
        month: "2026-3",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });
});

describe("[Unit] housingExpenseUpsertSchema", () => {
  it("should coerce a valid housing upsert payload when amount uses a string", () => {
    const result = housingExpenseUpsertSchema.parse({
      expenseType: "ENERGY",
      month: "2026-03",
      amount: "125.50",
      frequency: "MONTHLY",
    });

    expect(result).toEqual({
      expenseType: "ENERGY",
      month: "2026-03",
      amount: 125.5,
      frequency: "MONTHLY",
    });
  });

  it("should reject the payload when month is invalid", () => {
    expect(() =>
      housingExpenseUpsertSchema.parse({
        expenseType: "ENERGY",
        month: "2026-13",
        amount: 125.5,
        frequency: "MONTHLY",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });

  it("should reject the payload when frequency is not allowed", () => {
    expect(() =>
      housingExpenseUpsertSchema.parse({
        expenseType: "ENERGY",
        month: "2026-03",
        amount: 125.5,
        frequency: "WEEKLY",
      }),
    ).toThrow();
  });
});

describe("[Unit] housingExpenseRouteUpdateSchema", () => {
  it("should accept a partial payload when month is provided in YYYY-MM format", () => {
    const result = housingExpenseRouteUpdateSchema.parse({
      month: "2026-04",
    });

    expect(result).toEqual({
      month: "2026-04",
    });
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => housingExpenseRouteUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when month is not in YYYY-MM format", () => {
    expect(() =>
      housingExpenseRouteUpdateSchema.parse({
        month: "2026-4",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });
});

// ====== Subscription ======

describe("[Unit] subscriptionCreateSchema", () => {
  it("should coerce and trim a valid subscription when the payload uses strings", () => {
    const result = subscriptionCreateSchema.parse({
      name: " Netflix ",
      amount: "15.99",
      frequency: "MONTHLY",
      nextPaymentDate: "2026-04-01T00:00:00.000Z",
      description: " Streaming service ",
    });

    expect(result).toEqual({
      name: "Netflix",
      amount: 15.99,
      frequency: "MONTHLY",
      nextPaymentDate: new Date("2026-04-01T00:00:00.000Z"),
      description: "Streaming service",
    });
  });

  it("should convert blank description to undefined when it is an empty string", () => {
    const result = subscriptionCreateSchema.parse({
      name: "Spotify",
      amount: 9.99,
      frequency: "MONTHLY",
      nextPaymentDate: "2026-04-01T00:00:00.000Z",
      description: "   ",
    });

    expect(result.description).toBeUndefined();
  });

  it("should accept YEARLY frequency when provided", () => {
    const result = subscriptionCreateSchema.parse({
      name: "Annual License",
      amount: 120,
      frequency: "YEARLY",
      nextPaymentDate: "2027-01-01T00:00:00.000Z",
    });

    expect(result.frequency).toBe("YEARLY");
  });

  it("should reject the payload when name is blank", () => {
    expect(() =>
      subscriptionCreateSchema.parse({
        name: "   ",
        amount: 10,
        frequency: "MONTHLY",
        nextPaymentDate: "2026-04-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      subscriptionCreateSchema.parse({
        name: "Test",
        amount: 0,
        frequency: "MONTHLY",
        nextPaymentDate: "2026-04-01T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when frequency is not allowed", () => {
    expect(() =>
      subscriptionCreateSchema.parse({
        name: "Test",
        amount: 10,
        frequency: "QUARTERLY",
        nextPaymentDate: "2026-04-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when nextPaymentDate is missing", () => {
    expect(() =>
      subscriptionCreateSchema.parse({
        name: "Test",
        amount: 10,
        frequency: "MONTHLY",
      }),
    ).toThrow();
  });
});

describe("[Unit] subscriptionUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = subscriptionUpdateSchema.parse({
      name: " Updated Name ",
    });

    expect(result).toMatchObject({ name: "Updated Name" });
  });

  it("should preserve explicit null for description when clearing it", () => {
    const result = subscriptionUpdateSchema.parse({
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it("should accept isActive as a valid update field", () => {
    const result = subscriptionUpdateSchema.parse({
      isActive: false,
    });

    expect(result).toMatchObject({ isActive: false });
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => subscriptionUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional fields are the only values provided", () => {
    expect(() =>
      subscriptionUpdateSchema.parse({
        description: "   ",
      }),
    ).toThrow("At least one field is required");
  });
});

// ====== Income Source ======

describe("[Unit] incomeSourceCreateSchema", () => {
  it("should coerce and trim a valid income source when the payload uses strings", () => {
    const result = incomeSourceCreateSchema.parse({
      incomeType: "SALARY",
      description: " Monthly pay ",
      grossAmount: "3500.00",
      netAmount: "2800.00",
      incomeDate: "2026-03-25T00:00:00.000Z",
      isRecurring: true,
      recurrenceFrequency: "MONTHLY",
    });

    expect(result).toEqual({
      incomeType: "SALARY",
      description: "Monthly pay",
      grossAmount: 3500,
      netAmount: 2800,
      incomeDate: new Date("2026-03-25T00:00:00.000Z"),
      isRecurring: true,
      recurrenceFrequency: "MONTHLY",
    });
  });

  it("should accept all valid income types when each is provided individually", () => {
    const types = ["SALARY", "BONUS", "GIFT", "FREELANCE", "OTHER"];

    for (const incomeType of types) {
      const result = incomeSourceCreateSchema.parse({
        incomeType,
        grossAmount: 1000,
        netAmount: 800,
        incomeDate: "2026-01-01T00:00:00.000Z",
      });

      expect(result.incomeType).toBe(incomeType);
    }
  });

  it("should accept all valid recurrence frequencies when each is provided", () => {
    const frequencies = ["MONTHLY", "WEEKLY", "ANNUALLY"];

    for (const recurrenceFrequency of frequencies) {
      const result = incomeSourceCreateSchema.parse({
        incomeType: "SALARY",
        grossAmount: 1000,
        netAmount: 800,
        incomeDate: "2026-01-01T00:00:00.000Z",
        recurrenceFrequency,
      });

      expect(result.recurrenceFrequency).toBe(recurrenceFrequency);
    }
  });

  it("should convert blank description to undefined when it is an empty string", () => {
    const result = incomeSourceCreateSchema.parse({
      incomeType: "BONUS",
      grossAmount: 500,
      netAmount: 400,
      incomeDate: "2026-03-01T00:00:00.000Z",
      description: "   ",
    });

    expect(result.description).toBeUndefined();
  });

  it("should convert blank recurrenceFrequency to undefined when it is an empty string", () => {
    const result = incomeSourceCreateSchema.parse({
      incomeType: "SALARY",
      grossAmount: 3000,
      netAmount: 2400,
      incomeDate: "2026-03-01T00:00:00.000Z",
      recurrenceFrequency: "",
    });

    expect(result.recurrenceFrequency).toBeUndefined();
  });

  it("should reject the payload when incomeType is not allowed", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({
        incomeType: "DIVIDEND",
        grossAmount: 100,
        netAmount: 100,
        incomeDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when grossAmount is zero", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({
        incomeType: "SALARY",
        grossAmount: 0,
        netAmount: 0,
        incomeDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when netAmount is negative", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({
        incomeType: "SALARY",
        grossAmount: 1000,
        netAmount: -100,
        incomeDate: "2026-01-01T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when recurrenceFrequency is not allowed", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({
        incomeType: "SALARY",
        grossAmount: 1000,
        netAmount: 800,
        incomeDate: "2026-01-01T00:00:00.000Z",
        recurrenceFrequency: "QUARTERLY",
      }),
    ).toThrow();
  });

  it("should reject the payload when incomeDate is missing", () => {
    expect(() =>
      incomeSourceCreateSchema.parse({
        incomeType: "SALARY",
        grossAmount: 1000,
        netAmount: 800,
      }),
    ).toThrow();
  });
});

describe("[Unit] incomeSourceUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = incomeSourceUpdateSchema.parse({
      grossAmount: 4000,
    });

    expect(result).toMatchObject({ grossAmount: 4000 });
  });

  it("should preserve explicit null for description when clearing it", () => {
    const result = incomeSourceUpdateSchema.parse({
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it("should preserve explicit null for recurrenceFrequency when clearing it", () => {
    const result = incomeSourceUpdateSchema.parse({
      recurrenceFrequency: null,
    });

    expect(result.recurrenceFrequency).toBeNull();
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => incomeSourceUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional fields are the only values provided", () => {
    expect(() =>
      incomeSourceUpdateSchema.parse({
        description: "   ",
        recurrenceFrequency: "",
      }),
    ).toThrow("At least one field is required");
  });
});

describe("[Unit] incomeSourceListQuerySchema", () => {
  it("should accept a valid month filter when it is provided", () => {
    const result = incomeSourceListQuerySchema.parse({
      month: "2026-03",
    });

    expect(result).toEqual({
      month: "2026-03",
    });
  });

  it("should reject the query when the month is not in YYYY-MM format", () => {
    expect(() =>
      incomeSourceListQuerySchema.parse({
        month: "2026-3",
      }),
    ).toThrow("Month must be in YYYY-MM format");
  });
});

describe("[Unit] incomeSourceCreateWithDeductionsSchema", () => {
  it("should parse nested deductions when the payload contains an income source with deductions", () => {
    const result = incomeSourceCreateWithDeductionsSchema.parse({
      incomeType: "SALARY",
      description: " Monthly pay ",
      grossAmount: "3500",
      netAmount: "2750",
      incomeDate: "2026-03-31T00:00:00.000Z",
      deductions: [
        {
          deductionType: "INCOME_TAX",
          name: " Income Tax ",
          amount: "500",
        },
      ],
    });

    expect(result).toEqual({
      incomeType: "SALARY",
      description: "Monthly pay",
      grossAmount: 3500,
      netAmount: 2750,
      incomeDate: new Date("2026-03-31T00:00:00.000Z"),
      deductions: [
        {
          deductionType: "INCOME_TAX",
          name: "Income Tax",
          amount: 500,
        },
      ],
    });
  });

  it("should reject the payload when a nested deduction is invalid", () => {
    expect(() =>
      incomeSourceCreateWithDeductionsSchema.parse({
        incomeType: "SALARY",
        grossAmount: 3500,
        netAmount: 2750,
        incomeDate: "2026-03-31T00:00:00.000Z",
        deductions: [
          {
            deductionType: "INCOME_TAX",
            name: "Tax",
            amount: 0,
          },
        ],
      }),
    ).toThrow("Too small");
  });

  it("should accept ONE_OFF as a recurrence frequency when the income payload is non-recurring by schedule", () => {
    const result = incomeSourceCreateWithDeductionsSchema.parse({
      incomeType: "BONUS",
      grossAmount: "1200",
      netAmount: "1200",
      incomeDate: "2026-03-31T00:00:00.000Z",
      isRecurring: true,
      recurrenceFrequency: "ONE_OFF",
      deductions: [],
    });

    expect(result.recurrenceFrequency).toBe("ONE_OFF");
  });
});

describe("[Unit] incomeSourceUpdateWithDeductionsSchema", () => {
  it("should accept a deductions-only payload when the replacement array is provided", () => {
    const result = incomeSourceUpdateWithDeductionsSchema.parse({
      deductions: [
        {
          deductionType: "PENSION",
          name: " Pension ",
          amount: "150",
        },
      ],
    });

    expect(result).toEqual({
      deductions: [
        {
          deductionType: "PENSION",
          name: "Pension",
          amount: 150,
        },
      ],
    });
  });

  it("should preserve explicit null when recurrenceFrequency is cleared", () => {
    const result = incomeSourceUpdateWithDeductionsSchema.parse({
      recurrenceFrequency: null,
    });

    expect(result.recurrenceFrequency).toBeNull();
  });

  it("should reject the payload when no update fields are provided", () => {
    expect(() => incomeSourceUpdateWithDeductionsSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should accept ONE_OFF when recurrence frequency is updated", () => {
    const result = incomeSourceUpdateWithDeductionsSchema.parse({
      recurrenceFrequency: "ONE_OFF",
    });

    expect(result.recurrenceFrequency).toBe("ONE_OFF");
  });
});

// ====== Income Deduction ======

describe("[Unit] incomeDeductionCreateSchema", () => {
  it("should coerce and trim a valid deduction when the payload uses strings", () => {
    const result = incomeDeductionCreateSchema.parse({
      deductionType: "INCOME_TAX",
      name: " Income Tax ",
      amount: "450.00",
      isPercentage: false,
    });

    expect(result).toEqual({
      deductionType: "INCOME_TAX",
      name: "Income Tax",
      amount: 450,
      isPercentage: false,
      percentageValue: undefined,
    });
  });

  it("should accept all valid deduction types when each is provided individually", () => {
    const types = ["INCOME_TAX", "NI", "PENSION", "STUDENT_LOAN", "OTHER"];

    for (const deductionType of types) {
      const result = incomeDeductionCreateSchema.parse({
        deductionType,
        name: "Test",
        amount: 100,
      });

      expect(result.deductionType).toBe(deductionType);
    }
  });

  it("should accept a percentage deduction when isPercentage and percentageValue are provided", () => {
    const result = incomeDeductionCreateSchema.parse({
      deductionType: "PENSION",
      name: "Employer Pension",
      amount: "175",
      isPercentage: true,
      percentageValue: "5",
    });

    expect(result.isPercentage).toBe(true);
    expect(result.percentageValue).toBe(5);
  });

  it("should convert blank percentageValue to undefined when it is an empty string", () => {
    const result = incomeDeductionCreateSchema.parse({
      deductionType: "NI",
      name: "National Insurance",
      amount: 200,
      percentageValue: "",
    });

    expect(result.percentageValue).toBeUndefined();
  });

  it("should reject the payload when deductionType is not allowed", () => {
    expect(() =>
      incomeDeductionCreateSchema.parse({
        deductionType: "CHARITY",
        name: "Donation",
        amount: 50,
      }),
    ).toThrow();
  });

  it("should reject the payload when name is blank", () => {
    expect(() =>
      incomeDeductionCreateSchema.parse({
        deductionType: "OTHER",
        name: "   ",
        amount: 50,
      }),
    ).toThrow();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      incomeDeductionCreateSchema.parse({
        deductionType: "INCOME_TAX",
        name: "Tax",
        amount: 0,
      }),
    ).toThrow("Too small");
  });
});

describe("[Unit] incomeDeductionUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = incomeDeductionUpdateSchema.parse({
      amount: 500,
    });

    expect(result).toMatchObject({ amount: 500 });
  });

  it("should preserve explicit null for percentageValue when clearing it", () => {
    const result = incomeDeductionUpdateSchema.parse({
      percentageValue: null,
    });

    expect(result.percentageValue).toBeNull();
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => incomeDeductionUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });
});

// ====== Holiday ======

describe("[Unit] holidayCreateSchema", () => {
  it("should coerce and trim a valid holiday when the payload uses strings", () => {
    const result = holidayCreateSchema.parse({
      name: " Summer Trip ",
      destination: " Barcelona ",
      startDate: "2026-07-15T00:00:00.000Z",
      endDate: "2026-07-22T00:00:00.000Z",
      description: " Week in Spain ",
    });

    expect(result).toEqual({
      name: "Summer Trip",
      destination: "Barcelona",
      startDate: new Date("2026-07-15T00:00:00.000Z"),
      endDate: new Date("2026-07-22T00:00:00.000Z"),
      description: "Week in Spain",
    });
  });

  it("should accept the payload when startDate and endDate are the same day trip", () => {
    const result = holidayCreateSchema.parse({
      name: "Day Trip",
      destination: "Brighton",
      startDate: "2026-08-01T00:00:00.000Z",
      endDate: "2026-08-01T00:00:00.000Z",
    });

    expect(result.startDate).toEqual(result.endDate);
  });

  it("should convert blank description to undefined when it is an empty string", () => {
    const result = holidayCreateSchema.parse({
      name: "Trip",
      destination: "Paris",
      startDate: "2026-06-01T00:00:00.000Z",
      endDate: "2026-06-05T00:00:00.000Z",
      description: "   ",
    });

    expect(result.description).toBeUndefined();
  });

  it("should reject the payload when endDate is before startDate", () => {
    expect(() =>
      holidayCreateSchema.parse({
        name: "Trip",
        destination: "Paris",
        startDate: "2026-07-22T00:00:00.000Z",
        endDate: "2026-07-15T00:00:00.000Z",
      }),
    ).toThrow("End date must be on or after start date");
  });

  it("should reject the payload when name is blank", () => {
    expect(() =>
      holidayCreateSchema.parse({
        name: "   ",
        destination: "Paris",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-05T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when destination is blank", () => {
    expect(() =>
      holidayCreateSchema.parse({
        name: "Trip",
        destination: "   ",
        startDate: "2026-06-01T00:00:00.000Z",
        endDate: "2026-06-05T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when startDate is missing", () => {
    expect(() =>
      holidayCreateSchema.parse({
        name: "Trip",
        destination: "Paris",
        endDate: "2026-06-05T00:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("[Unit] holidayUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = holidayUpdateSchema.parse({
      destination: " Rome ",
    });

    expect(result).toMatchObject({ destination: "Rome" });
  });

  it("should preserve explicit null for description when clearing it", () => {
    const result = holidayUpdateSchema.parse({
      description: null,
    });

    expect(result.description).toBeNull();
  });

  it("should accept isActive as a valid update field", () => {
    const result = holidayUpdateSchema.parse({
      isActive: false,
    });

    expect(result).toMatchObject({ isActive: false });
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => holidayUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional fields are the only values provided", () => {
    expect(() =>
      holidayUpdateSchema.parse({
        description: "   ",
      }),
    ).toThrow("At least one field is required");
  });

  it("should reject the payload when endDate is before startDate", () => {
    expect(() =>
      holidayUpdateSchema.parse({
        startDate: "2026-07-22T00:00:00.000Z",
        endDate: "2026-07-15T00:00:00.000Z",
      }),
    ).toThrow("End date must be on or after start date");
  });
});

// ====== Holiday Expense ======

describe("[Unit] holidayExpenseCreateSchema", () => {
  it("should coerce and trim a valid holiday expense when the payload uses strings", () => {
    const result = holidayExpenseCreateSchema.parse({
      expenseType: "FLIGHT",
      description: " Return flights to Barcelona ",
      amount: "245.50",
      expenseDate: "2026-07-15T00:00:00.000Z",
      notes: " Booked via Skyscanner ",
    });

    expect(result).toEqual({
      expenseType: "FLIGHT",
      description: "Return flights to Barcelona",
      amount: 245.5,
      expenseDate: new Date("2026-07-15T00:00:00.000Z"),
      notes: "Booked via Skyscanner",
    });
  });

  it("should accept all valid expense types when each is provided individually", () => {
    const types = [
      "FLIGHT",
      "ACCOMMODATION",
      "FOOD",
      "TRANSPORT",
      "ACTIVITY",
      "SHOPPING",
      "OTHER",
    ];

    for (const expenseType of types) {
      const result = holidayExpenseCreateSchema.parse({
        expenseType,
        description: "Test expense",
        amount: 50,
        expenseDate: "2026-07-15T00:00:00.000Z",
      });

      expect(result.expenseType).toBe(expenseType);
    }
  });

  it("should convert blank notes to undefined when it is an empty string", () => {
    const result = holidayExpenseCreateSchema.parse({
      expenseType: "FOOD",
      description: "Dinner",
      amount: 35,
      expenseDate: "2026-07-16T00:00:00.000Z",
      notes: "   ",
    });

    expect(result.notes).toBeUndefined();
  });

  it("should reject the payload when expenseType is not allowed", () => {
    expect(() =>
      holidayExpenseCreateSchema.parse({
        expenseType: "VISA",
        description: "Travel visa",
        amount: 80,
        expenseDate: "2026-07-01T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when description is blank", () => {
    expect(() =>
      holidayExpenseCreateSchema.parse({
        expenseType: "FOOD",
        description: "   ",
        amount: 20,
        expenseDate: "2026-07-16T00:00:00.000Z",
      }),
    ).toThrow();
  });

  it("should reject the payload when amount is zero", () => {
    expect(() =>
      holidayExpenseCreateSchema.parse({
        expenseType: "FOOD",
        description: "Lunch",
        amount: 0,
        expenseDate: "2026-07-16T00:00:00.000Z",
      }),
    ).toThrow("Too small");
  });

  it("should reject the payload when expenseDate is missing", () => {
    expect(() =>
      holidayExpenseCreateSchema.parse({
        expenseType: "FOOD",
        description: "Lunch",
        amount: 15,
      }),
    ).toThrow();
  });
});

describe("[Unit] holidayExpenseUpdateSchema", () => {
  it("should accept a partial payload when one valid field is provided", () => {
    const result = holidayExpenseUpdateSchema.parse({
      amount: 300,
    });

    expect(result).toMatchObject({ amount: 300 });
  });

  it("should preserve explicit null for notes when clearing it", () => {
    const result = holidayExpenseUpdateSchema.parse({
      notes: null,
    });

    expect(result.notes).toBeNull();
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => holidayExpenseUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when blank optional fields are the only values provided", () => {
    expect(() =>
      holidayExpenseUpdateSchema.parse({
        notes: "   ",
      }),
    ).toThrow("At least one field is required");
  });
});

// ====== Settings ======

describe("[Unit] settingsUpdateSchema", () => {
  it("should accept a valid settings update when currency is provided", () => {
    const result = settingsUpdateSchema.parse({
      currency: "USD",
    });

    expect(result).toMatchObject({ currency: "USD" });
  });

  it("should accept a valid settings update when locale is provided", () => {
    const result = settingsUpdateSchema.parse({
      locale: "en-US",
    });

    expect(result).toMatchObject({ locale: "en-US" });
  });

  it("should accept a valid settings update when monthlyBudgetTotal is provided", () => {
    const result = settingsUpdateSchema.parse({
      monthlyBudgetTotal: "2500.00",
    });

    expect(result).toMatchObject({ monthlyBudgetTotal: 2500 });
  });

  it("should accept multiple fields when currency and locale are updated together", () => {
    const result = settingsUpdateSchema.parse({
      currency: "EUR",
      locale: "de-DE",
      monthlyBudgetTotal: 3000,
    });

    expect(result).toEqual({
      currency: "EUR",
      locale: "de-DE",
      monthlyBudgetTotal: 3000,
    });
  });

  it("should preserve explicit null for monthlyBudgetTotal when clearing it", () => {
    const result = settingsUpdateSchema.parse({
      monthlyBudgetTotal: null,
    });

    expect(result.monthlyBudgetTotal).toBeNull();
  });

  it("should reject the payload when no fields are provided", () => {
    expect(() => settingsUpdateSchema.parse({})).toThrow(
      "At least one field is required",
    );
  });

  it("should reject the payload when currency is blank", () => {
    expect(() =>
      settingsUpdateSchema.parse({
        currency: "   ",
      }),
    ).toThrow();
  });

  it("should reject the payload when locale is blank", () => {
    expect(() =>
      settingsUpdateSchema.parse({
        locale: "   ",
      }),
    ).toThrow();
  });

  it("should reject the payload when monthlyBudgetTotal is negative", () => {
    expect(() =>
      settingsUpdateSchema.parse({
        monthlyBudgetTotal: -100,
      }),
    ).toThrow("Too small");
  });

  it("should accept the payload when monthlyBudgetTotal is zero", () => {
    const result = settingsUpdateSchema.parse({
      monthlyBudgetTotal: 0,
    });

    expect(result.monthlyBudgetTotal).toBe(0);
  });
});
