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
  paymentDate: z.coerce.date(),
  note: optionalTrimmedString,
});

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;
export type BudgetUpsertInput = z.infer<typeof budgetUpsertSchema>;
export type DebtCreateInput = z.infer<typeof debtCreateSchema>;
export type DebtUpdateInput = z.infer<typeof debtUpdateSchema>;
export type DebtPaymentCreateInput = z.infer<typeof debtPaymentCreateSchema>;
