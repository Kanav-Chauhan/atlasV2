"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Region } from "@/components/region";
import { api } from "@/lib/api";
import type { Org } from "@/lib/types";

export function Settings() {
  const client = useQueryClient();
  const org = useQuery({ queryKey: ["org"], queryFn: () => api<Org>("/org") });
  const save = useMutation({
    mutationFn: (body: Omit<Org, "slug">) => api<Org>("/org", body, "PATCH"),
    onSuccess: (o) => client.setQueryData(["org"], o),
  });

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-[var(--gutter)] py-10">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-muted">How Atlas names and describes your company.</p>
      </header>
      <Region q={org} what="company settings" rows={3} isEmpty={() => false} empty={null}>
        {(o) => (
          <form className="grid gap-4" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save.mutate({ name: String(f.get("name")).trim(), industry: String(f.get("industry")).trim(), description: String(f.get("description")).trim() });
          }}>
            <label className="grid gap-1 text-sm font-medium">Company name<input name="name" required className="field" defaultValue={o.name} /></label>
            <label className="grid gap-1 text-sm font-medium">
              Industry<input name="industry" className="field" defaultValue={o.industry} placeholder="For example, IT services" />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Description
              <textarea name="description" rows={4} className="field py-2" defaultValue={o.description} />
              <span className="font-normal text-muted">One or two sentences about what the company does.</span>
            </label>
            <p className="text-sm text-muted">Company address: <span className="font-mono">{o.slug}</span></p>
            <div className="flex items-center gap-3">
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>{save.isPending ? "Saving" : "Save"}</button>
              <p role="status" className={`text-sm ${save.isError ? "text-error" : "text-muted"}`}>
                {save.isError ? save.error.message : save.isSuccess ? "Saved." : ""}
              </p>
            </div>
          </form>
        )}
      </Region>
    </div>
  );
}
