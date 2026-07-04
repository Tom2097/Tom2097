"use client"

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MessageSquare, Star } from 'lucide-react'
import { useState } from 'react'
import { toast } from '@/components/ui/use-toast'

interface FeedbackWidgetProps {
  userId?: string
}

export function FeedbackWidget({ userId }: FeedbackWidgetProps) {
  const [rating, setRating] = useState<number | null>(null)
  const [comments, setComments] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = async () => {
    if (!rating) {
      toast({
        title: "Rating required",
        description: "Please select a rating before submitting.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating,
          comments,
          userId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      toast({
        title: "Feedback submitted!",
        description: "Thank you for your feedback.",
      })
      setRating(null)
      setComments('')
      setIsOpen(false)
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Give feedback">
          <MessageSquare className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h3 className="font-medium">Give Feedback</h3>
          <div className="space-y-2">
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  key={star}
                  variant="ghost"
                  size="icon"
                  type="button"
                  onClick={() => setRating(star)}
                  aria-label={`Rate ${star} stars`}
                >
                  <Star className={`size-4 ${rating && rating >= star ? "fill-yellow-400" : "fill-muted"}`} />
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="comments">Comments</Label>
            <Textarea
              id="comments"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="What do you think?"
              className="min-h-[100px]"
            />
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}