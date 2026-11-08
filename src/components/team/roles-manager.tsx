"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CrownIcon, LockIcon, PlusIcon, SaveIcon, ShieldCheckIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { toast } from "sonner";
import type { Role } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, ROLES } from "@/lib/domain/labels";
import { CAPABILITIES, capabilitiesByGroup, type Capability } from "@/lib/domain/permissions";
import { deletePermissionRoleAction, savePermissionRoleAction, setAccessAction } from "@/lib/server/actions/team";
import type { PermissionRoleDTO, TeamRow } from "@/lib/server/queries/team";
import { cn } from "@/lib/utils";

type RestrictedBrand = { id: string; name: string; color: string };
const GROUPS = capabilitiesByGroup();
const NONE = "none";

export function RolesManager({ team, roles, brands }: { team: TeamRow[]; roles: PermissionRoleDTO[]; brands: RestrictedBrand[] }) {
  const [tab, setTab] = useState<"roles" | "people">("roles");
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div role="tablist" aria-label="Roles and people" className="inline-flex w-fit rounded-control bg-slate-900/[0.04] p-1">
        {(
          [
            ["roles", "Roles", ShieldCheckIcon],
            ["people", "People", UsersIcon],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-body transition-colors duration-150",
              tab === k ? "bg-white font-medium text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <Icon className="size-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === "roles" ? <RolesTab roles={roles} /> : <PeopleTab team={team} roles={roles} brands={brands} />}
    </div>
  );
}

// ── Roles: each role is a set of permissions, grouped by feature ─────────────

function RolesTab({ roles }: { roles: PermissionRoleDTO[] }) {
  const [selected, setSelected] = useState<string | "new">(roles[0]?.id ?? "new");
  const role = selected === "new" ? null : (roles.find((r) => r.id === selected) ?? null);
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav aria-label="Roles" className="surface grid content-start gap-1 rounded-panel p-2">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r.id)}
            aria-current={selected === r.id ? "true" : undefined}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded-control px-3 py-2 text-left text-body transition-colors",
              selected === r.id ? "bg-indigo-50 font-medium text-indigo-900" : "text-slate-700 hover:bg-slate-50",
            )}
          >
            <span className="truncate">{r.name}</span>
            <span className="num shrink-0 text-meta text-slate-500">
              {r.people} · {r.permissions.length}
            </span>
          </button>
        ))}
        <Button variant="outline" size="sm" className="mt-1" onClick={() => setSelected("new")}>
          <PlusIcon /> New role
        </Button>
        <p className="px-1 pt-1 text-meta font-normal text-slate-500">People · permissions</p>
      </nav>
      <RoleEditor key={role?.id ?? "new"} role={role} onCreated={() => setSelected("new")} />
    </div>
  );
}

