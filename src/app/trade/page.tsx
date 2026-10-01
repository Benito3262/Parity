import { Header } from "@/components/Header";
import { TradeFlow } from "@/components/TradeFlow";

export const metadata = {
  title: "Buy — Parity",
  description: "Compare tokenized stock issuers and buy at the fair price on BNB.",
};

export default function TradePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <TradeFlow />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        Parity · Trex BNB Hack · Tokenized Stocks Edition · Spot only
      </footer>
    </>
  );
}
