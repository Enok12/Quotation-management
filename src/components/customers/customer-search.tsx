"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function CustomerSearch({
  defaultValue,
  placeholder = "Search by name, phone, or email…",
}: {
  defaultValue: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (e.target.value) {
        params.set("search", e.target.value);
        params.set("page", "1");
      } else {
        params.delete("search");
      }
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="relative">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        type="text"
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={cn("field-input pl-9 max-w-sm", isPending && "opacity-60")}
      />
    </div>
  );
}
