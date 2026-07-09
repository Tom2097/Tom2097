import { Boxes, Package, Truck, Wrench, Calendar, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { extractTenantContext } from "@/lib/multitenant/context.server"
import { getAssetTree } from "@/lib/resources/assets"
import { listInventory } from "@/lib/resources/inventory"
import { getCapacityUtilization, getVendorScorecard } from "@/lib/resources/analytics"
import { getTranslator } from "@/lib/i18n/server"

export default async function ResourcesPage() {
  const ctx = await extractTenantContext()
  const t = await getTranslator(ctx?.locale)
  const orgId = ctx?.organizationId

  const [assets, inventory, capacity, vendors] = orgId
    ? await Promise.all([
        getAssetTree(orgId).catch(() => []),
        listInventory(orgId).catch(() => []),
        getCapacityUtilization(orgId).catch(() => null),
        getVendorScorecard(orgId).catch(() => []),
      ])
    : [[], [], null, []]

  const lowStock = inventory.filter((i) => (i.quantity ?? 0) <= (i.reorder_point ?? 0))
  const utilization = capacity ? Math.round(capacity.utilization_pct * 100) / 100 : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-500">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("resources.page.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("resources.page.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline"><Package className="h-4 w-4 mr-2" />{t("resources.page.addAsset")}</Button>
           <Button><Wrench className="h-4 w-4 mr-2" />{t("resources.page.schedule")}</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("resources.page.assetRegistry")}</p>
          <p className="text-3xl font-bold text-foreground">{assets.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{t("resources.page.acrossAllCategories")}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("resources.page.inventory")}</p>
          <p className="text-3xl font-bold text-foreground">{inventory.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{lowStock.length} {t("resources.page.belowReorderPoint")}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("resources.page.capacity")}</p>
          <p className={`text-3xl font-bold ${utilization > 90 ? "text-red-500" : utilization > 70 ? "text-amber-500" : "text-green-500"}`}>
            {utilization}%
          </p>
           <p className="text-xs text-muted-foreground mt-1">{capacity ? `${capacity.available} ${t("resources.page.of")} ${capacity.total_capacity} ${t("resources.page.free")}` : "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <p className="text-sm text-muted-foreground">{t("resources.page.vendors")}</p>
          <p className="text-3xl font-bold text-foreground">{vendors.length}</p>
           <p className="text-xs text-muted-foreground mt-1">{t("resources.page.scorecardsActive")}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4">
           <h3 className="flex items-center gap-2 text-sm font-semibold text-red-500 mb-2">
             <AlertTriangle className="h-4 w-4" />{t("resources.page.lowStock")}
           </h3>
          <div className="flex flex-wrap gap-2">
            {lowStock.map((item) => (
              <span key={item.id} className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded-full">
                {item.name} ({item.quantity}/{item.reorder_point})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
             <Boxes className="h-5 w-5 text-blue-500" />{t("resources.page.assetRegistry")}
           </h3>
          {assets.length > 0 ? (
            <div className="space-y-1.5">
              {assets.map((asset) => (
                <div key={asset.id} className="flex items-center justify-between rounded-xl bg-secondary/30 p-2.5 text-sm"
                  style={{ marginLeft: asset.parent_id ? `${(asset.depth ?? 0) * 16}px` : "0" }}>
                  <span className="font-medium">{asset.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{asset.category ?? "uncategorized"}</span>
                </div>
              ))}
            </div>
           ) : (
             <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">{t("resources.page.noAssets")}</div>
           )}
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-6">
           <h3 className="flex items-center gap-2 text-lg font-semibold mb-4">
             <Truck className="h-5 w-5 text-indigo-500" />{t("resources.page.vendorPerformance")}
           </h3>
          {vendors.length > 0 ? (
            <div className="space-y-3">
              {vendors.slice(0, 10).map((v, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-secondary/30 p-3">
                  <span className="text-sm font-medium">{v.vendor}</span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className={v.on_time_delivery >= 80 ? "text-green-500" : "text-red-500"}>OTD {v.on_time_delivery}%</span>
                    <span className={v.quality >= 80 ? "text-green-500" : "text-red-500"}>Q {v.quality}%</span>
                    <span className="font-semibold text-foreground">{v.overall}/100</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">{t("resources.page.noVendors")}</div>
          )}
        </div>
      </div>
    </div>
  )
}
