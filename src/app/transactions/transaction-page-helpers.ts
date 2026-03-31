import { format, parseISO } from "date-fns";

type ApiError = {
  error?: string;
};

export type TransactionSubmissionInput = {
  categoryId: string;
  transactionDate: string;
  description?: string;
  vendor?: string;
  amount?: number;
  lineItems?: Array<{ amount: number }>;
};

export async function fetchVendorSuggestions(
  query: string,
  fetchImpl: typeof fetch = fetch,
) {
  try {
    const searchParams = new URLSearchParams();

    if (query.trim()) {
      searchParams.set("q", query.trim());
    }

    const response = await fetchImpl(
      `/api/transactions/vendors?${searchParams.toString()}`,
      {
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(await readApiError(response, "Failed to load vendors"));
    }

    return {
      ok: true as const,
      vendors: (await response.json()) as string[],
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to load vendors",
    };
  }
}

export async function readApiError(
  response: Response,
  fallbackMessage: string,
) {
  try {
    const body = (await response.json()) as ApiError;
    return body.error ?? fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export async function createTransactionRequest(
  values: TransactionSubmissionInput,
  fetchImpl: typeof fetch = fetch,
) {
  try {
    const response = await fetchImpl("/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        categoryId: values.categoryId,
        amount: values.amount,
        lineItems: values.lineItems,
        transactionDate: `${values.transactionDate}T00:00:00.000Z`,
        description: values.description,
        vendor: values.vendor,
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        error: await readApiError(response, "Failed to create transaction"),
      };
    }

    return {
      ok: true as const,
      submittedMonth: values.transactionDate.slice(0, 7),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to create transaction",
    };
  }
}

export async function updateTransactionRequest(
  id: string,
  values: TransactionSubmissionInput,
  fetchImpl: typeof fetch = fetch,
) {
  try {
    const response = await fetchImpl(`/api/transactions/${id}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        categoryId: values.categoryId,
        amount: values.amount,
        lineItems: values.lineItems,
        transactionDate: `${values.transactionDate}T00:00:00.000Z`,
        description: values.description,
        vendor: values.vendor,
      }),
    });

    if (!response.ok) {
      return {
        ok: false as const,
        error: await readApiError(response, "Failed to update transaction"),
      };
    }

    return {
      ok: true as const,
      submittedMonth: values.transactionDate.slice(0, 7),
    };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Failed to update transaction",
    };
  }
}

export function formatTransactionDisplayDate(transactionDate: string) {
  const datePart = transactionDate.slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-").map(Number);
    return format(new Date(year, month - 1, day), "dd MMM yyyy");
  }

  return format(parseISO(transactionDate), "dd MMM yyyy");
}
