import Image from "next/image";
import Link from "next/link";
import { ConnectButton } from "@/components/wallet/ConnectButton";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-[#070b14]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 group min-w-0">
          <Image
            src="/parity-logo.svg"
            alt="Parity"
            width={32}
            height={32}
            className="rounded-lg shadow-[0_0_20px_rgba(243,186,47,0.15)] transition-transform group-hover:scale-105"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-white">
            Parity
          </span>
          <span className="hidden sm:inline text-xs text-slate-500 font-medium ml-0.5 truncate">
            fair price for tokenized stocks
          </span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
          <Link
            href="/trade"
            className="btn-press btn-gold rounded-full px-3.5 sm:px-4 py-1.5 text-sm"
          >
            Buy stock
          </Link>
          <ConnectButton />
        </nav>
      </div>
    </header>
  );
}