function RoleEditor({ role, onCreated }: { role: PermissionRoleDTO | null; onCreated: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<string[]>(role?.permissions ?? []);
  const [pending, startTransition] = useTransition();
  const toggle = (k: string, on: boolean) => setPerms((p) => (on ? [...new Set([...p, k])] : p.filter((x) => x !== k)));

  return (
    <section aria-label={role ? `Edit ${role.name}` : "New role"} className="surface grid content-start gap-4 rounded-panel p-4 sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <label className="grid gap-1.5 text-meta text-slate-700">
          Role name
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Supply Chain" />
        </label>
        <label className="grid gap-1.5 text-meta text-slate-700">
          Description
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this role is for (optional)" />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {GROUPS.map((g) => {
          const all = g.keys.every((k) => perms.includes(k));
          return (
            <fieldset key={g.group} className="grid content-start gap-2 rounded-control bg-slate-50/70 p-3 ring-1 ring-slate-900/[0.05] ring-inset">
              <legend className="sr-only">{g.group}</legend>
              <div className="flex items-center justify-between gap-2">
                <span className="text-meta font-semibold text-slate-800">{g.group}</span>
                <button type="button" className="cursor-pointer text-meta text-indigo-700 hover:underline" onClick={() => g.keys.forEach((k) => toggle(k, !all))}>
                  {all ? "Clear" : "All"}
                </button>
              </div>
              {g.keys.map((k) => (
                <label key={k} className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox className="mt-0.5" checked={perms.includes(k)} onCheckedChange={(v) => toggle(k, v === true)} />
                  <span>
                    <span className="block text-body text-slate-900">{CAPABILITIES[k].label}</span>
                    <span className="block text-meta font-normal text-slate-500">{CAPABILITIES[k].hint}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {role ? (
          <Button
            variant="ghost"
            className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete the ${role.name} role?${role.people ? ` ${role.people} ${role.people === 1 ? "person keeps" : "people keep"} only their extra permissions.` : ""}`)) return;
              startTransition(async () => {
                const r = await deletePermissionRoleAction({ roleId: role.id });
                if (r.ok) {
                  toast.success(r.message);
                  router.refresh();
                } else toast.error(r.error);
              });
            }}
          >
            <Trash2Icon /> Delete role
          </Button>
        ) : null}
        <span className="text-meta font-normal text-slate-500">
          {role ? `${role.people} ${role.people === 1 ? "person has" : "people have"} this role. Saving updates them right away.` : "Give people this role on the People tab."}
        </span>
        <Button
          className="ml-auto"
          disabled={pending || name.trim().length < 2}
          onClick={() =>
            startTransition(async () => {
              const r = await savePermissionRoleAction({ roleId: role?.id ?? null, name, description, permissions: perms });
              if (r.ok) {
                toast.success(r.message);
                if (!role) onCreated();
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          <SaveIcon /> {role ? "Save role" : "Create role"}
        </Button>
      </div>
    </section>
  );
}

// ── People: job role, permission role, extras, admin access, restricted brands ─

function PeopleTab({ team, roles, brands }: { team: TeamRow[]; roles: PermissionRoleDTO[]; brands: RestrictedBrand[] }) {
  const people = team.filter((p) => p.active);
  return (
    <ul className="grid gap-3">
      {people.map((p) => (
        <PersonRow key={p.id + (p.permissionRoleId ?? "") + p.extraPermissions.join() + p.role + p.adminAccess + p.brandAccess.join()} person={p} roles={roles} brands={brands} />
      ))}
    </ul>
  );
}

function PersonRow({ person, roles, brands }: { person: TeamRow; roles: PermissionRoleDTO[]; brands: RestrictedBrand[] }) {
  const router = useRouter();
  const [job, setJob] = useState<Role>(person.role);
  const [admin, setAdmin] = useState(person.adminAccess);
  const [roleId, setRoleId] = useState(person.permissionRoleId ?? "");
  const [extras, setExtras] = useState<string[]>(person.extraPermissions);
  const [brandAccess, setBrandAccess] = useState<string[]>(person.brandAccess);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fixed = person.isMaster;
  const everything = fixed || admin || job === "ADMIN";
  const rolePerms = useMemo(() => roles.find((r) => r.id === roleId)?.permissions ?? [], [roles, roleId]);
  const total = new Set([...rolePerms, ...extras].filter((k) => k in CAPABILITIES)).size;
  const dirty =
    job !== person.role ||
    admin !== person.adminAccess ||
    roleId !== (person.permissionRoleId ?? "") ||
    extras.slice().sort().join() !== person.extraPermissions.slice().sort().join() ||
    brandAccess.slice().sort().join() !== person.brandAccess.slice().sort().join();

  function save() {
    startTransition(async () => {
      const r = await setAccessAction({ id: person.id, role: job, adminAccess: admin, permissionRoleId: roleId || null, extraPermissions: extras, brandAccess });
      if (r.ok) {
        toast.success(r.message);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <li className="surface grid gap-3 rounded-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <UserAvatar name={person.name} color={person.avatarColor} imageId={person.avatarAssetId} size="sm" />
        <span className="min-w-28 font-semibold text-slate-900">{person.name}</span>
        {fixed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-meta text-amber-800 ring-1 ring-amber-200 ring-inset">
            <CrownIcon className="size-3.5" aria-hidden /> Master Admin · everything
          </span>
        ) : (
          <>
            <Select value={job} onValueChange={(v) => setJob(v as Role)}>
              <SelectTrigger className="h-9 w-44" aria-label={`${person.name}'s job role`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleId || NONE} onValueChange={(v) => setRoleId(v === NONE ? "" : v)} disabled={everything}>
              <SelectTrigger className="h-9 w-48" aria-label={`${person.name}'s permission role`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No role</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {job !== "ADMIN" ? (
              <label className="flex cursor-pointer items-center gap-2 text-body text-slate-800">
                <Checkbox checked={admin} onCheckedChange={(v) => setAdmin(v === true)} /> Admin access
              </label>
            ) : null}
            <span className="text-meta font-normal text-slate-600">{everything ? "Everything" : `${total} permission${total === 1 ? "" : "s"}${extras.length ? ` · ${extras.length} extra` : ""}`}</span>
            <span className="ml-auto flex gap-2">
              {!everything ? (
                <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                  {open ? "Hide" : "Extra permissions"}
                </Button>
              ) : null}
              <Button size="sm" disabled={pending || !dirty} onClick={save}>
                <SaveIcon /> Save
              </Button>
            </span>
          </>
        )}
      </div>
      {!fixed && brands.length ? (
        <div className="flex flex-wrap items-center gap-3 text-meta text-slate-700">
          {brands.map((b) => (
            <label key={b.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={brandAccess.includes(b.id)} onCheckedChange={(v) => setBrandAccess((cur) => (v === true ? [...cur, b.id] : cur.filter((x) => x !== b.id)))} />
              <LockIcon className="size-3.5 text-slate-500" aria-hidden /> Can see {b.name}
            </label>
          ))}
        </div>
      ) : null}
      {open && !everything ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {GROUPS.map((g) => (
            <fieldset key={g.group} className="grid content-start gap-1.5 rounded-control bg-slate-50/70 p-3 ring-1 ring-slate-900/[0.05] ring-inset">
              <legend className="mb-1 text-meta font-semibold text-slate-800">{g.group}</legend>
              {g.keys.map((k: Capability) => {
                const fromRole = rolePerms.includes(k);
                return (
                  <label key={k} className={cn("flex items-center gap-2 text-body", fromRole ? "cursor-default text-slate-600" : "cursor-pointer text-slate-900")} title={CAPABILITIES[k].hint}>
                    <Checkbox
                      checked={fromRole || extras.includes(k)}
                      disabled={fromRole}
                      onCheckedChange={(v) => setExtras((cur) => (v === true ? [...cur, k] : cur.filter((x) => x !== k)))}
                    />
                    {CAPABILITIES[k].label}
                    {fromRole ? <span className="text-meta font-normal text-slate-500">· from role</span> : null}
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      ) : null}
    </li>
  );
}
