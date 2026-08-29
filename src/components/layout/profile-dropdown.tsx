"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/app/actions/auth";
import type { NavProfile } from "@/lib/data/nav";

function initialsFor(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return initials || "?";
}

export function ProfileDropdown({ profile }: { profile: NavProfile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarImage src={profile.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{initialsFor(profile.displayName)}</AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{profile.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* why render={<Link .../>}, not asChild: this shadcn setup is built
            on Base UI, not Radix — Base UI's polymorphism API is a `render`
            prop (an element to merge props onto), there is no `asChild`. */}
        {profile.isAdmin && <DropdownMenuItem render={<Link href="/admin">Admin</Link>} />}
        <DropdownMenuItem render={<Link href="/settings">Settings</Link>} />
        <DropdownMenuSeparator />
        {/* why onClick calling the server action directly, not a <form>: a
            submit button nested inside Base UI's Menu.Item competes with the
            item's own pointer/keyboard handling — calling the server action
            straight from the item's click handler is simpler and reliable. */}
        <DropdownMenuItem onClick={() => signOut()}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
