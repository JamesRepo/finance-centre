import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const optionalTrimmedString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);

export const transactionCreateSchema = z.object({
  amount: z.coerce.number().positive(),
  transactionDate: z.coerce.date(),
  description: optionalTrimmedString,
  vendor: optionalTrimmedString,
  categoryId: z.string().trim().min(1),
});

export const transactionUpdateSchema = z
  .object({
    amount: z.coerce.number().positive().optional(),
    transactionDate: z.coerce.date().optional(),
    description: optionalTrimmedString,
    vendor: optionalTrimmedString,
    categoryId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const transactionListQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format")
    .optional(),
  categoryId: z.string().trim().min(1).optional(),
});

export const budgetMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format");

export const budgetListQuerySchema = z.object({
  month: budgetMonthSchema,
});

export const budgetUpsertSchema = z.object({
  categoryId: z.string().trim().min(1),
  month: budgetMonthSchema,
  amount: z.coerce.number().nonnegative(),
});

const debtTypeSchema = z.enum([
  "CREDIT_CARD",
  "STUDENT_LOAN",
  "PERSONAL_LOAN",
  "OTHER",
]);

const savingsPrioritySchema = z.enum([
  "LOW",
  "MEDIUM",
  "HIGH",
]);

const optionalNonnegativeNumber = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().nonnegative().optional(),
);

const optionalDate = z.preprocess(
  emptyStringToUndefined,
  z.coerce.date().optional(),
);

const nullableOptionalTrimmedString = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  return emptyStringToUndefined(value);
}, z.string().trim().min(1).nullable().optional());

const nullableOptionalNonnegativeNumber = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  return emptyStringToUndefined(value);
}, z.coerce.number().nonnegative().nullable().optional());

const nullableOptionalDate = z.preprocess((value) => {
  if (value === null) {
    return null;
  }

  return emptyStringToUndefined(value);
}, z.coerce.date().nullable().optional());

export const debtCreateSchema = z.object({
  name: z.string().trim().min(1),
  debtType: debtTypeSchema,
  originalBalance: z.coerce.number().positive(),
  interestRate: z.coerce.number().nonnegative(),
  minimumPayment: optionalNonnegativeNumber,
  startDate: optionalDate,
  targetPayoffDate: optionalDate,
  isActive: z.boolean().optional(),
  notes: optionalTrimmedString,
});

export const debtUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    debtType: debtTypeSchema.optional(),
    originalBalance: z.coerce.number().positive().optional(),
    interestRate: z.coerce.number().nonnegative().optional(),
    minimumPayment: nullableOptionalNonnegativeNumber,
    startDate: nullableOptionalDate,
    targetPayoffDate: nullableOptionalDate,
    isActive: z.boolean().optional(),
    notes: nullableOptionalTrimmedString,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const debtPaymentCreateSchema = z.object({
  amount: z.coerce.number().positive(),
  interestAmount: optionalNonnegativeNumber.transform((value) => value ?? 0),
  paymentDate: z.coerce.date(),
  note: optionalTrimmedString,
}).refine((value) => value.interestAmount <= value.amount, {
  message: "Interest amount cannot exceed the payment amount",
  path: ["interestAmount"],
});

export const savingsGoalCreateSchema = z.object({
  name: z.string().trim().min(1),
  targetAmount: z.coerce.number().positive(),
  targetDate: optionalDate,
  priority: savingsPrioritySchema.optional(),
});

export const savingsGoalUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    targetAmount: z.coerce.number().positive().optional(),
    targetDate: nullableOptionalDate,
    priority: savingsPrioritySchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const savingsContributionCreateSchema = z.object({
  amount: z.coerce.number().positive(),
  contributionDate: z.coerce.date(),
  note: optionalTrimmedString,
});

// --- Housing Expense ---

const housingExpenseTypeSchema = z.enum([
  "RENT",
  "COUNCIL_TAX",
  "ENERGY",
  "WATER",
  "INTERNET",
  "INSURANCE",
  "MAINTENANCE",
  "OTHER",
]);

