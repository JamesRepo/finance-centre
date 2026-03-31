"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    });

    if (result?.status === 429 || result?.error === "RateLimitExceeded") {
      setError("Too many sign-in attempts. Please wait a minute and try again.");
      setSubmitting(false);
    } else if (result?.error) {
      setError("Invalid email or password");
      setSubmitting(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-8 text-stone-950">
      <div className="w-full max-w-sm">
        <section className="rounded-[2rem] border border-stone-200 bg-white shadow-sm">
          <div className="app-hero-surface border-b border-stone-200 px-6 py-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Finance Centre
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">
              Sign in
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-6 py-6">
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-stone-700">Password</span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="h-11 rounded-full bg-stone-950 px-6 text-sm font-medium text-white transition hover:bg-stone-800 disabled:opacity-50"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
