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

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required"),
  colorCode: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid 6-digit hex code"),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

type SettingsData = {
  id: number;
  currency: string;
  locale: string;
  monthlyBudgetTotal: string | null;
  updatedAt: string;
};

type CategoryData = {
  id: string;
  name: string;
  colorCode: string | null;
  isSystem: boolean;
  createdAt: string;
  transactionCount: number;
  budgetCount: number;
};

async function readApiError(response: Response, fallback: string) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

function formatUsageLabel(category: CategoryData) {
  const labels: string[] = [];

  if (category.transactionCount > 0) {
    labels.push(
      `${category.transactionCount} transaction${category.transactionCount === 1 ? "" : "s"}`,
    );
  }

  if (category.budgetCount > 0) {
    labels.push(`${category.budgetCount} budget${category.budgetCount === 1 ? "" : "s"}`);
  }

  return labels.length > 0 ? labels.join(" • ") : "Unused";
}

function getCategoryColorValue(colorCode: string | null) {
  return colorCode ?? "#78716c";
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const settingsForm = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      currency: "GBP",
      locale: "en-GB",
      monthlyBudgetTotal: "",
    },
  });

  const createCategoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      colorCode: "#78716c",
    },
  });

  const editCategoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      colorCode: "#78716c",
    },
  });

  async function loadCategories() {
    setCategoriesLoading(true);
    setCategoriesError(null);

    try {
      const response = await fetch("/api/categories", { cache: "no-store" });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load categories"));
      }

      const data = (await response.json()) as CategoryData[];
      setCategories(data);
    } catch (loadError) {
      setCategoriesError(
        loadError instanceof Error ? loadError.message : "Failed to load categories",
      );
    } finally {
      setCategoriesLoading(false);
    }
  }

  useEffect(() => {
    async function loadPage() {
      const [settingsResult, categoriesResult] = await Promise.allSettled([
        fetch("/api/settings", { cache: "no-store" }),
        fetch("/api/categories", { cache: "no-store" }),
      ]);

      if (settingsResult.status === "fulfilled" && settingsResult.value.ok) {
        const data = (await settingsResult.value.json()) as SettingsData;

        settingsForm.reset({
          currency: data.currency,
          locale: data.locale,
          monthlyBudgetTotal: data.monthlyBudgetTotal ?? "",
        });
      }

      if (categoriesResult.status === "fulfilled") {
        if (!categoriesResult.value.ok) {
          setCategoriesError(
            await readApiError(categoriesResult.value, "Failed to load categories"),
          );
        } else {
          const categoryData = (await categoriesResult.value.json()) as CategoryData[];
          setCategories(categoryData);
        }
      } else {
        setCategoriesError(
          categoriesResult.reason instanceof Error
            ? categoriesResult.reason.message
            : "Failed to load categories",
        );
      }

      setLoading(false);
      setCategoriesLoading(false);
    }

    void loadPage();
  }, [settingsForm]);

  async function onSubmitSettings(values: SettingsFormValues) {
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

  async function onCreateCategory(values: CategoryFormValues) {
    setCreatingCategory(true);
    setCategoryError(null);
    setCategoryNotice(null);

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to create category"));
      }

      createCategoryForm.reset({
        name: "",
        colorCode: "#78716c",
      });
      setCategoryNotice("Category created.");
      await loadCategories();
    } catch (submitError) {
      setCategoryError(
        submitError instanceof Error ? submitError.message : "Failed to create category",
      );
    } finally {
      setCreatingCategory(false);
    }
  }

  function startEditingCategory(category: CategoryData) {
    setEditingCategoryId(category.id);
    setCategoryError(null);
    setCategoryNotice(null);
    editCategoryForm.reset({
      name: category.name,
      colorCode: getCategoryColorValue(category.colorCode),
    });
  }

  function cancelEditingCategory() {
    setEditingCategoryId(null);
    setCategoryError(null);
    editCategoryForm.reset({
      name: "",
      colorCode: "#78716c",
    });
  }

  async function onUpdateCategory(values: CategoryFormValues) {
    if (!editingCategoryId) {
      return;
    }

    setUpdatingCategory(true);
    setCategoryError(null);
    setCategoryNotice(null);

    try {
      const response = await fetch(`/api/categories/${editingCategoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update category"));
      }

      setEditingCategoryId(null);
      editCategoryForm.reset({
        name: "",
        colorCode: "#78716c",
      });
      setCategoryNotice("Category updated.");
      await loadCategories();
    } catch (submitError) {
      setCategoryError(
        submitError instanceof Error ? submitError.message : "Failed to update category",
      );
    } finally {
      setUpdatingCategory(false);
    }
  }

  async function deleteCategory(category: CategoryData) {
    setDeletingCategoryId(category.id);
    setCategoryError(null);
    setCategoryNotice(null);

    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to delete category"));
      }

      if (editingCategoryId === category.id) {
        cancelEditingCategory();
      }

      setCategoryNotice("Category deleted.");
      await loadCategories();
    } catch (deleteError) {
      setCategoryError(
        deleteError instanceof Error ? deleteError.message : "Failed to delete category",
      );
    } finally {
      setDeletingCategoryId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <div className="rounded-[2rem] border border-stone-200 bg-white px-6 py-10 shadow-sm">
            <p className="text-sm text-stone-500">Loading settings...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface border-b border-stone-200 px-6 py-6">
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

          <form
            onSubmit={settingsForm.handleSubmit(onSubmitSettings)}
            className="flex flex-col gap-6 px-6 py-6"
          >
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
                {...settingsForm.register("currency")}
                placeholder="GBP"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              {settingsForm.formState.errors.currency ? (
                <p className="text-sm text-red-600">
                  {settingsForm.formState.errors.currency.message}
                </p>
              ) : null}
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Locale</span>
              <input
                type="text"
                {...settingsForm.register("locale")}
                placeholder="en-GB"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              {settingsForm.formState.errors.locale ? (
                <p className="text-sm text-red-600">
                  {settingsForm.formState.errors.locale.message}
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
                {...settingsForm.register("monthlyBudgetTotal")}
                placeholder="Optional"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
              <p className="text-xs text-stone-400">
                Leave blank to calculate from individual category budgets.
              </p>
              {settingsForm.formState.errors.monthlyBudgetTotal ? (
                <p className="text-sm text-red-600">
                  {settingsForm.formState.errors.monthlyBudgetTotal.message}
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

        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-200 px-6 py-6">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-950">
              Categories
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              Add, rename, recolor, and remove spending categories. Categories linked to
              transactions or budgets cannot be deleted.
            </p>
          </div>

          <div className="flex flex-col gap-6 px-6 py-6">
            {categoriesError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {categoriesError}
              </div>
            ) : null}

            {categoryError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {categoryError}
              </div>
            ) : null}

            {categoryNotice ? (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                {categoryNotice}
              </div>
            ) : null}

            <form
              onSubmit={createCategoryForm.handleSubmit(onCreateCategory)}
              className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 md:grid-cols-[minmax(0,1fr)_160px_auto]"
            >
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Category name</span>
                <input
                  type="text"
                  {...createCategoryForm.register("name")}
                  placeholder="New category"
                  className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                />
                {createCategoryForm.formState.errors.name ? (
                  <p className="text-sm text-red-600">
                    {createCategoryForm.formState.errors.name.message}
                  </p>
                ) : null}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-stone-700">Color</span>
                <input
                  type="color"
                  {...createCategoryForm.register("colorCode")}
                  className="h-11 w-full rounded-xl border border-stone-300 bg-white px-2 py-1"
                />
                {createCategoryForm.formState.errors.colorCode ? (
                  <p className="text-sm text-red-600">
                    {createCategoryForm.formState.errors.colorCode.message}
                  </p>
                ) : null}
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="h-11 rounded-full bg-stone-950 px-6 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
                >
                  {creatingCategory ? "Adding..." : "Add category"}
                </button>
              </div>
            </form>

            {categoriesLoading ? (
              <p className="text-sm text-stone-500">Loading categories...</p>
            ) : categories.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                No categories yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {categories.map((category) => {
                  const isEditing = editingCategoryId === category.id;
                  const deleteBlocked =
                    category.transactionCount > 0 || category.budgetCount > 0;

                  return (
                    <div
                      key={category.id}
                      className="rounded-[1.5rem] border border-stone-200 px-4 py-4"
                    >
                      {isEditing ? (
                        <form
                          onSubmit={editCategoryForm.handleSubmit(onUpdateCategory)}
                          className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px_auto]"
                        >
                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-stone-700">
                              Category name
                            </span>
                            <input
                              type="text"
                              {...editCategoryForm.register("name")}
                              className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
                            />
                            {editCategoryForm.formState.errors.name ? (
                              <p className="text-sm text-red-600">
                                {editCategoryForm.formState.errors.name.message}
                              </p>
                            ) : null}
                          </label>

                          <label className="flex flex-col gap-2">
                            <span className="text-sm font-medium text-stone-700">Color</span>
                            <input
                              type="color"
                              {...editCategoryForm.register("colorCode")}
                              className="h-11 w-full rounded-xl border border-stone-300 bg-white px-2 py-1"
                            />
                            {editCategoryForm.formState.errors.colorCode ? (
                              <p className="text-sm text-red-600">
                                {editCategoryForm.formState.errors.colorCode.message}
                              </p>
                            ) : null}
                          </label>

                          <div className="flex items-end gap-3">
                            <button
                              type="submit"
                              disabled={updatingCategory}
                              className="h-11 rounded-full bg-stone-950 px-6 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
                            >
                              {updatingCategory ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingCategory}
                              disabled={updatingCategory}
                              className="h-11 rounded-full border border-stone-300 px-6 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-4 w-4 rounded-full border border-stone-200"
                              style={{
                                backgroundColor: getCategoryColorValue(category.colorCode),
                              }}
                            />

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-stone-950">
                                  {category.name}
                                </p>
                                {category.isSystem ? (
                                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                                    Seeded
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-stone-500">
                                {formatUsageLabel(category)}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              onClick={() => startEditingCategory(category)}
                              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-950"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void deleteCategory(category)}
                              disabled={deleteBlocked || deletingCategoryId === category.id}
                              className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:border-red-300 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {deletingCategoryId === category.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
