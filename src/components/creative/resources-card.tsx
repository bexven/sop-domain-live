"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLinkIcon, LibraryIcon, LinkIcon, PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Viewer } from "@/components/product/product-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canEditResources, type ResourceLane } from "@/lib/domain/resources";
import { addResourceLinkAction, removeResourceLinkAction } from "@/lib/server/actions/product";
import type { ProductDetail } from "@/lib/server/queries/product";

function host(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.length > 1 ? u.pathname.slice(0, 28) + (u.pathname.length > 28 ? "…" : "") : ""}`;
  } catch {
    return url;
  }
}

function LinkRow({ url, tag, onRemove, pending }: { url: string; tag: string; onRemove?: () => void; pending?: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-2 rounded-control bg-slate-50 px-2.5 py-1.5 ring-1 ring-slate-900/[0.04] ring-inset">
      <LinkIcon className="size-3.5 shrink-0 text-slate-500" aria-hidden />
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-body text-primary underline-offset-2 hover:underline" title={url}>
        {host(url)}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <span className="shrink-0 rounded-full bg-white px-1.5 py-px text-[11px] text-slate-600 ring-1 ring-slate-200 ring-inset">{tag}</span>
      <ExternalLinkIcon className="size-3.5 shrink-0 text-slate-400" aria-hidden />
      {onRemove ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${host(url)}`} onClick={onRemove} disabled={pending}>
          <XIcon />
        </Button>
      ) : null}
    </li>
  );
}

/**
 * Resources on the Image / Video creative tabs: one shared list (the product's links plus links added on either tab).
 * This tab's makers, Seniors, Media Buyers and Admins can add; each link shows where it was added.
 */
export function ResourcesCard({ product, viewer, lane }: { product: ProductDetail; viewer: Viewer; lane: ResourceLane }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const canEdit = canEditResources(viewer, lane);

  function add() {
    const v = url.trim();
    if (!v) return;
    if (!/^https?:\/\//i.test(v)) {
      toast.error("Paste a full link starting with https://");
      return;
    }
    startTransition(async () => {
      const r = await addResourceLinkAction({ productId: product.id, lane, url: v });
      if (r.ok) {
        setUrl("");
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function remove(link: string, from: ResourceLane) {
    startTransition(async () => {
      const r = await removeResourceLinkAction({ productId: product.id, lane: from, url: link });
      if (r.ok) router.refresh();
      else toast.error(r.error);
    });
  }

  // One shared list: whoever adds a link anywhere, everyone sees it on every tab (tagged with where it came from).
  const all = [
    ...product.referenceLinks.map((url) => ({ url, from: "Product" as const, lane: null })),
    ...product.imageResourceLinks.map((url) => ({ url, from: "Images" as const, lane: "images" as const })),
    ...product.videoResourceLinks.map((url) => ({ url, from: "Videos" as const, lane: "videos" as const })),
    ...product.oldImageAssets.map((url) => ({ url, from: "Old images" as const, lane: null })),
    ...product.oldVideoAssets.map((url) => ({ url, from: "Old videos" as const, lane: null })),
  ];

  return (
    <section aria-labelledby={`res-${lane}`} className="surface grid gap-3 rounded-panel p-4">
      <h2 id={`res-${lane}`} className="flex items-center gap-2 text-section text-slate-900">
        <LibraryIcon className="size-4 text-slate-500" aria-hidden /> Resources
        <span className="num text-meta text-slate-500">{all.length}</span>
      </h2>
      {all.length ? (
        <ul className="grid gap-1.5 md:grid-cols-2">
          {all.map((r) => (
            <LinkRow
              key={`${r.from}-${r.url}`}
              url={r.url}
              tag={r.from}
              onRemove={r.lane && canEditResources(viewer, r.lane) ? () => remove(r.url, r.lane!) : undefined}
              pending={pending}
            />
          ))}
        </ul>
      ) : (
        <p className="text-meta font-normal text-slate-500">No resources yet. Links added here show on the Image and Video creative tabs for everyone.</p>
      )}
      {canEdit ? (
        <div className="flex gap-2 md:max-w-xl">
          <Input
            aria-label="Add a resource link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            inputMode="url"
            placeholder="Add a link: reference ad, inspiration, Drive folder…"
            className="h-9"
          />
          <Button size="sm" variant="outline" className="h-9" onClick={add} disabled={pending || !url.trim()}>
            <PlusIcon /> Add
          </Button>
        </div>
      ) : null}
    </section>
  );
}
