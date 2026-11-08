"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConicalIcon, PlusIcon, RocketIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { Priority, TaskType } from "@/generated/prisma/enums";
import { BrandPicker } from "@/components/common/brand-picker";
import { Field, fieldA11y } from "@/components/common/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CREATIVE_TYPES, PRIORITIES, PRIORITY_LABELS, TASK_TYPE_LABELS } from "@/lib/domain/labels";
import { createProductAction, createRunningProductAction } from "@/lib/server/actions/product";
import { cn } from "@/lib/utils";

type Brand = { id: string; name: string; color: string };
type Mode = "research" | "running";

function inDays(n: number) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(Date.now() + n * 86_400_000));
}

/**
 * "Add product": a new product to research, or (Admins / Media Buyers) an old product that is already running,
 * which skips research and review and goes straight to Live with a new creative batch.
 */
export function NewProductDialog({
  open,
  onOpenChange,
  brands,
  canResearch = true,
  canRunning = false,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brands: Brand[];
  canResearch?: boolean;
  canRunning?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto">
        {open ? <NewProductForm brands={brands} canResearch={canResearch} canRunning={canRunning} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NewProductForm({ onDone, brands, canResearch, canRunning }: { onDone: () => void; brands: Brand[]; canResearch: boolean; canRunning: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(canResearch ? "research" : "running");
  const [brandId, setBrandId] = useState(brands.length === 1 ? brands[0]!.id : "");
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [oldImages, setOldImages] = useState<string[]>([]);
  const [oldVideos, setOldVideos] = useState<string[]>([]);
  const [withBatch, setWithBatch] = useState(false);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [links, setLinks] = useState<string[]>([]);
  const [batchName, setBatchName] = useState("New creatives");
  const [types, setTypes] = useState<TaskType[]>(["WEBSITE_IMAGE", "AD_IMAGE_VERTICAL", "VIDEO_MAIN"]);
  const [dueDate, setDueDate] = useState(inDays(3));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();
  const err = (k: string) => errors[k]?.[0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r =
        mode === "research"
          ? await createProductAction({ brandId, name, supplierUrl, imageUrl, priority, referenceLinks: links })
          : await createRunningProductAction({
              brandId,
              name,
              websiteUrl,
              imageUrl,
              oldImageAssets: oldImages,
              oldVideoAssets: oldVideos,
              referenceLinks: links,
              priority,
              withBatch,
              batchName,
              types,
              dueDate,
            });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        toast.error(r.error);
        return;
      }
      toast.success(r.message ?? "Product added", { description: mode === "research" ? "Fill in the research, then submit." : undefined });
      onDone();
      router.push(`/products/${r.data!.id}${mode === "running" ? (withBatch ? "?phase=images" : "?phase=ads") : ""}`);
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>Add Product</DialogTitle>
        <DialogDescription>
          {mode === "research"
            ? "A new product: name it now, then fill in prices and the checklist on the next screen and submit for review."
            : "An older product that's already selling: no research or approval. It's listed as Live with its old creatives; you can also ask for new ones."}
        </DialogDescription>
      </DialogHeader>

      {canResearch && canRunning ? (
        <div role="radiogroup" aria-label="What are you adding?" className="grid grid-cols-2 gap-2">
          {(
            [
              ["research", "To research", "Research → review → creative", FlaskConicalIcon],
              ["running", "Already running", "Straight to Live, old creatives kept", RocketIcon],
            ] as const
          ).map(([k, label, hint, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-control p-3 text-left ring-1 transition-colors duration-150 ring-inset focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                mode === k ? "bg-indigo-50 ring-indigo-300" : "bg-white ring-slate-200 hover:bg-slate-50",
              )}
            >
              <Icon className={cn("mt-0.5 size-4 shrink-0", mode === k ? "text-indigo-600" : "text-slate-500")} aria-hidden />
              <span>
                <span className="block text-body font-semibold text-slate-900">{label}</span>
                <span className="block text-meta font-normal text-slate-600">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-meta text-slate-700">Brand *</legend>
        <BrandPicker brands={brands} value={brandId} onChange={setBrandId} />
        {err("brandId") ? <p className="text-meta text-rose-700">{err("brandId")}</p> : null}
      </fieldset>
      <Field id="np-name" label="Product name *" error={err("name")}>
        <Input {...fieldA11y("np-name", err("name"))} value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Foldable LED desk lamp" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        {mode === "running" ? (
          <Field id="np-web" label="Product URL (website)" error={err("websiteUrl")}>
            <Input {...fieldA11y("np-web", err("websiteUrl"))} value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} inputMode="url" placeholder="https://yourshop.com/product/…" />
          </Field>
        ) : (
          <Field id="np-supplier" label="Supplier link (optional)" error={err("supplierUrl")}>
            <Input {...fieldA11y("np-supplier", err("supplierUrl"))} value={supplierUrl} onChange={(e) => setSupplierUrl(e.target.value)} inputMode="url" placeholder="https://detail.1688.com/…" />
          </Field>
        )}
        <Field id="np-image" label="Picture link (optional)" hint="Used as the product picture" error={err("imageUrl")}>
          <Input {...fieldA11y("np-image", err("imageUrl"), true)} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} inputMode="url" placeholder="https://…" />
        </Field>
      </div>
      {mode === "running" ? (
        <>
          <LinkList id="np-oldimg" title="Old image assets" hint="Existing product photos, ad images, Drive folders" links={oldImages} onChange={setOldImages} error={err("oldImageAssets")} />
          <LinkList id="np-oldvid" title="Old video assets" hint="Existing videos, Drive folders" links={oldVideos} onChange={setOldVideos} error={err("oldVideoAssets")} />
        </>
      ) : null}

      <LinkList id="np-res" title="Resources" hint="Reference ads, videos, competitor listings" links={links} onChange={setLinks} error={err("referenceLinks")} />

      {mode === "running" ? (
        <section className="grid gap-3 rounded-panel bg-slate-50 p-3 ring-1 ring-slate-200 ring-inset" aria-label="New creatives">
          <label className="flex cursor-pointer items-center gap-2.5 text-body font-semibold text-slate-900">
            <Checkbox checked={withBatch} onCheckedChange={(v) => setWithBatch(v === true)} />
            Also request new images / videos
          </label>
          {withBatch ? (
          <>
          <fieldset className="grid gap-1.5">
            <legend className="sr-only">Formats</legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {CREATIVE_TYPES.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2.5 rounded-control border border-slate-200 bg-white px-3 py-2 text-body hover:bg-slate-50">
                  <Checkbox checked={types.includes(t)} onCheckedChange={(v) => setTypes((cur) => (v === true ? [...cur, t] : cur.filter((x) => x !== t)))} />
                  {TASK_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
            {err("types") ? <p className="text-meta text-rose-700">{err("types")}</p> : null}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="np-bname" label="Batch name *" error={err("batchName")}>
              <Input {...fieldA11y("np-bname", err("batchName"))} value={batchName} onChange={(e) => setBatchName(e.target.value)} maxLength={60} className="bg-white" />
            </Field>
            <Field id="np-due" label="Due *" error={err("dueDate")}>
              <Input {...fieldA11y("np-due", err("dueDate"))} type="date" value={dueDate} min={inDays(0)} onChange={(e) => setDueDate(e.target.value)} className="num bg-white" />
            </Field>
          </div>
          </>
          ) : null}
        </section>
      ) : (
        <Field id="np-priority" label="Priority">
          <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
            <SelectTrigger id="np-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !brandId || name.trim().length < 2 || (mode === "running" && withBatch && (types.length === 0 || !dueDate))}>
          {mode === "research" ? "Add & start research" : withBatch ? "Add & send creatives" : "Add product"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A small list of links with an "Add" box (resources, old assets). */
function LinkList({ id, title, hint, links, onChange, error }: { id: string; title: string; hint: string; links: string[]; onChange: (l: string[]) => void; error?: string }) {
  const [value, setValue] = useState("");
  function add() {
    const url = value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Paste a full link starting with https://");
      return;
    }
    if (!links.includes(url)) onChange([...links, url]);
    setValue("");
  }
  return (
    <section className="grid gap-2" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="text-meta text-slate-700">
        {title} <span className="font-normal text-slate-500">· {hint} (optional)</span>
      </h3>
      {links.length ? (
        <ul className="grid gap-1.5">
          {links.map((l) => (
            <li key={l} className="flex items-center gap-2 rounded-control bg-slate-50 px-2.5 py-1.5 text-body">
              <span className="min-w-0 flex-1 truncate text-slate-800">{l}</span>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove link" onClick={() => onChange(links.filter((y) => y !== l))}>
                <XIcon />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          aria-label={`Add to ${title.toLowerCase()}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          inputMode="url"
          placeholder="https://…"
        />
        <Button type="button" variant="outline" onClick={add}>
          <PlusIcon /> Add
        </Button>
      </div>
      {error ? <p className="text-meta text-rose-700">{error}</p> : null}
    </section>
  );
}
