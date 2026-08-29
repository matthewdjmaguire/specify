import Link from "next/link";
import Image from "next/image";
import { ProfileDropdown } from "./profile-dropdown";
import type { NavProfile } from "@/lib/data/nav";

export function AppHeader({ profile }: { profile: NavProfile }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <Link href="/" className="flex items-center gap-2 md:hidden">
        <Image src="/logo.svg" alt="" width={24} height={24} />
        <span className="font-semibold">Specify</span>
      </Link>
      <div className="hidden md:block" />
      <ProfileDropdown profile={profile} />
    </header>
  );
}
