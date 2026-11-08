"use client";

import Link from "next/link";
import { ChevronDownIcon, KeyRoundIcon, LogOutIcon, RepeatIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { RolePill } from "@/components/common/pill";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/server/actions/auth";
import { cn } from "@/lib/utils";
import { HoverDropdown, useHoverMenu } from "./hover-menu";

export function UserMenu({ user, canSettings = false }: { user: { name: string; role: Role; avatarColor: string; avatarAssetId?: string | null }; canSettings?: boolean }) {
  const { open, setOpen, hover } = useHoverMenu();
  return (
    <HoverDropdown open={open} setOpen={setOpen}>
      <DropdownMenuTrigger {...hover} className="flex cursor-pointer items-center gap-2 rounded-control p-1 pr-1.5 text-left transition-colors outline-none hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-indigo-500/40 data-[state=open]:bg-white/70">
        <UserAvatar name={user.name} color={user.avatarColor} imageId={user.avatarAssetId} size="sm" />
        <span className="hidden max-w-[7rem] truncate text-body font-medium text-slate-900 xl:inline">{user.name}</span>
        <ChevronDownIcon className={cn("hidden size-3.5 text-slate-500 transition-transform duration-200 ease-out motion-reduce:transition-none sm:block", open && "rotate-180")} />
        <span className="sr-only">Account menu for {user.name}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent {...hover} align="end" className="w-60" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span className="truncate text-slate-900">{user.name}</span>
          <RolePill role={user.role} />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRoundIcon /> My profile & photo
          </Link>
        </DropdownMenuItem>
        {canSettings ? (
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon /> Settings
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem asChild>
          <Link href="/change-pin">
            <KeyRoundIcon /> Change PIN
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void logoutAction()}>
          <RepeatIcon /> Switch user
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void logoutAction()}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </HoverDropdown>
  );
}
