import type { Metadata } from "next";
import { canAddProduct, canAddRunningProduct } from "@/lib/domain/resources";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { BadgeCheckIcon, FlaskConicalIcon, HourglassIcon, XCircleIcon } from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { AddProductButton } from "@/components/research/add-product-button";
import { ApprovedList, NotApprovedList, PendingList } from "@/components/research/decided-list";
import { ResearchList } from "@/components/research/research-list";
import { can, canSeeEarlyStages } from "@/lib/domain/permissions";
import { requireUser } from "@/lib/server/auth/current-user";
import { getBrands } from "@/lib/server/queries/product";
import { getResearchBoard } from "@/lib/server/queries/research";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Research" };

const TABS = [
  { key: "pending", label: "Pending approval" },
  { key: "approved", label: "Approved" },
  { key: "drafts", label: "In research" },
  { key: "not-approved", label: "Not approved" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function ResearchPage({ searchParams }: PageProps<"/research">) {
  const user = await requireUser();
  if (!canSeeEarlyStages(user)) redirect("/dashboard");
  const [board, brands, sp] = await Promise.all([getResearchBoard(user), getBrands(user), searchParams]);
  const canAdd = canAddProduct(user);
  const canApprove = can(user, "product.approve");
  const counts: Record<TabKey, number> = {
    pending: board.pending.length,
    approved: board.approved.length,
    drafts: board.drafts.length,
    "not-approved": board.notApproved.length,
  };
  const requested = typeof sp.tab === "string" ? sp.tab : "";
  const tab: TabKey = (TABS.find((t) => t.key === requested)?.key ?? "pending") as TabKey;
  const sentBack = board.drafts.filter((d) => d.sentBack);
  const drafts = board.drafts.filter((d) => !d.sentBack);

  return (
    <>
      <PageHeader
        title="Research"
        description={
          canApprove
            ? "New products waiting for your decision, and everything already approved or dropped. Approved products move to Creative."
            : "Add products you've found and submit them for approval. Approved products move to Creative."
        }
        actions={
          canAdd ? (
            <Suspense>
              <AddProductButton brands={brands.filter((b) => b.active)} canResearch={can(user, "product.create")} canRunning={canAddRunningProduct(user)} />
            </Suspense>
          ) : null
        }
      />

      <nav aria-label="Research lists" className="relative mb-5 max-w-full">
        <ul className="grid grid-cols-2 gap-1 rounded-control bg-slate-900/[0.04] p-1 sm:inline-flex sm:gap-0">
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <li key={t.key}>
                <Link
                  href={t.key === "pending" ? "/research" : `/research?tab=${t.key}`}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "flex items-center justify-between gap-1.5 rounded-[8px] px-3 py-1.5 text-body font-medium whitespace-nowrap transition-colors sm:inline-flex sm:justify-start",
                    active ? "bg-white text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]" : "text-slate-600 hover:text-slate-900",
                  )}
                >
                  {t.label}
                  <span className={cn("num rounded-full px-1.5 text-meta", t.key === "pending" && counts.pending ? "bg-indigo-600 text-white" : "text-slate-500")}>
                    {counts[t.key]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {tab === "pending" ? (
        board.pending.length ? (
          <PendingList items={board.pending} canApprove={canApprove} />
        ) : (
          <EmptyState
            icon={HourglassIcon}
            title="Nothing waiting for approval"
            description={
              canApprove
                ? "When a researcher submits a product it appears here for you to approve or drop."
                : "Products you submit appear here until the reviewer approves or drops them."
            }
          />
        )
      ) : null}

      {tab === "approved" ? (
        board.approved.length ? (
          <ApprovedList items={board.approved} />
        ) : (
          <EmptyState icon={BadgeCheckIcon} title="No approved products yet" description="Products appear here once the reviewer approves them. They then show up on the Creative page for the designers." />
        )
      ) : null}

      {tab === "not-approved" ? (
        board.notApproved.length ? (
          <NotApprovedList items={board.notApproved} />
        ) : (
          <EmptyState icon={XCircleIcon} title="No dropped products" description="Products the reviewer drops (or that are dropped during research) are kept here with the reason." />
        )
      ) : null}

      {tab === "drafts" ? (
        <div className="grid gap-6">
          {sentBack.length ? (
            <section aria-labelledby="r-sent-back">
              <h2 id="r-sent-back" className="mb-2 text-section text-rose-700">
                Sent back for changes <span className="num text-meta text-slate-500">{sentBack.length}</span>
              </h2>
              <ResearchList items={sentBack} showOwner />
            </section>
          ) : null}
          {drafts.length ? (
            <section aria-labelledby="r-drafts">
              <h2 id="r-drafts" className="mb-2 text-section text-slate-900">
                Drafts <span className="num text-meta text-slate-500">{drafts.length}</span>
              </h2>
              <ResearchList items={drafts} showOwner />
            </section>
          ) : null}
          {board.drafts.length === 0 ? (
            <EmptyState
              icon={FlaskConicalIcon}
              title="No products in research"
              description={canAdd ? "Click “Add Product” to start a new one. You can save a draft and finish it later." : "Products appear here while the researcher is filling them in."}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
