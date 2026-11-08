@AGENTS.md

# Product Pipeline SOP & Task Manager — project rules

Internal SOP + task tool for a Bangladesh e-commerce team: "Linear for our product launch pipeline".
Not an accounting or analytics product. English UI, Asia/Dhaka time, BDT with lakh grouping.

## Working agreement
- Build **one phase at a time** on its own branch (`phase-N-name`). At the end of a phase run
  `npm run check` (typecheck + lint + tests), push, summarise, list deferred items, then **stop for review**.
- **Ask when a business rule is ambiguous. Never invent business rules.** Decisions already made are
  recorded below under "Agreed decisions".
- **No fake data in production code paths.** Demo/initial data lives only in `prisma/seed.ts`.
- Small, meaningful commits. No model names in commits, PRs or code.

## Status
All six phases are built (foundation, research & SOP engine, creative & review, launch & live,
collaboration & views, overview & polish). The owner asked to build straight through and test at the end.
Browser acceptance scripts were run per phase against a local Postgres; Lighthouse accessibility = 100 on
every page.

## Stack (pinned)
Next.js 16 App Router + TypeScript strict · Tailwind CSS v4 · shadcn-style components on `radix-ui`
(hand-written in `src/components/ui`, the shadcn registry is not reachable from cloud sessions) ·
lucide-react · motion · sonner · cmdk · TanStack Table **v8** (v9 is a different API) · @dnd-kit (checklist reordering + the Tasks board) ·
Prisma 7 + PostgreSQL via `@prisma/adapter-pg` · zod v4 · Vitest · Geist fonts via the `geist` package.

## Portability (non-negotiable)
- Standard Next.js + Prisma + Postgres only. **No Vercel-only services** (KV, Blob, Edge Config, Vercel Postgres SDK).
- `output: "standalone"` stays on; the app must run with `node .next/standalone/server.js` on a VPS.
- Uploads: images (creative work, profile photos) are compressed in the browser (WebP, ≤2000 px; avatars
  384 px square) and stored in Postgres (`Asset.bytes`), served by `/api/assets/[id]`. No object storage
  service, so it stays portable. Videos stay as Drive links (too large). Can move to S3/R2 later.
