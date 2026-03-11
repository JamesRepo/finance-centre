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

export type TransactionCreateInput = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdateInput = z.infer<typeof transactionUpdateSchema>;
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;
export type BudgetListQuery = z.infer<typeof budgetListQuerySchema>;
export type BudgetUpsertInput = z.infer<typeof budgetUpsertSchema>;
