"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewProductDialog } from "@/components/product/new-product-dialog";
import type { BrandDTO } from "@/lib/server/queries/product";

/** "Add product" on the Research page. Opens automatically with ?add=1 (from the C shortcut or links). */
export function AddProductButton({ brands, canResearch = true, canRunning = false, label = "Add Product" }: { brands: BrandDTO[]; canResearch?: boolean; canRunning?: boolean; label?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(params.get("add") === "1");
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon /> {label}
      </Button>
      <NewProductDialog
        brands={brands}
        canResearch={canResearch}
        canRunning={canRunning}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o && params.get("add")) router.replace(pathname, { scroll: false });
        }}
      />
    </>
  );
}
