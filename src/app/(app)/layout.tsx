import { CommandPalette } from "@/components/shell/command-palette";
import { PushSync } from "@/components/shell/push-sync";
import { TopNav } from "@/components/shell/top-nav";
import { navItemsFor } from "@/lib/domain/nav";
import { can } from "@/lib/domain/permissions";
import { canAddProduct } from "@/lib/domain/resources";
import { requireUser } from "@/lib/server/auth/current-user";
import { getQueueCount } from "@/lib/server/queries/queue";
import { vapidKeys } from "@/lib/server/services/alerts";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navItemsFor(user, { isMaster: user.isMaster });
  const shellUser = { name: user.name, role: user.jobRole, avatarColor: user.avatarColor, avatarAssetId: user.avatarAssetId };
  const [queueCount, vapidPublicKey] = await Promise.all([
    getQueueCount(user),
    vapidKeys().then((k) => k.publicKey).catch(() => null),
  ]);
  const badges = { dashboard: queueCount };

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-white focus:px-3 focus:py-2 focus:shadow-lg">
        Skip to content
      </a>
      <TopNav items={items} user={shellUser} badges={badges} canSettings={can(user, "settings.manage")} />
      <main id="main" className="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:pt-8">
        {children}
      </main>
      <CommandPalette items={items} canCreate={canAddProduct(user)} />
      <PushSync vapidPublicKey={vapidPublicKey} />
    </div>
  );
}
