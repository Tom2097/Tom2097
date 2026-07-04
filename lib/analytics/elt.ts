import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logging"

export interface SyncConfig {
  source_table: string
  target_table: string
  column_mapping: Record<string, string>
  incremental_key: string
  batch_size: number
}

export async function runIncrementalSync(
  organizationId: string,
  config: SyncConfig,
): Promise<{ inserted: number; updated: number }> {
  const db = createServiceClient()
  let inserted = 0
  let updated = 0
  let offset = 0

  const { data: lastSync } = await db
    .from("elt_sync_log")
    .select("last_sync_at")
    .eq("organization_id", organizationId)
    .eq("source_table", config.source_table)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const since = (lastSync?.last_sync_at as string) ?? new Date(0).toISOString()

  while (true) {
    const { data: rows, error } = await db
      .from(config.source_table)
      .select("*")
      .eq("organization_id", organizationId)
      .gte(config.incremental_key, since)
      .order(config.incremental_key, { ascending: true })
      .range(offset, offset + config.batch_size - 1)

    if (error || !rows || rows.length === 0) break

    for (const row of rows) {
      const mapped: Record<string, unknown> = {}
      for (const [sourceKey, targetKey] of Object.entries(config.column_mapping)) {
        mapped[targetKey] = (row as Record<string, unknown>)[sourceKey]
      }
      mapped.organization_id = organizationId

      const { error: upsertErr } = await db
        .from(config.target_table)
        .upsert(mapped, { onConflict: `${config.incremental_key},organization_id` })

      if (upsertErr) {
        logger.logError("[v0] ELT upsert failed:", { error: upsertErr.message })
      } else {
        const isNew = String((row as Record<string, unknown>)[config.incremental_key]) >= since
        if (isNew) { inserted++ } else { updated++ }
      }
    }

    offset += config.batch_size
  }

  await db.from("elt_sync_log").insert({
    organization_id: organizationId,
    source_table: config.source_table,
    target_table: config.target_table,
    last_sync_at: new Date().toISOString(),
    rows_inserted: inserted,
    rows_updated: updated,
  })

  return { inserted, updated }
}
