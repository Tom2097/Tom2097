// Maps each gateway's own payout/settlement status vocabulary to the one
// vocabulary shown in the founder console: pending | scheduled | completed | failed.

export function stripePayoutStatus(status: string): "pending" | "scheduled" | "completed" | "failed" {
  switch (status) {
    case "paid":
      return "completed"
    case "in_transit":
      return "scheduled"
    case "pending":
      return "pending"
    case "failed":
    case "canceled":
      return "failed"
    default:
      return "pending"
  }
}

export function razorpaySettlementStatus(status: string): "pending" | "scheduled" | "completed" | "failed" {
  switch (status) {
    case "processed":
      return "completed"
    case "failed":
      return "failed"
    case "created":
      return "pending"
    default:
      return "pending"
  }
}
