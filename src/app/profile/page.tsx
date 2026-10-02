import { redirect } from "next/navigation";

/** Profile route hidden from product nav — redirect home. Wallet connect remains on trade. */
export default function ProfilePage() {
  redirect("/");
}
