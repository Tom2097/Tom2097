import { describe, it, expect, vi, beforeEach } from "vitest"
import { startTrial, processTrialEnd, isWithinRefundWindow, processRefund, cancelSubscription, getYearlyMilestone } from "@/lib/billing/subscription-lifecycle"

// Mock server-only modules
vi.mock("server-only", () => ({}))
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn()
}))
vi.mock("@/lib/logging", () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logException: vi.fn()
}))

const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReturnValue(mockSupabase as any)
})

describe("Subscription Lifecycle", () => {
  describe("startTrial", () => {
    it("should start a trial successfully", async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: { id: "sub_123" } })
      
      const result = await startTrial("org_123", "plan_pro", "user_123")
      
      expect(result.success).toBe(true)
      expect(mockSupabase.insert).toHaveBeenCalled()
    })
  })
  
  describe("processTrialEnd", () => {
    it("should process trial end successfully", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "sub_123",
          user_id: "user_123",
          plan_id: "plan_pro",
          status: "trialing"
        }
      })
      
      const result = await processTrialEnd("org_123")
      
      expect(result.charged).toBe(true)
      expect(mockSupabase.update).toHaveBeenCalledWith({
        status: "active",
        trial_ends_at: null,
      })
    })
  })
  
  describe("isWithinRefundWindow", () => {
    it("should return true when within refund window", async () => {
      const mockDate = new Date()
      mockDate.setDate(mockDate.getDate() - 15) // 15 days ago
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          current_period_start: mockDate.toISOString(),
          billing_interval: "month"
        }
      })
      
      const result = await isWithinRefundWindow("org_123")
      expect(result).toBe(true)
    })
    
    it("should return false when outside refund window", async () => {
      const mockDate = new Date()
      mockDate.setDate(mockDate.getDate() - 45) // 45 days ago
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          current_period_start: mockDate.toISOString(),
          billing_interval: "month"
        }
      })
      
      const result = await isWithinRefundWindow("org_123")
      expect(result).toBe(false)
    })
  })
  
  describe("processRefund", () => {
    it("should process refund successfully", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "sub_123",
          plan_id: "plan_pro",
          stripe_subscription_id: "stripe_123"
        }
      })
      
      const result = await processRefund("org_123", "user_123")
      expect(result.success).toBe(true)
    })
  })
  
  describe("cancelSubscription", () => {
    it("should cancel monthly subscription successfully", async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "sub_123",
          plan_id: "plan_pro",
          billing_interval: "month",
          stripe_subscription_id: "stripe_123"
        }
      })
      
      const result = await cancelSubscription("org_123", "user_123")
      expect(result.charged).toBe(true)
    })
    
    it("should cancel yearly subscription after minimum period", async () => {
      const mockDate = new Date()
      mockDate.setMonth(mockDate.getMonth() - 4) // 4 months ago
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: "sub_123",
          plan_id: "plan_pro",
          billing_interval: "year",
          current_period_start: mockDate.toISOString()
        }
      })
      
      const result = await cancelSubscription("org_123", "user_123")
      expect(result.charged).toBe(true)
    })
  })
  
  describe("getYearlyMilestone", () => {
    it("should return correct milestone for yearly plan", async () => {
      const mockDate = new Date()
      mockDate.setMonth(mockDate.getMonth() - 4) // 4 months ago
      
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          current_period_start: mockDate.toISOString(),
          billing_interval: "year",
          status: "active"
        }
      })
      
      const result = await getYearlyMilestone("org_123")
      expect(result.monthsSinceStart).toBe(4)
      expect(result.reminderDue).toBe(true)
      expect(result.canCancel).toBe(true)
    })
  })
})