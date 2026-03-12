"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const settingsFormSchema = z.object({
  currency: z.string().trim().min(1, "Currency is required"),
  locale: z.string().trim().min(1, "Locale is required"),
  monthlyBudgetTotal: z.string(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

type SettingsData = {
  id: number;
  currency: string;
  locale: string;
  monthlyBudgetTotal: string | null;
  updatedAt: string;
};

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      currency: "GBP",
      locale: "en-GB",
      monthlyBudgetTotal: "",
    },
  });

  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });

        if (response.ok) {
          const data = (await response.json()) as SettingsData;

          form.reset({
            currency: data.currency,
            locale: data.locale,
            monthlyBudgetTotal: data.monthlyBudgetTotal ?? "",
          });
        }
      } catch {
        // Use defaults on failure
      } finally {
        setLoading(false);
      }
    }

    void loadSettings();
  }, [form]);

  async function onSubmit(values: SettingsFormValues) {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        currency: values.currency,
        locale: values.locale,
        monthlyBudgetTotal:
          values.monthlyBudgetTotal.trim() === ""
            ? null
            : Number(values.monthlyBudgetTotal),
      };

      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to save settings"));
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Failed to save settings",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-[2rem] border border-stone-200 bg-white px-6 py-10 shadow-sm">
            <p className="text-sm text-stone-500">Loading settings...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-2xl">
        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 bg-[linear-gradient(135deg,#fafaf9_0%,#f5f5f4_52%,#ede9e7_100%)] px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Finance Centre
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
              Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Configure your currency, locale, and optional monthly budget total.
            </p>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 px-6 py-6">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                Settings saved successfully.
              </div>
            ) : null}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Currency</span>
              <input
                type="text"
                {...form.register("currency")}
                placeholder="GBP"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              {form.formState.errors.currency ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.currency.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Locale</span>
              <input
                type="text"
                {...form.register("locale")}
                placeholder="en-GB"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              {form.formState.errors.locale ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.locale.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">
                Monthly budget total
              </span>
              <input
                type="number"
                step="0.01"
                {...form.register("monthlyBudgetTotal")}
                placeholder="Optional"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              <p className="text-xs text-stone-400">
                Leave blank to calculate from individual category budgets.
              </p>
              {form.formState.errors.monthlyBudgetTotal ? (
                <p className="text-sm text-red-600">
                  {form.formState.errors.monthlyBudgetTotal.message}
                </p>
              ) : null}
            </label>

            <div className="flex items-center gap-3 border-t border-stone-100 pt-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-stone-950 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
