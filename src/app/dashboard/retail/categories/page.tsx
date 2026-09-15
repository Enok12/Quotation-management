import { requireBusiness } from "@/lib/auth";
import { getBusinessAccess, hasSection } from "@/lib/section-access";
import { SectionUnavailable } from "@/components/dashboard/section-unavailable";
import { inventoryCategoryService } from "@/server/services/inventory-category.service";
import { AddCategoryButton } from "@/components/inventory/add-category-button";
import { CategoryRowActions } from "@/components/inventory/category-row-actions";

export const metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const { businessId, role } = await requireBusiness();
  const access = await getBusinessAccess(businessId, role);
  if (!hasSection(access, "INVENTORY")) return <SectionUnavailable section="Inventory Management" />;

  const categories = await inventoryCategoryService.list(businessId);

  return (
    <div className="px-4 py-6 sm:px-8 sm:py-8 max-w-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-ink">Categories</h1>
          <p className="text-stone-500 text-sm mt-1">Product categories for Inventory</p>
        </div>
        <AddCategoryButton />
      </div>

      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th text-left">Name</th>
                <th className="th text-right w-28">Products</th>
                <th className="th text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr><td colSpan={3} className="td text-center text-stone-400 py-10">No categories yet — add one to get started.</td></tr>
              )}
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-stone-25 dark:hover:bg-white/5 transition-colors">
                  <td className="td font-medium">{c.name}</td>
                  <td className="td text-right font-mono text-sm">{c._count.products}</td>
                  <td className="td text-right">
                    <CategoryRowActions id={c.id} name={c.name} productCount={c._count.products} />
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
