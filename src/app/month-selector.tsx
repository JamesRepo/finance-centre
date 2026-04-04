"use client";

import { shiftMonthValue } from "@/lib/months";

type MonthSelectorProps = {
  value: string;
  onChange: (month: string) => void;
  label?: string;
  className?: string;
};

export function MonthSelector({
  value,
  onChange,
  label = "Month",
  className = "flex flex-col gap-3 sm:flex-row sm:items-end",
}: MonthSelectorProps) {
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => onChange(shiftMonthValue(value, -1))}
        className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
      >
        Previous
      </button>

      <label className="flex min-w-44 flex-col gap-2">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <input
          type="month"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
          }}
          className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
        />
      </label>

      <button
        type="button"
        onClick={() => onChange(shiftMonthValue(value, 1))}
        className="h-11 rounded-xl border border-stone-300 bg-white px-4 text-sm font-medium transition hover:border-stone-950"
      >
        Next
      </button>
    </div>
  );
}
