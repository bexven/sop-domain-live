"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon, type LucideIcon, MenuIcon, PackageIcon, ShieldCheckIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Role } from "@/generated/prisma/enums";
import { Logo } from "@/components/common/logo";
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { NavItem } from "@/lib/domain/nav";
import { cn } from "@/lib/utils";
import { HoverDropdown, useHoverMenu } from "./hover-menu";
import { NAV_ICONS } from "./nav-icons";
import { NotificationBell } from "./notification-bell";
import { SearchButton } from "./search-button";
import { UserMenu } from "./user-menu";

type ShellUser = { name: string; role: Role; avatarColor: string; avatarAssetId: string | null };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Glass menu bar across the top: clear labels with icons; Admin pages grouped in one menu. */
export function TopNav({ items, user, badges, canSettings = false }: { items: NavItem[]; user: ShellUser; badges: Partial<Record<string, number>>; canSettings?: boolean }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const main = items.filter((i) => i.section === "main");
  const productsGroup = items.filter((i) => i.section === "products");
  const admin = items.filter((i) => i.section === "admin");
  const adminActive = admin.some((i) => isActive(pathname, i.href));

  return (
    <header className="sticky top-0 z-30 px-3 pt-3">
      <div className="glass mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-[16px] px-2.5 sm:px-3">
        <Link href="/dashboard" className="mr-1 flex shrink-0 items-center rounded-control px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 items-center gap-0.5 lg:flex">
          {main.map((item) => (
            <TopLink key={item.key} item={item} active={isActive(pathname, item.href)} badge={badges[item.key]} />
          ))}
          {productsGroup.length ? (
            <NavMenu label="Products" icon={PackageIcon} items={productsGroup} active={productsGroup.some((i) => isActive(pathname, i.href))} pathname={pathname} />
          ) : null}
          {admin.length ? <NavMenu label="Admin" icon={ShieldCheckIcon} items={admin} active={adminActive} pathname={pathname} /> : null}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SearchButton />
          <NotificationBell />
          <UserMenu user={user} canSettings={canSettings} />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="inline-flex size-9 items-center justify-center rounded-control text-slate-700 hover:bg-white/70 lg:hidden"
          >
            {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.nav
            id="mobile-menu"
            aria-label="Main"
            initial={reduce ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="glass-strong mx-auto mt-2 max-w-7xl rounded-[16px] p-2 lg:hidden"
          >
            <ul className="grid gap-0.5 sm:grid-cols-2">
              {items.map((item) => {
                const Icon = NAV_ICONS[item.key];
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex items-center gap-3 rounded-control px-3 py-2.5", active ? "bg-white shadow-[0_1px_2px_rgb(15_23_42/0.06)]" : "hover:bg-white/60")}
                    >
                      <Icon className={cn("size-[18px]", active ? "text-indigo-600" : "text-slate-500")} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium text-slate-900">{item.label}</span>
                        <span className="block text-meta font-normal text-slate-500">{item.hint}</span>
                      </span>
                      {badges[item.key] ? <Badge n={badges[item.key]!} /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function TopLink({ item, active, badge }: { item: NavItem; active: boolean; badge?: number }) {
  const Icon = NAV_ICONS[item.key];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.hint}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control px-2.5 text-body font-medium whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-[0.97] xl:px-3",
        active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-700 hover:bg-white/70 hover:text-slate-900",
      )}
    >
      <Icon className={cn("size-4 lg:hidden xl:block", active ? "text-indigo-600" : "text-slate-500")} />
      {item.label}
      {badge ? <Badge n={badge} /> : null}
    </Link>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span className="num rounded-full bg-indigo-600 px-1.5 py-px text-[11px] font-semibold text-white" aria-label={`${n} waiting`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** A menu bar group (Products ▾, Admin ▾): opens on hover, click or keyboard. */
function NavMenu({ label, icon: GroupIcon, items, active, pathname }: { label: string; icon: LucideIcon; items: NavItem[]; active: boolean; pathname: string }) {
  const { open, setOpen, hover } = useHoverMenu();
  return (
    <HoverDropdown open={open} setOpen={setOpen}>
      <DropdownMenuTrigger
        {...hover}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-body font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 xl:px-3",
          active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-700 hover:bg-white/70 hover:text-slate-900",
          open && !active && "bg-white/70 text-slate-900",
        )}
      >
        <GroupIcon className={cn("size-4 lg:hidden xl:block", active ? "text-indigo-600" : "text-slate-500")} /> {label}
        <ChevronDownIcon className={cn("size-3.5 text-slate-500 transition-transform duration-200 ease-out motion-reduce:transition-none", open && "rotate-180")} />
      </DropdownMenuTrigger>
      <DropdownMenuContent {...hover} align="start" className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const current = isActive(pathname, item.href);
          return (
            <DropdownMenuItem key={item.key} asChild>
              <Link href={item.href} aria-current={current ? "page" : undefined} className={cn("items-start py-2", current && "bg-slate-900/[0.04]")}>
                <Icon className={cn("mt-0.5", current && "text-indigo-600")} />
                <span>
                  <span className="block font-medium text-slate-900">{item.label}</span>
                  <span className="block text-meta font-normal text-slate-500">{item.hint}</span>
                </span>
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </HoverDropdown>
  );
}
