import Link from "next/link";
import { Header } from "@/components/Header";
import { MOCK_TICKERS } from "@/lib/binance-web3";

const FEATURED = ["NVDA", "AAPL", "TSLA", "MSFT", "SPY", "QQQ", "COIN", "PLTR"];

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(243,186,47,0.18),transparent_70%)] blur-2xl" />
          </div>
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
            <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.22em] text-[#f3ba2f]">
              BNB · Tokenized stocks · Spot
            </p>
            <h1 className="animate-fade-up stagger-1 mt-4 max-w-2xl text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.1]">
              The fair price for every tokenized stock.
            </h1>
            <p className="animate-fade-up stagger-2 mt-5 max-w-xl text-lg text-slate-400 leading-relaxed">
              On BNB, the same stock shows up as three tokens — bStocks, Ondo,
              xStocks. Different hours. Different tokens per share. Prices drift,
              especially on weekends.{" "}
              <span className="font-medium text-slate-200">
                Parity finds the true price per share and the best route to buy.
              </span>
            </p>
            <div className="animate-fade-up stagger-3 mt-8 flex flex-wrap gap-3">
              <Link
                href="/trade"
                className="btn-press btn-gold rounded-full px-6 py-3 text-sm"
              >
                Buy $20 of NVDA
              </Link>
              <a
                href="#how"
                className="btn-press rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 hover:border-[#f3ba2f]/40 hover:bg-white/10"
              >
                How it works
              </a>
            </div>

            <div className="animate-fade-up stagger-4 mt-10">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-3">
                {MOCK_TICKERS.length} mock tickers · try one
              </p>
              <div className="flex flex-wrap gap-2">
                {FEATURED.map((t) => (
                  <Link
                    key={t}
                    href={`/trade?ticker=${t}`}
                    className="ticker-chip rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold tabular-nums text-slate-300"
                  >
                    {t}
                  </Link>
                ))}
                <Link
                  href="/trade"
                  className="ticker-chip rounded-full border border-[#f3ba2f]/25 bg-[#f3ba2f]/5 px-3 py-1 text-xs font-semibold text-[#f3ba2f]"
                >
                  +{MOCK_TICKERS.length - FEATURED.length} more
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t border-white/5">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
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
              ].map((card, i) => (
                <div
                  key={card.title}
                  className={`glass animate-fade-up stagger-${i + 1} rounded-2xl p-5`}
                >
                  <div className="mb-3 h-1 w-8 rounded-full bg-gradient-to-r from-[#f3ba2f] to-transparent" />
                  <h3 className="font-semibold text-white">{card.title}</h3>
                  <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How */}
        <section id="how" className="border-t border-white/5">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold text-white tracking-tight">
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
              ].map((step, i) => (
                <li
                  key={step.n}
                  className={`glass animate-fade-up stagger-${i + 1} flex gap-4 rounded-2xl p-4 sm:p-5`}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f3ba2f] to-[#c9961a] text-sm font-bold text-[#0b1220]">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 text-center">
              <Link
                href="/trade"
                className="btn-press inline-flex rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:border-[#f3ba2f]/40"
              >
                Open the buy flow
              </Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <p>Parity · Built for Trex’s BNB Hack: Tokenized Stocks Edition</p>
        <p className="mt-1">Free stack · Next.js · Mock Binance Web3 adapter</p>
      </footer>
    </>
  );
}
