import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white shadow-sm group-hover:bg-emerald-500 transition-colors">
            P
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Parity
          </span>
          <span className="hidden sm:inline text-xs text-slate-400 font-medium ml-1">
            fair price for tokenized stocks
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/trade"
            className="rounded-full bg-slate-900 px-3.5 py-1.5 font-medium text-white hover:bg-slate-800 transition-colors"
          >
            Buy stock
          </Link>
        </nav>
      </div>
    </header>
  );
}
