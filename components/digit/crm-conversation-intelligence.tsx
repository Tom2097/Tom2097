"use client"

import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Lightbulb, Sparkles, ThumbsUp, ThumbsDown, RefreshCw, Quote, Star } from "lucide-react"
import { cn } from "@/lib/utils"

const conversationTemplates = [
  {
    id: "c1", name: "Discovery Call Follow-up", scenario: "After initial discovery call",
    suggested: "Hi [Name], thanks again for the time today. Based on our conversation about [topic], I put together a brief summary of how we could help drive [outcome]. Would it make sense to schedule a deeper dive with our solution architect?",
    objection: "We need to think about this a bit more",
    rebuttal: "Of course — what specific areas would you like more clarity on? I can put together a quick analysis of how we compare on [specific concern].",
  },
  {
    id: "c2", name: "Proposal Follow-up", scenario: "Proposal sent, no response in 7+ days",
    suggested: "Hi [Name], checking in on the proposal I sent last week. I also came across this case study showing how [similar company] achieved [result] in just [timeframe] — thought it might be useful context. Any questions I can answer?",
    objection: "Budget got frozen this quarter",
    rebuttal: "Understood. Would a phased approach work — starting with a pilot in [department] at a lower commitment? Many of our customers started that way.",
  },
  {
    id: "c3", name: "Competitor Defense", scenario: "Prospect mentioned evaluating a competitor",
    suggested: "Hi [Name], glad you're evaluating options. One thing that sets us apart is [differentiator]. I'd love to walk through a side-by-side comparison focused on [key requirement]. When works for a 20-min call?",
    objection: "Competitor X offers the same at lower cost",
    rebuttal: "I understand price is important. The difference is [differentiator] built into our platform — which actually reduces total cost over 12 months by eliminating [hidden cost]. Let me share a TCO comparison.",
  },
]

const playbooks = [
  { id: "p1", name: "Cold Outreach Sequence", stages: ["Connect on LinkedIn", "Send value-first email", "Share relevant case study", "Personalized video message", "Break-up email"] },
  { id: "p2", name: "Evaluation Defense", stages: ["Provide comparison matrix", "Offer sandbox access", "Schedule technical deep-dive", "Share ROI calculator", "Executive sponsorship call"] },
]

export function CrmConversationIntelligence() {
  const [activeTab, setActiveTab] = useState<"suggest" | "playbook" | "sentiment">("suggest")
  const [feedback, setFeedback] = useState<Record<string, "up" | "down" | null>>({})

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          <p className="text-sm font-medium">Conversation Intelligence</p>
        </div>
        <div className="flex gap-1">
          {(["suggest", "playbook", "sentiment"] as const).map((tab) => (
            <Button key={tab} size="sm" variant={activeTab === tab ? "default" : "ghost"} className="h-7 text-[10px]" onClick={() => setActiveTab(tab)}>
              {tab === "suggest" ? "Suggestions" : tab === "playbook" ? "Playbooks" : "Sentiment"}
            </Button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "suggest" && (
          <motion.div key="suggest" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {conversationTemplates.map((t, i) => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl border border-border/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">{t.name}</p>
                    <Badge variant="secondary" className="text-[10px]">{t.scenario}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setFeedback((prev) => ({ ...prev, [t.id]: prev[t.id] === "up" ? null : "up" }))}
                    >
                      <ThumbsUp className={cn("h-3 w-3", feedback[t.id] === "up" && "text-green-500 fill-green-500")} />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setFeedback((prev) => ({ ...prev, [t.id]: prev[t.id] === "down" ? null : "down" }))}
                    >
                      <ThumbsDown className={cn("h-3 w-3", feedback[t.id] === "down" && "text-red-500 fill-red-500")} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                    <p className="text-[10px] text-muted-foreground mb-1">Suggested response:</p>
                    <p className="text-xs">{t.suggested}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1">
                      <Quote className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <RefreshCw className="h-3 w-3" />Objection: &ldquo;{t.objection}&rdquo;
                    </div>
                    <p className="text-xs">{t.rebuttal}</p>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] mt-1">
                      <Quote className="h-3 w-3 mr-1" />Copy
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === "playbook" && (
          <motion.div key="playbook" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {playbooks.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="p-3 rounded-xl border border-border/50"
              >
                <p className="text-sm font-medium mb-3">{p.name}</p>
                <div className="space-y-2">
                  {p.stages.map((stage, j) => (
                    <div key={j} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{j + 1}</span>
                      </div>
                      <p className="text-xs">{stage}</p>
                      <Badge variant="outline" className="text-[10px] ml-auto">{(j + 1) * 2} days</Badge>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === "sentiment" && (
          <motion.div key="sentiment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {[
              { name: "GreenEnergy — Platform", sentiment: 75, trend: "up", keywords: ["pricing", "timeline", "integration"] },
              { name: "Acme Corp — Enterprise", sentiment: 35, trend: "down", keywords: ["delay", "competitor", "budget"] },
              { name: "MedTech — Compliance", sentiment: 90, trend: "up", keywords: ["compliance", "deadline", "approval"] },
            ].map((conv, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="p-3 rounded-xl border border-border/50"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{conv.name}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${conv.sentiment >= 70 ? "text-green-500" : conv.sentiment >= 50 ? "text-amber-500" : "text-red-500"}`}>
                      {conv.sentiment}%
                    </span>
                    <Badge variant={conv.trend === "up" ? "default" : "destructive"} className="text-[10px]">
                      {conv.trend === "up" ? "Improving" : "Declining"}
                    </Badge>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${conv.sentiment >= 70 ? "bg-green-500" : conv.sentiment >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${conv.sentiment}%` }}
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  {conv.keywords.map((kw) => (
                    <Badge key={kw} variant="secondary" className="text-[10px]">{kw}</Badge>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