- **Two repos.** `bexven/sop` = development + Vercel previews (test data). `bexven/sop-domain-live` = live
  (**sop.bexven.tech**, Docker on the owner's VPS, real data). "Push it to live domain" = push the approved
  `sop` main to `sop-domain-live` main (`git push live main`; remote `live`). The server polls every 5 min.
- Live stack (`Dockerfile`, `deploy/docker-compose.yml`): `db` (postgres:17, external volume `sop-db-data`),
  `app` (standalone image `sop-app:<sha>`), `migrate` (one-off `prisma migrate deploy`). HTTPS = the server's existing
  Traefik (labels on `app`); `app` is published on `127.0.0.1:8097` only.
  `deploy/setup.sh` sets up the server once; `deploy/sop.sh` is the `sop` command (update, rollback, backup,
  restore, import, status, logs). Update = backup → build → migrate → switch → `/api/health` release check →
  switch back on failure. **Migrations must stay additive / backwards-compatible.**

## Rendering model
- `cacheComponents` is **off** on purpose: every page is authenticated and request-specific.
- Pages that read the DB but no cookies (e.g. `/login`) must call `await connection()` so they are not
  prerendered at build time.
- Next 16 renamed middleware to **`src/proxy.ts`**. It only checks the cookie signature (edge-safe, no DB).

## Architecture rules
- **All business rules live in `src/lib/domain/`** as pure, unit-tested functions (no Prisma client,
  no Next imports; importing enums from `@/generated/prisma/enums` is fine). Tests sit next to the file
  (`*.test.ts`).
- Domain functions for workflow steps return **plans** (task updates, new tasks, stage change, events,
  notifications); the server applies a plan inside **one** Prisma transaction.
- **Every server action uses `defineAction`** (`src/lib/server/action.ts`): authenticate → authorise by
  capability → validate with zod → transaction → ActivityEvent → notifications → revalidate.
- **Never trust the client** for identity, role or permissions. UI hiding is cosmetic. Pages call
  `requireUser()` / `requireCapability()`; actions declare a `capability`.
- Permissions are **per person** (`User.permissions`, capability keys ticked by the Master Admin on
  `/team/roles`). `src/lib/domain/permissions.ts` lists the capabilities with labels and each job role's
  defaults (used for new people, a job-role change and the one-off migration). Admin access / Master = all.
  `can(subject, cap)` takes `{ role, permissions }` (CurrentUser or Viewer), never a bare role.
- State changes use guarded updates (`updateMany where status = <expected>`) so races fail cleanly.
- Money is `Decimal` in the DB (never Float); pass it to the client as strings; do maths with `decimal.js`.
- Zod schemas live in `src/lib/validation/` and are shared by forms and actions.
- Sessions: JWT (jose, HS256) in an httpOnly cookie, 30 days, carrying `sessionVersion`. Bumping
  `User.sessionVersion` revokes all of that user's sessions (deactivate, PIN reset, PIN change).

## Layout
```
prisma/            schema.prisma, migrations/, seed.ts
src/proxy.ts       cookie-signature gate
src/app/(auth)/    login, change-pin
src/app/(app)/     authenticated shell + pages
src/lib/domain/    pure business rules + tests
src/lib/server/    db, env, auth/, action.ts, actions/, queries/
src/lib/validation zod schemas
src/components/    ui/ (primitives), common/, shell/, auth/, team/, settings/, …
src/generated/     Prisma client (generated, git-ignored)
```

## Design system
- Light only. Glass (`glass`, `glass-strong` utilities) for the app frame and floating layers only:
  sidebar, top bar, dialogs, sheets, popovers, toasts, command palette. Never stack more than 2–3 blurred
  layers; never blur table rows or list items.
- Dense data sits on solid white (`surface` utility); hover lift uses `raised`.
- Write only the standard `backdrop-filter` property in CSS — the build adds the `-webkit-` prefix.
  (Writing both makes the minifier keep only the prefixed one, which Chromium ignores.)
- Type scale utilities: `text-page` (24/600), `text-section` (15/600), `text-body` (14), `text-meta` (12/500).
  Numbers, prices, dates and IDs use the `num` utility (Geist Mono, tabular-nums).
- Radius: `rounded-panel` (14px) for cards/panels, `rounded-control` (10px) for inputs/buttons, full for pills.
- Stage colours: Research sky · Creative violet · Ready to Launch amber · Live emerald · Completed slate ·
  Killed rose. Priority: Urgent rose · High orange · Medium amber · Low slate. Pills are soft tints with
  darker same-hue text (`Pill` component), never solid saturated blocks.
- Motion 150–250 ms ease-out; respect `prefers-reduced-motion`. Skeletons, not spinners, for page content.
- Every empty state says what will appear and what to do next. WCAG AA contrast, visible focus.

## Gotchas learned the hard way
- Horizontal scroll containers must be `relative`: `sr-only` text inside them is `position:absolute`
  and otherwise escapes the scroller and widens the whole page on mobile.
- Grid/flex children that hold wide content need `min-w-0` / `grid-cols-[minmax(0,1fr)]`.
- Never dim content with `opacity` (fails AA contrast); use a muted background instead.
- `--color-slate-500` is overridden (darker) in `globals.css` so tertiary text passes AA on glass.
- Events written in one transaction share a timestamp: order timelines by `createdAt` then `id`.
- `npm run typecheck` runs `next typegen` first (route types for `PageProps<"/route">`).
- A `"use server"` file may only export async functions.

## Owner's redesign (after first test) — supersedes the brief where they differ
- **Top menu bar**, no sidebar. Items: Dashboard · Research (researcher/admin) · Creative (designers,
  editor, media buyer, admin) · Pipeline · Products · Admin ▾ (Overview, Team, Settings). Labels + hints. (Round 9: Settings moved to the profile menu.)
  (Nov 2026: Products ▾ groups Products · Pipeline · Orders; Products ▾ / Admin ▾ / profile menus open on hover.)
- **No slide-over panel.** Products open as a full page `/products/[id]` (back link + breadcrumb);
  `?task=<id>` opens and scrolls to a task.
- **No global "New product".** Only the **Research** page has "Add product" (shortcut `C` → `/research?add=1`).
- **Dashboard** (`/dashboard`, was My Queue) per person: summary counts + their pending tasks.
- **Creative** split into **Images** (image designer: website image, 3 ads, store listing) and **Videos**
  (video editor). Designers upload multiple images per task; Media Buyer/Admin 👍/👎 and comment on each
  image or link. **Approve can also ask for a different angle / different size / something else**, which
  creates a follow-up task (same type, person and batch; keeps the batch open).
- **Profile photos** (`/profile`).
- **No "Scaling" step** in the stepper and SCALING isn't offered as a campaign status (enum kept in DB).

## Round 4 (research revamp)
- **All prices are BDT.** `Product.chinaPriceBdt` / `shippingPerUnitBdt` / `sellingPriceBdt`; landed cost =
  China price + shipping (no exchange rate). Research enters **Weight (kg)** and **Shipping by Air / Sea** (`Product.shippingMethod`, both
  required to submit); the server sets shipping = weight × that method's rate per kg (`Settings.shippingRatePerKgBdt` = Air,
  `Settings.seaShippingRatePerKgBdt` = Sea; snapshot `Product.shippingRatePerKgBdt`, refreshed while in Research, frozen
  at submit; an Admin switching the method later uses today's rate). Older products keep the shipping they were entered with. `rmbToBdtRate` stays in Settings/Product as reference only.
- **Brand colours are hex** (`Brand.color`, e.g. Mr.WOW `#15803D`, Timtom `#0369A1`). `src/lib/brand-color.ts`
  derives AA-safe variants. The product page wraps itself in `brandThemeStyle()` so every primary button,
  checkbox, stepper and focus ring uses the product's brand colour. Primary-coloured UI must use `primary`
  / `ring` / `accent` tokens (not hard-coded indigo) to follow the brand. Dialogs are portaled, so they keep indigo.
- **Research page tabs**: Pending approval (default) · Approved · In research · Not approved (killed at research/review).
- **Product page "simple" layout** (no tabs: details + review + discussion) for job role RESEARCHER always,
  and for everyone while a product is in Research / Product review (or killed there). Tasks and Timeline
  tabs appear only from Creative on, and never for researchers.
- **Step guides ("How we do this") removed** from the UI; the `TaskTypeConfig.guide*` columns are kept but unused.

## Round 5 (phases, boards, orders, permissions) — supersedes earlier rounds where they differ
- **Product page = phase tabs**: Product review · Image creative · Video creative · Meta ads · Orders
  (`phasesFor()` in `product-view.tsx`; `?phase=` selects one; `?task=<id>` opens that task's phase;
  `&ready=1` opens its "ready" form). Researchers and early-stage products get only Product review (no tabs).
  **No Timeline and no Tasks tab** anywhere on the product page (events are still logged).
- **Creative brief** sits between the header and Research on Product review — hidden until approved —
  and at the top of both creative tabs.
- **Each phase has its own discussion** (`Comment.phase`: REVIEW, IMAGES, VIDEOS, ADS, ORDERS; replies keep
  their thread's phase). Never show one phase's comments in another.
- **Creative chain** (new batches): Website product images (one product-page URL) → Meta ads portrait
  (links) → Meta ads square (links); Main video → Square video (links). Each step unlocks when a **Senior**
  (`task.review` permission) approves the previous one. Landscape ads and the store listing are no longer
  created (enum values kept; a data migration cancelled unapproved ones on products in Creative).
  No image uploads / previews / per-image reactions for creative any more; "Something else" follow-up removed
  (angle / size remain as "Approve + ask for…").
- **Kanban board** (`components/creative/product-board.tsx`): rows = sections, columns = To do · In review ·
  Needs changes · Approved. Drag = the same action as the card's buttons (ready → opens the link form;
  Senior: approve / needs changes; maker: take back). Every drag has a button equivalent.
- **Meta ads tab**: campaign status + running info, launch panel, "Move to ordering", floating
  **Image assets / Video assets** buttons (bottom-left; links the makers submitted).
- **Orders**: `Product.orderingSince` (set by "Move to ordering", live products only), `ProductOrder`
  (per-unit buying / shipping / selling prices, independent of research prices, courier % snapshot),
  scaling (`scalable` YES/NO/NOT_SURE + `scalePlans`). Maths in `domain/orders.ts`. `/orders` page lists them.
- **Stepper**: Research · Product review · Image creative · Video creative · Meta ads · Ordering.
  For Admin / Master Admin each reached step is a button that opens its tab (`STEP_PHASE` in `product-view.tsx`).
- **Dashboard**: Admin tiles = whole team (open tasks on running products), others = their own queue; the
  menu badge uses the same queries. Tiles link to the matching list/filter. Auto-refresh every 30 s.
- Floating UI on the product page sits bottom-left because toasts are bottom-right.

## Round 6 (creative boards v2) — supersedes Round 5 where they differ
- **No drag and drop on creative work** (dnd-kit is only for checklist reordering and the manual Tasks board). Boards are status columns
  (To do · In review · Needs changes · Approved) of **clickable cards**; a card opens the **task window**
  (`components/creative/task-dialog.tsx`): links, "ready" form, Senior Approve / Needs changes /
  Approve + ask for…, checklist, admin due-date editor, and the **task's own discussion** (`Comment.taskId`).
- Image/video tabs: brief → (images) "Is the product added on the website?" + link (`Product.websiteUrl`,
  set by the designer, a Senior or Admin) → **batch switcher** → board. No phase discussion under the boards.
  Website product images are submitted as image links like the other tasks.
- **Batches have names**: required when requesting a new batch (`CreativeBatch.name`); batch #1 shows as
  "First creatives". The requester is shown as a `PersonChip` in their avatar colour.
- **Product review**: no discussion, and **no send-back from review** (approve or not approved only).
  Research form no longer has Target customer / Selling angle (DB columns kept, no longer written).
- **Meta ads**: no floating asset buttons; two cards open the Image / Video creative tabs.
- **Stepper** is clickable for everyone who has phase tabs; only the clicked step is highlighted (sliding
  pill, `motion` layoutId). Phase tabs use a sliding pill and fade between panels. Respect reduced motion.
- Due pills read "Due 6 Nov" / "Due tomorrow 6 pm" with a clock icon; full date/time in the tooltip.

## Round 7 (orders, test orders, drop/delete, campaigns, Tasks board)
- **Orders**: each order has weight (kg) + Air/Sea; the server sets `shippingCostBdt` = weight × the method's rate and keeps
  that rate on the order (`ProductOrder.shippingRatePerKgBdt`) while the method stays the same. Older orders keep their typed shipping.
- **Orders have names** (`ProductOrder.name`, required on save; older ones show "Order #n" via `orderTitle()`).
- **Test orders** (`TestOrder`) sit **in the order list**, steps via `testOrderState()`: **requested** (name + note, by
  `orders.manage`; notifies Media Buyer, Admins and Supply Chain) → **ordered**: an Admin / Media Buyer / Supply Chain
  (`canPlaceTestOrder()`) clicks **Mark as ordered** and enters the expected arrival (`placedAt/By`, `expectedOn`) — only now
  the row turns amber (rose when overdue); no separate banner → **arrived** (Confirm arrived; quality Passed/Failed after).
  Everyone who sees the Orders tab sees them. Not counted in order totals. New orders notify the Media Buyer and every Admin.
- **Kill is now "Drop"** in the UI (status "Dropped"); enum/columns stay `KILLED` / `kill*`. Dropping is one tap: reason chips and note are
  optional (no reason = Other). **Admins can delete for good**: "Drop & delete for good" in the Drop window, or "Delete for good"
  (one confirm) on a dropped product; everything cascades; a `PRODUCT_DELETED` event keeps name + number.
- **Campaigns**: many per product in `AdCampaign` (number, **name**, **type**: Image / Video / Carousel / Pre-order /
  Catalogue / Messages). The old one-per-product `Campaign` table is kept unused (rows copied as #1) so older releases still run.
  Product campaign status = `overallCampaignStatus()` (running while any campaign runs). The first campaign launches with
  the launch task; Media Buyers/Admins (`campaign.manage`) add more with **New campaign** while live; status and details
  are changed per campaign. Drop / complete stop every campaign.
- **Tasks board** (`/tasks`, everyone): `ManualTask` (title, details, To do / In progress / In review / Done, urgency =
  `Priority`, due time (Dhaka), assignee, optional product, links) + `ManualTaskComment` with @mentions. Drag and drop
  (pointer, touch, keyboard) or the Status field in the task window. Creator, assignee and Admins can change / move;
  creator or Admin can delete; anyone can comment. Tasks linked to a restricted-brand product are hidden like the product.
  Notifications carry `Notification.link` (`/tasks?task=…`). Dashboard lists "From the Tasks board".
  Actions take `manualTaskId` (never `taskId`, which `brandAllowed` reads as a workflow task).

## Round 8 (running products, resources, dashboards, reminders)
- **New product** button on the dashboard for Admins and Media Buyers (`canAddProduct` / `canAddRunningProduct` in
  `domain/resources.ts`; Media Buyers can now add products too). The add window has two modes: **New product** (research as
  before) and **Already running** (Admins / Media Buyers): name + brand required, image / supplier / resources optional;
  it starts **Live** (`Product.addedRunning`, campaign #1 "Running campaign" RUNNING) and the picked creative batch
  (name, formats, due) is created and assigned straight away.
- **Resources = one shared list**: product links (`referenceLinks`) + links added on the Image tab (`imageResourceLinks`)
  + Video tab (`videoResourceLinks`) all show on Product review and on both creative tabs, each tagged Product / Images /
  Videos. A tab's makers, Seniors, Media Buyers and Admins add there (`canEditResources`) and can remove that tab's links.
- **Dashboards** lead with the product (brand + name), then "Your task: …"; Creative cards the same. Supply Chain / Media
  Buyers / Admins get a **Test orders** section (to place / on their way). Every job role has a help line.
- **Due reminders** (`domain/reminders.ts`, `runDueReminders`, on every `/api/cron/morning` call): one "Due soon" ~3 h
  before and one "Overdue" notification per due time (`dueSoonNotifiedAt` / `overdueNotifiedAt` on Task and ManualTask),
  also sent to phones / Telegram. On Vercel the scheduler only runs daily; on the VPS every 10 minutes.
- A named batch #1 shows its own name (falls back to "First creatives").

## Round 9 (Add Product, Shipments, Ad budget, roles)
- **"Add Product"** everywhere (button, window, shortcut). New permission **Add running products** (`product.addRunning`,
  Media Buyers by default; Shakil has it and `product.create`). Already-running products take name, brand, product URL
  (`websiteUrl`), picture, **old image / video assets** (`Product.oldImageAssets` / `oldVideoAssets`, shown with Resources
  tagged "Old images" / "Old videos") and resources; **new creatives are optional** (tick box). Shared service
  `services/running-product.ts`.
- **Settings** lives in the profile menu (removed from Admin ▾).
- **Shipment Management** (`/shipments`, Products ▾; `shipments.view` / `shipments.manage`, Supply Chain + Media Buyers by
  default): `ShippingVendor` (Al Baraka default, add more inline), `Shipment` (product, vendor, ordered by (text), order date,
  total weight, quantity, shipping cost typed in BDT, ETA, shipping paid?, arrived?, note). States via `shipmentState()`
  (ordered / on the way / late / arrived — arrived cards are green); filters All · On the way · Payment pending · Arrived.
  **Request reorder** creates a new shipment for the same product (`reorderOfId`, `reorderDraft()`). "Add a product for
  listing" creates a running product. **Every new product order (Orders tab) creates a shipment** (`productOrderId`,
  default vendor, weight × qty, shipping × qty) and notifies Supply Chain; order rows link to it.
- **Ad budget** (`/ad-budget`, Admin ▾; `adbudget.view` / `adbudget.manage`, Admins only by default): `AdProvider`,
  `AdAccount` (currency code; `CURRENCIES` in `domain/ad-budget.ts`; editable), and **ad funds** (see Round 10).
- **Roles & permissions**: every capability has a feature `group` (`CAPABILITY_GROUPS`); a new capability shows up on the
  Roles page automatically, unticked. `PermissionRole` = named permission set; `User.permissionRoleId` + `extraPermissions`;
  `User.permissions` always = `effectivePermissions(role, extras)` (recomputed when a role or person changes), so `can()`
  is unchanged. New people / job-role changes start on the role named after the job role. Roles tab (grouped grid) and
  People tab (job role, permission role, admin access, extras, restricted brands).

## Round 10 (ad funds, shipment dates) — supersedes Round 9 where they differ
- **Ad fund** = one `AdPayment` row (kept the table): provider, fund receive date (`paidOn`), credited accounts (`AdCredit`s),
  the **provider bill** (`amountBdt`, computed by `fundBill()`): BDT credits + a typed fee (`feeBdt`) + USD credits × the fund's
  dollar rate (`usdRate`, no fee). Paid? YES/NO (`paid`, `paidAt` = paid date), reference, note. "Record Ad Fund" on Overview.
- Overview tiles in order: Ad fund cost this month · Provider balance (unpaid bills = what we owe) · Received BDT accounts ·
  Received USD accounts. **Ad spend tab is automatic**: the fund bills month by month (no manual entries; `AdSpend` table and
  its actions are kept unused). Month switcher uses ‹ › buttons (the native month input's icon was invisible).
- **Shipments**: tiles On the way · Shipping unpaid · Shipping paid (BDT) · Active Shipments (= all shipments); tiles that
  match a filter are clickable; the page opens on **All**. `Shipment.shippingPaidOn` / `arrivedOn` (Dhaka days; `flagDay()`):
  set to today by the one-tap buttons, editable in the dialog. Desktop = table, below `lg` = cards.

## Alerts: phone push + Telegram + 10:00 summary
- **Web Push** (free, `web-push`): `public/sw.js` shows notifications; `src/app/manifest.ts` + `/public/icons`
  make the app installable (iPhone only allows push from a home-screen app). VAPID keys are generated on first
  use and stored in `Settings` — no env vars. Devices: `PushDevice` (removed when the push service says 404/410).
- **Telegram** (free): an Admin pastes the BotFather token in **Settings → Notifications**; the server checks it
  (`getMe`), sets the webhook to `/api/telegram/webhook` with a random `secret_token` and stores token/username/
  secret in `Settings`. People link from **My profile → Connect Telegram** (one-time `/start <code>`, 15 min).
  Bot commands: `/today`, `/stop`. Telegram needs a public https address (won't work on localhost).
- **Instant alerts**: every in-app `Notification` is also sent to the person's devices/Telegram after the
  action's response (`after()` in `defineAction` → `flushAlerts()`, claimed via `pushedAt`). Per-person
  `alertsInstant` / `alertsDigest` toggles.
- **Morning summary** (`domain/digest.ts`, `runMorningDigest`): `/api/cron/morning`, scheduled by `vercel.json`
  (`0 4 * * *` UTC = 10:00 Dhaka; on Vercel Hobby it may arrive any time within that hour). On a VPS use system
  cron. Idempotent: never before 10:00 Dhaka and once per day (`Settings.lastDigestOn`). Optional `CRON_SECRET`.
- `/api/telegram`, `/api/cron`, `/sw.js`, `/manifest.webmanifest` are public in `proxy.ts` (they check their callers).
- **`/` is a public front page** ("eCom SOP system" + Log in / Open dashboard).
- **Push self-heals**: `PushSync` (app shell) re-saves this browser's subscription once per tab and replaces one made with
  an older VAPID key; the server deletes devices that answer 401/403/404/410.

## Team & restricted brands (Nov 2026)
- Team: Sk Moni (Master Admin) · Inamul (Reviewer, every permission except Bexven) · Jewel Rana (Admin) ·
  Shohagh (Media Buyer) · Rony (Video Editor) · Shakil (Image Designer, took over Kamrul's open work) ·
  Antu (Customer Support) · Fahim (Office Boy; enum `OFFICE_SECRETARY`) · Saddam (Supply Chain, `SUPPLY_CHAIN`,
  default `orders.manage`; added by a data migration without a PIN). New job roles: `CUSTOMER_SUPPORT`, `OFFICE_SECRETARY`
  (no default permissions). No PINs in migrations/seed: the Master Admin uses **Team → PIN for everyone**
  (sets one temporary PIN, forces a new PIN at next sign-in).
- **Removed people**: `User.removedAt` (Team → inactive → Remove). Hidden everywhere, history kept; sessions die.
- **Restricted brands** (`Brand.restricted`, e.g. **Bexven**): only the Master Admin and people ticked in the
  brand's column on Roles & permissions (`User.brandAccess`) see its products — even Admins need the tick.
  Enforced by `productScope()/taskScope()` (`services/brand-scope.ts`) in every product/task query,
  `getProductDetail(id, viewer)` (null → 404), `brandAllowed()` in `defineAction` (any action naming a
  productId/taskId/brandId), `notify()` (no notifications to people without access) and auto-assignment
  (`autoAssign(..., { brandId })` only picks people with access; otherwise unassigned).
  Only the Master Admin can mark a brand restricted (Settings → Brands).
- Research task: creator keeps it when they're a researcher **or when no researcher exists**.

## Mobile patterns
- Horizontal swipe rows use `no-scrollbar` (no visible scrollbar). Phase tabs never wrap and keep the open
  tab in view. Stepper has a compact phone layout (`CompactStepper`). Wide tables become card lists below
  `md` (products, orders); the pipeline stacks stages as collapsible sections; the task window is a
  bottom sheet on phones; empty board columns collapse to one line.

## Agreed decisions (from the brief review)
- Q1 Each product has an owning Media Buyer (`Product.mediaBuyerId`), auto-assigned at research submit;
  they write the brief, get review notifications and launch. Any Media Buyer or Admin may still review.
- Q2 Send-back Creative → Research cancels open creative tasks and reopens Research as REVISION;
  resubmitting creates a new batch (next number) with Phase 1 gating.
- Q3 If a Phase 1 task is reopened, its non-approved Phase 2 dependents go back to LOCKED; approved stay approved.
- Q4 Media Buyer may send back Creative → Research and Ready to Launch → Creative; Admin any stage to an
  earlier one. When sending to Creative the actor picks which tasks to reopen.
- Q5 No send-back from LIVE (use a new creative batch or Kill).
- Q6 Mark Completed auto-cancels open tasks (with confirmation).
- Q7 KILLED is terminal.
- Q8 Deactivating someone re-runs auto-assignment on their open tasks; if nobody is available they stay
  unassigned and Admin is notified.
- Q9 The creative brief is not a gate; tasks show "Brief pending" until it is written.
- Q10 Batch #N may include any of the 6 creative types (never the store listing); it snapshots the brief.
- Q11 Seeded non-admins and admin PIN resets set `mustChangePin`.
- Q12 Everyone can view all products/pipeline; mutations are role-gated.
- Q13 Stepper shows "Creative: step 2 & store" once both Phase 1 tasks are approved.
- Q14 Campaign STOPPED ≠ COMPLETED; completion is an explicit action.
- Auto-assignment counts LOCKED + TODO + REVISION + SUBMITTED as open; tie → least recently assigned.
- Research task belongs to its creator (Admin-created → auto-assigned to a Researcher; if none, the creator keeps it).
- Rate snapshot refreshes on every save while in RESEARCH and freezes at submit.
- Due dates = unlock time + SLA hours (wall clock, Asia/Dhaka for display/"due today").
- Margin badge is informational only, never blocks submit.
- Admin override edits data fields only, never stage/status.
- Notifications are in-app, polled (~30 s) — no websockets.

## Commands
`npm run dev` · `npm run check` · `npm test` · `npm run db:migrate` (create migration, local) ·
`npm run db:deploy` · `npm run db:seed` · `npm run build`
