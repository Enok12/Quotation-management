import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { inventoryService } from "@/server/services/inventory.service";
import { inventoryCategoryService } from "@/server/services/inventory-category.service";
import { fmtMoney } from "@/lib/utils/format";
import { AddProductButton } from "@/components/inventory/add-product-button";
import { EditProductButton } from "@/components/inventory/edit-product-button";
import { ArchiveProductButton } from "@/components/inventory/archive-product-button";
import { AdjustStockButton } from "@/components/inventory/adjust-stock-button";
import { StockHistoryButton } from "@/components/inventory/stock-history-button";

export const metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "INVENTORY")) return <SectionUnavailable section="Inventory Management" />;

  const [products, categories] = await Promise.all([
    inventoryService.list(businessId),
    inventoryCategoryService.list(businessId),
  ]);
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Inventory Management</h1>
          <p className="text-stone-500 text-sm mt-1">{products.length.toLocaleString()} products</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/retail/categories" className="text-sm text-amber-600 hover:underline">Manage Categories</Link>
          <AddProductButton categories={categoryOptions} />
        </div>
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left w-32">SKU</th>
                <th className="th text-left">Name</th>
                <th className="th text-left">Category</th>
                <th className="th text-right w-28">Cost</th>
                <th className="th text-right w-28">Selling</th>
                <th className="th text-right w-24">Qty on Hand</th>
                <th className="th text-right w-28">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={7} className="td text-center text-stone-400 py-10">No products yet — add one to get started.</td></tr>
              )}
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td"><code className="font-mono text-sm font-semibold text-ink">{p.sku}</code></td>
                  <td className="td font-medium">{p.name}</td>
                  <td className="td text-stone-500">{p.category?.name ?? "—"}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(p.costPrice)}</td>
                  <td className="td text-right font-mono text-sm">{fmtMoney(p.sellingPrice)}</td>
                  <td className="td text-right font-mono text-sm">
                    <span className={p.quantityOnHand === 0 ? "text-red-500" : ""}>{p.quantityOnHand}</span>
                  </td>
                  <td className="td">
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      <AdjustStockButton productId={p.id} sku={p.sku} quantityOnHand={p.quantityOnHand} />
                      <StockHistoryButton productId={p.id} sku={p.sku} />
                      <EditProductButton
                        productId={p.id}
                        defaultValues={{
                          sku: p.sku, name: p.name, categoryId: p.categoryId ?? undefined,
                          costPrice: Number(p.costPrice), sellingPrice: Number(p.sellingPrice),
                        }}
                        categories={categoryOptions}
                      />
                      <ArchiveProductButton productId={p.id} sku={p.sku} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
