import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductDetail } from "@/lib/server/queries/product";
import { formatBdt, formatDate } from "@/lib/format";
import { SHIPPING_METHOD_LABELS } from "@/lib/domain/margin";
import { Thumbnail } from "@/components/common/thumbnail";

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "");
  }
}

/** Read-only product details: picture, prices in BDT, links (brand-coloured) and the researcher's notes. */
export function ResearchSummary({ product }: { product: ProductDetail }) {
  const prices: [string, string | null][] = [
    ["China price / unit", product.chinaPriceBdt ? formatBdt(product.chinaPriceBdt) : null],
    ["Weight / unit", product.weightKg ? `${Number(product.weightKg)} kg` : null],
    [
      product.shippingMethod ? `Shipping / unit · ${SHIPPING_METHOD_LABELS[product.shippingMethod]}` : "Shipping / unit",
      product.shippingPerUnitBdt ? formatBdt(product.shippingPerUnitBdt) : null,
    ],
    ["Selling price", product.sellingPriceBdt ? formatBdt(product.sellingPriceBdt) : null],
  ];
  const texts: [string, string | null][] = [
    ["Problem it solves", product.problemSolved],
  ];
  return (
    <section className="surface grid gap-5 rounded-panel p-4 sm:p-5" aria-label="Product details">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
        <Thumbnail src={product.imageUrl} alt={product.name} className="aspect-square size-auto w-full max-w-[9rem] rounded-panel" />
        <div className="grid content-start gap-3">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {prices.map(([k, v]) => (
              <div key={k} className="rounded-control bg-slate-50 px-3 py-2.5 ring-1 ring-slate-900/[0.04] ring-inset">
                <dt className="text-meta text-slate-500">{k}</dt>
                <dd className="num mt-0.5 text-[15px] font-semibold text-slate-900">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="text-meta font-normal text-slate-600">
            Target launch:{" "}
            <span className="num font-medium text-slate-800">
              {product.targetLaunchDate ? formatDate(new Date(`${product.targetLaunchDate}T00:00:00Z`)) : "not set"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {product.supplierUrl ? (
              <Button asChild size="sm">
                <a href={product.supplierUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLinkIcon /> Supplier · {host(product.supplierUrl)}
                </a>
              </Button>
            ) : (
              <span className="text-meta text-slate-500">No supplier link yet</span>
            )}
            {[...product.referenceLinks, ...product.imageResourceLinks, ...product.videoResourceLinks, ...product.oldImageAssets, ...product.oldVideoAssets].map((l, i) => (
              <Button key={l + i} asChild size="sm" variant="brandSoft">
                <a href={l} target="_blank" rel="noopener noreferrer" className="max-w-[16rem]">
                  <LinkIcon /> <span className="truncate">{host(l)}</span>
                </a>
              </Button>
            ))}
          </div>
        </div>
      </div>
      {texts.some(([, t]) => t) ? (
        <dl className="grid gap-4 border-t border-slate-100 pt-4 md:grid-cols-1">
          {texts.map(([k, t]) => (
            <div key={k} className="min-w-0">
              <dt className="text-meta text-slate-500">{k}</dt>
              <dd className="mt-1 text-body whitespace-pre-line text-slate-800 [overflow-wrap:anywhere]">{t || "—"}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}