const paymentFrequencySchema = z.enum(["MONTHLY", "YEARLY"]);

export const housingExpenseCreateSchema = z.object({
  expenseType: housingExpenseTypeSchema,
  amount: z.coerce.number().positive(),
  expenseMonth: z.coerce.date(),
  frequency: paymentFrequencySchema,
});

export const housingExpenseListQuerySchema = z.object({
  month: budgetMonthSchema.optional(),
});

export const housingExpenseUpsertSchema = z.object({
  expenseType: housingExpenseTypeSchema,
  month: budgetMonthSchema,
  amount: z.coerce.number().positive(),
  frequency: paymentFrequencySchema,
});

export const housingExpenseRouteUpdateSchema = z
  .object({
    expenseType: housingExpenseTypeSchema.optional(),
    month: budgetMonthSchema.optional(),
    amount: z.coerce.number().positive().optional(),
    frequency: paymentFrequencySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const housingExpenseUpdateSchema = z
  .object({
    expenseType: housingExpenseTypeSchema.optional(),
    amount: z.coerce.number().positive().optional(),
    expenseMonth: z.coerce.date().optional(),
    frequency: paymentFrequencySchema.optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Subscription ---

export const subscriptionCreateSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  frequency: paymentFrequencySchema,
  nextPaymentDate: z.coerce.date(),
  description: optionalTrimmedString,
  isActive: z.boolean().optional(),
});

export const subscriptionUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    frequency: paymentFrequencySchema.optional(),
    nextPaymentDate: z.coerce.date().optional(),
    description: nullableOptionalTrimmedString,
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Income Source ---

const incomeTypeSchema = z.enum([
  "SALARY",
  "BONUS",
  "GIFT",
  "FREELANCE",
  "OTHER",
]);

const recurrenceFrequencySchema = z.enum(["MONTHLY", "WEEKLY", "ANNUALLY"]);

export const incomeSourceCreateSchema = z.object({
  incomeType: incomeTypeSchema,
  description: optionalTrimmedString,
  grossAmount: z.coerce.number().positive(),
  netAmount: z.coerce.number().positive(),
  incomeDate: z.coerce.date(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.preprocess(
    emptyStringToUndefined,
    recurrenceFrequencySchema.optional(),
  ),
  isActive: z.boolean().optional(),
});

export const incomeSourceListQuerySchema = z.object({
  month: budgetMonthSchema.optional(),
});

export const incomeSourceUpdateSchema = z
  .object({
    incomeType: incomeTypeSchema.optional(),
    description: nullableOptionalTrimmedString,
    grossAmount: z.coerce.number().positive().optional(),
    netAmount: z.coerce.number().positive().optional(),
    incomeDate: z.coerce.date().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceFrequency: z.preprocess((value) => {
      if (value === null) return null;
      return emptyStringToUndefined(value);
    }, recurrenceFrequencySchema.nullable().optional()),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Income Deduction ---

const deductionTypeSchema = z.enum([
  "INCOME_TAX",
  "NI",
  "PENSION",
  "STUDENT_LOAN",
  "OTHER",
]);

export const incomeDeductionCreateSchema = z.object({
  deductionType: deductionTypeSchema,
  name: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  isPercentage: z.boolean().optional(),
  percentageValue: optionalNonnegativeNumber,
  isActive: z.boolean().optional(),
});

export const incomeDeductionUpdateSchema = z
  .object({
    deductionType: deductionTypeSchema.optional(),
    name: z.string().trim().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    isPercentage: z.boolean().optional(),
    percentageValue: nullableOptionalNonnegativeNumber,
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

export const incomeSourceCreateWithDeductionsSchema = incomeSourceCreateSchema.extend({
  deductions: z.array(incomeDeductionCreateSchema).optional(),
});

export const incomeSourceUpdateWithDeductionsSchema = z
  .object({
    incomeType: incomeTypeSchema.optional(),
    description: nullableOptionalTrimmedString,
    grossAmount: z.coerce.number().positive().optional(),
    netAmount: z.coerce.number().positive().optional(),
    incomeDate: z.coerce.date().optional(),
    isRecurring: z.boolean().optional(),
    recurrenceFrequency: z.preprocess((value) => {
      if (value === null) return null;
      return emptyStringToUndefined(value);
    }, recurrenceFrequencySchema.nullable().optional()),
    isActive: z.boolean().optional(),
    deductions: z.array(incomeDeductionCreateSchema).optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Holiday ---

export const holidayCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    destination: z.string().trim().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    description: optionalTrimmedString,
    isActive: z.boolean().optional(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export const holidayUpdateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    destination: z.string().trim().min(1).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    description: nullableOptionalTrimmedString,
    isActive: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate >= value.startDate,
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    },
  )
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Holiday Expense ---

const holidayExpenseTypeSchema = z.enum([
  "FLIGHT",
  "ACCOMMODATION",
  "FOOD",
  "TRANSPORT",
  "ACTIVITY",
  "SHOPPING",
  "OTHER",
]);

export const holidayExpenseCreateSchema = z.object({
  expenseType: holidayExpenseTypeSchema,
  description: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  expenseDate: z.coerce.date(),
  notes: optionalTrimmedString,
});

export const holidayExpenseUpdateSchema = z
  .object({
    expenseType: holidayExpenseTypeSchema.optional(),
    description: z.string().trim().min(1).optional(),
    amount: z.coerce.number().positive().optional(),
    expenseDate: z.coerce.date().optional(),
    notes: nullableOptionalTrimmedString,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Settings ---

export const settingsUpdateSchema = z
  .object({
    currency: z.string().trim().min(1).optional(),
    locale: z.string().trim().min(1).optional(),
    monthlyBudgetTotal: nullableOptionalNonnegativeNumber,
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one field is required",
  });

// --- Type Exports ---

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;
export type BudgetUpsertInput = z.infer<typeof budgetUpsertSchema>;
export type DebtCreateInput = z.infer<typeof debtCreateSchema>;
export type DebtUpdateInput = z.infer<typeof debtUpdateSchema>;
export type DebtPaymentCreateInput = z.infer<typeof debtPaymentCreateSchema>;
export type SavingsGoalCreateInput = z.infer<typeof savingsGoalCreateSchema>;
export type SavingsGoalUpdateInput = z.infer<typeof savingsGoalUpdateSchema>;
export type SavingsContributionCreateInput = z.infer<typeof savingsContributionCreateSchema>;
export type HousingExpenseListQuery = z.infer<typeof housingExpenseListQuerySchema>;
export type HousingExpenseUpsertInput = z.infer<typeof housingExpenseUpsertSchema>;
export type HousingExpenseRouteUpdateInput = z.infer<typeof housingExpenseRouteUpdateSchema>;
export type HousingExpenseCreateInput = z.infer<typeof housingExpenseCreateSchema>;
export type HousingExpenseUpdateInput = z.infer<typeof housingExpenseUpdateSchema>;
export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
export type IncomeSourceCreateInput = z.infer<typeof incomeSourceCreateSchema>;
export type IncomeSourceListQuery = z.infer<typeof incomeSourceListQuerySchema>;
export type IncomeSourceUpdateInput = z.infer<typeof incomeSourceUpdateSchema>;
export type IncomeDeductionCreateInput = z.infer<typeof incomeDeductionCreateSchema>;
export type IncomeDeductionUpdateInput = z.infer<typeof incomeDeductionUpdateSchema>;
export type IncomeSourceCreateWithDeductionsInput = z.infer<typeof incomeSourceCreateWithDeductionsSchema>;
export type IncomeSourceUpdateWithDeductionsInput = z.infer<typeof incomeSourceUpdateWithDeductionsSchema>;
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;
export type HolidayUpdateInput = z.infer<typeof holidayUpdateSchema>;
export type HolidayExpenseCreateInput = z.infer<typeof holidayExpenseCreateSchema>;
export type HolidayExpenseUpdateInput = z.infer<typeof holidayExpenseUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
