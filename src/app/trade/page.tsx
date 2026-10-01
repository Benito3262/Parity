import { Suspense } from "react";
import { Header } from "@/components/Header";
import { TradeFlow } from "@/components/TradeFlow";

export const metadata = {
  title: "Buy",
  description:
    "Compare tokenized stock issuers and buy at the fair price on BNB.",
};

export default function TradePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Suspense
          fallback={
            <div className="glass rounded-2xl p-8 text-sm text-slate-400 animate-pulse">
              Loading trade flow…
            </div>
          }
        >
          <TradeFlow />
        </Suspense>
      </main>
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        Parity · Trex BNB Hack · Tokenized Stocks Edition · Spot only
      </footer>
    </>
  );
}
