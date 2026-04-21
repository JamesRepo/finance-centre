"use client";

import { type ComponentProps, useCallback, useEffect, useRef, useState } from "react";
import { SpendingTab } from "./spending-tab";
import { BudgetTab } from "./budget-tab";
import { IncomeTab } from "./income-tab";
import { NetWorthTab } from "./networth-tab";

type Section = "spending" | "budgets" | "income" | "networth";
type MonthRange = 3 | 6 | 12;
type SpendingPayload = ComponentProps<typeof SpendingTab>["data"];
type BudgetPayload = ComponentProps<typeof BudgetTab>["data"];
type IncomePayload = ComponentProps<typeof IncomeTab>["data"];
type NetWorthPayload = ComponentProps<typeof NetWorthTab>["data"];
type AnalysisData =
  | { section: "spending"; payload: SpendingPayload }
  | { section: "budgets"; payload: BudgetPayload }
  | { section: "income"; payload: IncomePayload }
  | { section: "networth"; payload: NetWorthPayload };

const sectionTabs = [
  { value: "spending", label: "Spending Trends" },
  { value: "budgets", label: "Budget Health" },
  { value: "income", label: "Income & Outgoings" },
  { value: "networth", label: "Net Worth" },
] as const;

const rangeTabs = [
  { value: 3, label: "3 months" },
  { value: 6, label: "6 months" },
  { value: 12, label: "12 months" },
] as const;

export default function AnalysisPage() {
  const [section, setSection] = useState<Section>("spending");
  const [months, setMonths] = useState<MonthRange>(6);
  const [data, setData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const params = new URLSearchParams({
        section,
        months: String(months),
      });

      const response = await fetch(`/api/analysis?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Failed to load analysis data",
        );
      }

      const payload = await response.json();

      if (requestId !== requestIdRef.current) {
        return;
      }

      setData({ section, payload } as AnalysisData);
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setError(
        err instanceof Error ? err.message : "Failed to load analysis data",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [section, months]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function renderTabContent(currentData: AnalysisData) {
    switch (currentData.section) {
      case "spending":
        return <SpendingTab data={currentData.payload} />;
      case "budgets":
        return <BudgetTab data={currentData.payload} />;
      case "income":
        return <IncomeTab data={currentData.payload} />;
      case "networth":
        return <NetWorthTab data={currentData.payload} />;
    }
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-stone-950 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Header */}
        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface border-b border-stone-200 px-6 py-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                Insights
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
                Analysis
              </h1>
            </div>

            {/* Section tabs */}
            <div className="mt-6 flex flex-wrap gap-2">
              {sectionTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSection(tab.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    section === tab.value
                      ? "bg-stone-950 text-white"
                      : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Range selector */}
          <div className="flex items-center gap-4 px-6 py-5">
            <p className="text-sm font-medium text-stone-500">Period</p>
            <div className="flex gap-2">
              {rangeTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setMonths(tab.value)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    months === tab.value
                      ? "bg-stone-950 text-white"
                      : "border border-stone-300 bg-white text-stone-700 hover:border-stone-950 hover:text-stone-950"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Content */}
        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : loading || (data !== null && data.section !== section) ? (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-10 text-center text-sm text-stone-500">
            Loading analysis...
          </div>
        ) : data ? renderTabContent(data) : null}
      </div>
    </main>
  );
}
