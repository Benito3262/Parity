import Link from "next/link";
import { Header } from "@/components/Header";

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100 via-white to-white" />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              BNB · Tokenized stocks · Spot
            </p>
            <h1 className="mt-4 max-w-2xl text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.1]">
              The fair price for every tokenized stock.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-600 leading-relaxed">
              On BNB, the same stock shows up as three tokens — bStocks, Ondo,
              xStocks. Different hours. Different tokens per share. Prices drift,
              especially on weekends.{" "}
              <span className="font-medium text-slate-800">
                Parity finds the true price per share and the best route to buy.
              </span>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/trade"
                className="rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition-colors"
              >
                Buy $20 of NVDA
              </Link>
              <a
                href="#how"
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t border-slate-100 bg-slate-50/80">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Why prices look wrong
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                {
                  title: "Three issuers, one stock",
                  body: "bStocks, Ondo, and xStocks each wrap the same company differently. Comparing token prices alone is apples to oranges.",
                },
                {
                  title: "Hours don’t match",
                  body: "Some venues follow the NYSE clock. Others trade nearly around the clock on BNB. Weekends are when drift shows up most.",
                },
                {
                  title: "Tokens ≠ shares",
                  body: "One issuer may use 1 token = 1 share; another uses 10 tokens = 1 share. Parity always converts to real share price.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <h3 className="font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how" className="border-t border-slate-100">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">
              Four steps. Plain English.
            </h2>
            <ol className="mt-8 space-y-4">
              {[
                {
                  n: "1",
                  title: "You say what you want",
                  body: 'Something like "Buy $20 of NVDA." Amount in dollars, ticker you know from the stock market.',
                },
                {
                  n: "2",
                  title: "We check all three",
                  body: "Which issuers can trade right now? What’s the true price per real share? How far above or below last market close?",
                },
                {
                  n: "3",
                  title: "We pick the best route",
                  body: "Lowest fair price among venues that are open — with a clear badge so you see why.",
                },
                {
                  n: "4",
                  title: "Test, then buy",
                  body: "Simulate the trade first (no funds move). Then connect a wallet and buy live on BNB Chain — spot only.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <Link
                href="/trade"
                className="inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Open the buy flow
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        <p>Parity · Built for Trex’s BNB Hack: Tokenized Stocks Edition</p>
        <p className="mt-1">Free stack · Next.js · Mock Binance Web3 adapter</p>
      </footer>
    </>
  );
}
