import { Header } from "@/components/Header";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";

export const metadata = {
  title: "Profile",
  description: "Create a Parity profile and view your tokenized stock portfolio.",
};

export default function ProfilePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <ProfilePageClient />
      </main>
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        Parity · Profile stored locally · Spot only on BSC
      </footer>
    </>
  );
}
