import type { Metadata } from "next";
import { AdBudgetView, type Tab } from "@/components/ad-budget/ad-budget-view";
import { PageHeader } from "@/components/common/page-header";
import { can } from "@/lib/domain/permissions";
import { requireCapability } from "@/lib/server/auth/current-user";
import { getAdBudget } from "@/lib/server/queries/ad-budget";

export const metadata: Metadata = { title: "Ad budget" };

const TABS = ["overview", "payments", "spend", "accounts"] as const;

export default async function AdBudgetPage({ searchParams }: PageProps<"/ad-budget">) {
  const user = await requireCapability("adbudget.view");
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as Tab) : "overview";
  const thisMonth = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()).slice(0, 7);
  const month = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : thisMonth;
  const data = await getAdBudget(month);
  return (
    <>
      <PageHeader title="Ad budget" description="Payments to the ad fund provider, what each ad account received, who owes whom, and ad spend by month." />
      <AdBudgetView data={data} tab={tab} canManage={can(user, "adbudget.manage")} />
    </>
  );
}
