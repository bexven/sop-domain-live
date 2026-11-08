"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "radix-ui";
import { CornerDownLeftIcon, PlusIcon, SearchIcon } from "lucide-react";
import type { ProductStage } from "@/generated/prisma/enums";
import { StagePill } from "@/components/common/pills";
import { Thumbnail } from "@/components/common/thumbnail";
import type { NavItem } from "@/lib/domain/nav";
import { paletteProductsAction } from "@/lib/server/actions/search";
import { NAV_ICONS } from "./nav-icons";

type PaletteProduct = { id: string; ref: string; name: string; stage: ProductStage; imageUrl: string | null };

export const OPEN_PALETTE_EVENT = "sop:open-palette";
export const NEW_PRODUCT_EVENT = "sop:new-product";

function typingInField(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.getAttribute("role") === "combobox");
}

/** ⌘K palette + global shortcuts: C add product (Research) · G D dashboard · G P pipeline. Esc closes dialogs. */
export function CommandPalette({ items, canCreate }: { items: NavItem[]; canCreate: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<PaletteProduct[] | null>(null);
  const gPressed = useRef<number>(0);

  const loadProducts = useCallback(async () => {
    const r = await paletteProductsAction({});
    if (r.ok && r.data) setProducts(r.data);
  }, []);

  const openPalette = useCallback(() => {
    setOpen(true);
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => {
          if (!o) void loadProducts();
          return !o;
        });
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typingInField(e) || document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (key === "g") {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current < 1200) {
        if (key === "d" || key === "q") router.push("/dashboard");
        if (key === "r" && canCreate) router.push("/research");
        if (key === "c") router.push("/creative");
        if (key === "p") router.push("/pipeline");
        gPressed.current = 0;
        return;
      }
      if (key === "c" && canCreate) {
        e.preventDefault();
        router.push("/research?add=1");
      }
    };
    const onOpen = () => openPalette();
    const onNew = () => router.push("/research?add=1");
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    window.addEventListener(NEW_PRODUCT_EVENT, onNew);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
      window.removeEventListener(NEW_PRODUCT_EVENT, onNew);
    };
  }, [router, canCreate, openPalette, loadProducts]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-900/20 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="glass-strong fixed top-[12vh] left-1/2 z-50 w-[min(36rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[18px] outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]"
          >
            <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
            <Command label="Command palette" loop className="flex flex-col">
              <div className="flex items-center gap-2 border-b border-slate-900/[0.06] px-4">
                <SearchIcon className="size-4 text-slate-500" />
                <Command.Input
                  autoFocus
                  placeholder="Search products or jump to…"
                  className="h-12 flex-1 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-500"
                />
                <kbd className="num rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">ESC</kbd>
              </div>
              <Command.List className="max-h-[min(24rem,60vh)] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:text-slate-500">
                <Command.Empty className="px-3 py-8 text-center text-body text-slate-500">No matches.</Command.Empty>
                {canCreate ? (
                  <Command.Group heading="Actions">
                    <PaletteItem value="add product research" onSelect={() => go("/research?add=1")}>
                      <PlusIcon className="size-4 text-indigo-600" /> Add Product <Kbd>C</Kbd>
                    </PaletteItem>
                  </Command.Group>
                ) : null}
                <Command.Group heading="Go to">
                  {items.map((i) => {
                    const Icon = NAV_ICONS[i.key];
                    return (
                      <PaletteItem key={i.key} value={`go ${i.label}`} onSelect={() => go(i.href)}>
                        <Icon className="size-4 text-slate-500" /> {i.label}
                        {i.key === "dashboard" ? <Kbd>G D</Kbd> : i.key === "pipeline" ? <Kbd>G P</Kbd> : null}
                      </PaletteItem>
                    );
                  })}
                </Command.Group>
                <Command.Group heading="Products">
                  {products === null ? (
                    <p className="px-3 py-2 text-meta font-normal text-slate-500">Loading…</p>
                  ) : (
                    products.map((p) => (
                      <PaletteItem key={p.id} value={`${p.ref} ${p.name}`} onSelect={() => go(`/products/${p.id}`)}>
                        <Thumbnail src={p.imageUrl} alt="" className="size-6 rounded-md" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <span className="num text-meta text-slate-500">{p.ref}</span>
                        <StagePill stage={p.stage} />
                      </PaletteItem>
                    ))
                  )}
                </Command.Group>
              </Command.List>
              <div className="flex items-center gap-3 border-t border-slate-900/[0.06] px-4 py-2 text-meta font-normal text-slate-500">
                <span className="inline-flex items-center gap-1"><CornerDownLeftIcon className="size-3" /> open</span>
                <span>↑↓ navigate</span>
                <span className="ml-auto">⌘K to toggle</span>
              </div>
            </Command>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

function PaletteItem({ children, value, onSelect }: { children: React.ReactNode; value: string; onSelect: () => void }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-body text-slate-800 data-[selected=true]:bg-slate-900/[0.06]"
    >
      {children}
    </Command.Item>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="num ml-auto rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">{children}</kbd>;
}
