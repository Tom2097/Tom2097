import { type DomainEvent } from "@/lib/events/bus"
import { perceive } from "./engine"
import { upsertEntity, relateEntities } from "./operational-graph"

export async function handleDomainEvent(event: DomainEvent): Promise<void> {
  switch (event.type) {
    case "compliance.gap_detected":
      await perceive({
        organizationId: event.organization_id,
        eventType: "compliance.gap_detected",
        sourceModule: "compliance",
        title: `Compliance gap: ${(event.data as Record<string, unknown>).gap_id}`,
        description: `Gap score: ${(event.data as Record<string, unknown>).score}`,
        entityId: (event.data as Record<string, unknown>).gap_id as string,
        entityType: "compliance_gap",
        evidence: event.data as Record<string, unknown>,
        signalStrength: ((event.data as Record<string, unknown>).score as number) >= 8 ? 0.9 : 0.6,
      })
      break

    case "compliance.capa_created":
      await upsertEntity({
        id: (event.data as Record<string, unknown>).capa_id as string,
        organizationId: event.organization_id,
        type: "compliance_gap",
        name: `CAPA #${(event.data as Record<string, unknown>).capa_id}`,
        status: "active",
        module: "compliance",
        properties: event.data as Record<string, unknown>,
      })
      break

    case "compliance.cert_expiring":
      await perceive({
        organizationId: event.organization_id,
        eventType: "compliance.cert_expiring",
        sourceModule: "compliance",
        title: "Certificate expiring",
        description: `${(event.data as Record<string, unknown>).cert_id} expires in ${(event.data as Record<string, unknown>).days_remaining} days`,
        entityId: (event.data as Record<string, unknown>).cert_id as string,
        entityType: "certificate",
        evidence: event.data as Record<string, unknown>,
        signalStrength: ((event.data as Record<string, unknown>).days_remaining as number) <= 7 ? 0.95 : 0.7,
      })
      break

    case "resources.low_stock":
      await perceive({
        organizationId: event.organization_id,
        eventType: "resources.low_stock",
        sourceModule: "resources",
        title: "Low stock alert",
        description: `Item ${(event.data as Record<string, unknown>).item_id}: ${(event.data as Record<string, unknown>).current_qty} remaining`,
        entityId: (event.data as Record<string, unknown>).item_id as string,
        entityType: "resource",
        evidence: event.data as Record<string, unknown>,
        signalStrength: ((event.data as Record<string, unknown>).current_qty as number) <= 5 ? 0.9 : 0.6,
      })
      break

    case "resources.maintenance_due":
      await perceive({
        organizationId: event.organization_id,
        eventType: "resources.maintenance_due",
        sourceModule: "resources",
        title: "Maintenance due",
        description: `Asset ${(event.data as Record<string, unknown>).asset_id} maintenance by ${(event.data as Record<string, unknown>).due_date}`,
        entityId: (event.data as Record<string, unknown>).asset_id as string,
        entityType: "asset",
        evidence: event.data as Record<string, unknown>,
        signalStrength: 0.7,
      })
      break

    case "performance.anomaly_detected":
      await perceive({
        organizationId: event.organization_id,
        eventType: "performance.anomaly_detected",
        sourceModule: "performance",
        title: `Anomaly: ${(event.data as Record<string, unknown>).metric}`,
        description: `Deviation of ${(event.data as Record<string, unknown>).deviation} (severity: ${(event.data as Record<string, unknown>).severity})`,
        evidence: event.data as Record<string, unknown>,
        signalStrength: ((event.data as Record<string, unknown>).severity as string) === "high" ? 0.9 : 0.6,
      })
      break

    case "performance.threshold_breached":
      await perceive({
        organizationId: event.organization_id,
        eventType: "performance.threshold_breached",
        sourceModule: "performance",
        title: `Threshold breached: ${(event.data as Record<string, unknown>).metric}`,
        description: `${(event.data as Record<string, unknown>).value} exceeded threshold of ${(event.data as Record<string, unknown>).threshold}`,
        evidence: event.data as Record<string, unknown>,
        signalStrength: 0.85,
      })
      break

    case "operational.document_ingested":
      await upsertEntity({
        id: (event.data as Record<string, unknown>).document_id as string,
        organizationId: event.organization_id,
        type: "document",
        name: `Document #${(event.data as Record<string, unknown>).document_id}`,
        status: "active",
        module: "operations",
        properties: event.data as Record<string, unknown>,
      })
      break

    case "operational.record_populated":
      await relateEntities(
        event.organization_id,
        (event.data as Record<string, unknown>).source_document as string,
        (event.data as Record<string, unknown>).entity_id as string,
        "populated_from",
      )
      break

    case "workflow.completed":
      await relateEntities(
        event.organization_id,
        (event.data as Record<string, unknown>).workflow_id as string,
        (event.data as Record<string, unknown>).execution_id as string,
        "executed",
      )
      break
  }
}


