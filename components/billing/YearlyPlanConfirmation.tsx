"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"

interface YearlyPlanConfirmationProps {
  planName: string
  onConfirm: () => void
  onCancel: () => void
}

export function YearlyPlanConfirmation({ planName, onConfirm, onCancel }: YearlyPlanConfirmationProps) {
  const [understood, setUnderstood] = useState(false)

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm {planName} Plan Purchase</DialogTitle>
          <DialogDescription>
            You are about to purchase the {planName} plan with annual billing.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
              <Info className="w-3 h-3 text-amber-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm">3-Month Minimum Commitment</h4>
              <p className="text-sm text-muted-foreground mt-1">
                This yearly plan requires a 3-month minimum commitment. You can cancel after 3 months, but no refunds will be issued.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center mt-0.5">
              <Info className="w-3 h-3 text-amber-500" />
            </div>
            <div>
              <h4 className="font-medium text-sm">No Refunds</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Yearly plans are non-refundable. You will be billed for the full year upfront.
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 mt-6">
            <Checkbox
              id="understood"
              checked={understood}
              onCheckedChange={(checked) => setUnderstood(checked === true)}
            />
            <Label htmlFor="understood" className="text-sm">
              I understand the terms and conditions
            </Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!understood}
          >
            Confirm Purchase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}