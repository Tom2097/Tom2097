"use client"

import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { 
  HelpCircle, 
  X, 
  MessageCircle, 
  Book, 
  FileQuestion, 
  Mail, 
  Video,
  Search,
  ChevronRight,
  ExternalLink,
  Headphones,
  Sparkles,
  Clock,
  CheckCircle2,
  Send,
  Paperclip
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface FAQItem {
  question: string
  answer: string
  category: string
}

const faqs: FAQItem[] = [
  {
    question: "How do I connect my data sources?",
    answer: "Go to Configure > Create New Workspace and toggle on the sources you want in step 3 (Data & Integrations). Gmail, Google Drive, and Slack connect directly; other sources are registered for manual credential setup afterward.",
    category: "Getting Started"
  },
  {
    question: "What's included in each subscription plan?",
    answer: "Starter includes 1 module, 5 users, and 100K data points. Professional includes 3 modules, 25 users, and 1M data points with API access. Enterprise includes all 6 modules, unlimited users, and custom integrations.",
    category: "Billing"
  },
  {
    question: "How does the AI analysis work?",
    answer: "Our AI engine analyzes your business profile, industry data, and operational metrics to provide personalized recommendations. The more you use DigiT, the smarter it gets - learning from your patterns to deliver increasingly relevant insights.",
    category: "AI Features"
  },
  {
    question: "Can I invite team members?",
    answer: "Yes! Go to Settings > Team and click 'Invite Member'. You can assign roles (Admin, Analyst, Viewer) to control access levels. Your plan determines the maximum number of team members.",
    category: "Team Management"
  },
  {
    question: "How secure is my data?",
    answer: "DigiT is SOC 2 Type II certified, GDPR compliant, and uses AES-256 encryption for data at rest and TLS 1.3 for data in transit. We never share your data with third parties.",
    category: "Security"
  },
  {
    question: "How do I upgrade my plan?",
    answer: "Go to Settings > Subscription and click 'Upgrade Plan'. You can also visit the Pricing page to compare plans. Upgrades take effect immediately and are prorated.",
    category: "Billing"
  },
  {
    question: "What analytics modules are available?",
    answer: "DigiT offers 6 configurable modules: AI Analytics (core BI), Smart CRM, Operations, Performance, Resource, and Compliance workspaces. Each workspace adapts to any team or business function with configurable KPIs and AI models.",
    category: "Features"
  },
  {
    question: "How do I export reports?",
    answer: "Click the 'Export' button on any dashboard or report. Choose from PDF, Excel, CSV, or PowerPoint formats. You can also schedule automated exports via Settings > Scheduled Reports.",
    category: "Features"
  }
]

const categories = ["All", "Getting Started", "Features", "AI Features", "Billing", "Team Management", "Security"]

const quickLinks = [
  { title: "Intelligence", icon: Sparkles, href: "/intelligence", description: "AI-powered insights and analytics" },
  { title: "Settings", icon: Headphones, href: "/settings", description: "Manage account and preferences" },
  { title: "Pricing", icon: ExternalLink, href: "/pricing", description: "Compare plans and features", external: true },
  { title: "Security", icon: CheckCircle2, href: "/security", description: "Security overview and compliance" },
]

// Searchable help topics for live search
const helpTopics = [
  { title: "AI Analytics", category: "Features", icon: Sparkles, href: "/intelligence" },
  { title: "Operations Dashboard", category: "Documentation", icon: Book, href: "/operations" },
  { title: "CRM Workspace", category: "Features", icon: MessageCircle, href: "/crm" },
  { title: "Invite Team Members", category: "Team", icon: MessageCircle, href: "/settings" },
  { title: "Upgrade Subscription", category: "Billing", icon: ExternalLink, href: "/pricing" },
  { title: "Compliance Center", category: "Security", icon: FileQuestion, href: "/compliance" },
  { title: "Export Reports", category: "Features", icon: Book, href: "/analytics" },
  { title: "Performance Metrics", category: "Features", icon: Video, href: "/performance" },
  { title: "Security Settings", category: "Security", icon: HelpCircle, href: "/settings" },
  { title: "Resource Management", category: "Features", icon: Book, href: "/resources" },
  { title: "Platform Capacity", category: "Features", icon: FileQuestion, href: "/platform/capacity" },
  { title: "Feedback & Requests", category: "Developer", icon: Mail, href: "/feedback" },
]

export function HelpSupport() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"home" | "faq" | "contact" | "chat">("home")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "ai"; content: string }>>([
    { role: "ai", content: "Hi! I'm DigiT AI Support. How can I help you today?" }
  ])
  const [chatInput, setChatInput] = useState("")
  const [ticketForm, setTicketForm] = useState({ subject: "", description: "", priority: "medium" })
  const [ticketSubmitted, setTicketSubmitted] = useState(false)
  const [ticketId, setTicketId] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)])
    }
  }, [])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === "All" || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  // Live search results combining FAQs and help topics
  const searchResults = searchQuery.length > 0 ? [
    ...faqs
      .filter(faq => 
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 3)
      .map(faq => ({ type: 'faq' as const, ...faq })),
    ...helpTopics
      .filter(topic => 
        topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 4)
      .map(topic => ({ type: 'topic' as const, ...topic }))
  ] : []

  const handleSendChat = () => {
    if (!chatInput.trim()) return
    
    setChatMessages(prev => [...prev, { role: "user", content: chatInput }])
    setChatInput("")
    
    // Simulate AI response
    setTimeout(() => {
      const responses = [
        "I understand your concern. Let me look into that for you.",
        "That's a great question! Based on your account, I recommend checking the Settings page.",
        "I can help you with that. Would you like me to walk you through the process step by step?",
        "I've found some relevant information. Would you like me to connect you with a specialist for more detailed assistance?"
      ]
      setChatMessages(prev => [...prev, { 
        role: "ai", 
        content: responses[Math.floor(Math.random() * responses.length)] 
      }])
    }, 1000)
  }

  const handleSubmitTicket = () => {
    if (!ticketForm.subject || !ticketForm.description) return
    setTicketSubmitted(true)
    setTicketId("ticket-" + Date.now())
    setTimeout(() => {
      setTicketSubmitted(false)
      setTicketForm({ subject: "", description: "", priority: "medium" })
      setActiveTab("home")
    }, 3000)
  }

  return (
    <>
      {/* Floating Help Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary/70 px-4 py-3 text-primary-foreground shadow-lg transition-all hover:bg-primary hover:scale-105",
          "digit-glow"
        )}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <HelpCircle className="h-5 w-5" />
        <span className="font-medium">Help</span>
      </motion.button>

      {/* Help Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, x: 400 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 400 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-md border-l border-border bg-background shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border bg-card/50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Headphones className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Help & Support</h2>
                    <p className="text-xs text-muted-foreground">We&apos;re here to help</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex border-b border-border">
                {[
                  { id: "home", label: "Home", icon: HelpCircle },
                  { id: "faq", label: "FAQ", icon: FileQuestion },
                  { id: "chat", label: "Chat", icon: MessageCircle },
                  { id: "contact", label: "Contact", icon: Mail }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={cn(
                      "flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                      activeTab === tab.id
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="h-[calc(100%-140px)] overflow-y-auto p-4">
                {/* Home Tab */}
                {activeTab === "home" && (
                  <div className="space-y-6">
                    {/* Search with Dropdown */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
                      <Input
                        placeholder="Search for help..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setShowSearchDropdown(e.target.value.length > 0)
                        }}
                        onFocus={() => setShowSearchDropdown(searchQuery.length > 0)}
                        onBlur={() => setTimeout(() => setShowSearchDropdown(false), 200)}
                      />
                      
                      {/* Search Dropdown */}
                      <AnimatePresence>
                        {showSearchDropdown && searchResults.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
                          >
                            {/* FAQ Results */}
                            {searchResults.filter(r => r.type === 'faq').length > 0 && (
                              <div className="p-2">
                                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">FAQs</p>
                                {searchResults
                                  .filter((r): r is { type: 'faq' } & FAQItem => r.type === 'faq')
                                  .map((result, idx) => (
                                    <button
                                      key={`faq-${idx}`}
                                      onClick={() => {
                                        setActiveTab("faq")
                                        setExpandedFaq(faqs.findIndex(f => f.question === result.question))
                                        setShowSearchDropdown(false)
                                      }}
                                      className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                                    >
                                      <FileQuestion className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{result.question}</p>
                                        <p className="text-xs text-muted-foreground truncate">{result.answer}</p>
                                      </div>
                                      <Badge variant="outline" className="shrink-0 text-xs">
                                        {result.category}
                                      </Badge>
                                    </button>
                                  ))}
                              </div>
                            )}
                            
                            {/* Topic Results */}
                            {searchResults.filter(r => r.type === 'topic').length > 0 && (
                              <div className="border-t border-border p-2">
                                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">Help Topics</p>
                                {searchResults
                                  .filter((r): r is { type: 'topic'; title: string; category: string; icon: typeof Book; href: string } => r.type === 'topic')
                                  .map((result, idx) => (
                                    <a
                                      key={`topic-${idx}`}
                                      href={result.href}
                                      onClick={() => setShowSearchDropdown(false)}
                                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                                    >
                                      <result.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{result.title}</p>
                                      </div>
                                      <Badge variant="secondary" className="shrink-0 text-xs">
                                        {result.category}
                                      </Badge>
                                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                                    </a>
                                  ))}
                              </div>
                            )}
                            
                            {/* View All Results */}
                            <div className="border-t border-border p-2">
                              <button
                                onClick={() => {
                                  setActiveTab("faq")
                                  setShowSearchDropdown(false)
                                }}
                                className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                              >
                                View all results
                                <ChevronRight className="h-4 w-4" />
                              </button>
                            </div>
                          </motion.div>
                        )}
                        
                        {/* No Results */}
                        {showSearchDropdown && searchQuery.length > 0 && searchResults.length === 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-card p-4 shadow-xl"
                          >
                            <div className="text-center">
                              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
                              <p className="mt-2 text-sm text-muted-foreground">No results found for &quot;{searchQuery}&quot;</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-3"
                                onClick={() => {
                                  setActiveTab("chat")
                                  setShowSearchDropdown(false)
                                }}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Ask AI Assistant
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* AI Support Card */}
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-cyan-500/5 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">AI Support Assistant</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Get instant answers powered by AI
                          </p>
                          <Button 
                            size="sm" 
                            className="mt-3"
                            onClick={() => setActiveTab("chat")}
                          >
                            Start Chat
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>

                    {/* Quick Links */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Quick Links</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {quickLinks.map((link, index) => (
                          <motion.a
                            key={link.title}
                            href={link.href}
                            target={link.external ? "_blank" : undefined}
                            rel={link.external ? "noopener noreferrer" : undefined}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group flex flex-col rounded-xl border border-border bg-card/50 p-3 transition-all hover:border-primary/50 hover:bg-card"
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <link.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                              {link.external && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
                            </div>
                            <span className="text-sm font-medium">{link.title}</span>
                            <span className="text-xs text-muted-foreground">{link.description}</span>
                          </motion.a>
                        ))}
                      </div>
                    </div>

                    {/* Popular Topics */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Popular Topics</h3>
                      <div className="space-y-2">
                        {faqs.slice(0, 3).map((faq, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setActiveTab("faq")
                              setExpandedFaq(index)
                            }}
                            className="flex w-full items-center justify-between rounded-lg border border-border bg-card/50 p-3 text-left transition-all hover:border-primary/50 hover:bg-card"
                          >
                            <span className="text-sm">{faq.question}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Contact Options */}
                    <div>
                      <h3 className="mb-3 text-sm font-semibold">Contact Us</h3>
                      <Button variant="outline" className="w-full" onClick={() => setActiveTab("contact")}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send us an Email
                      </Button>
                    </div>

                    {/* Support Hours */}
                    <div className="rounded-lg bg-muted/50 p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Support Hours:</span>
                        <span className="font-medium">24/7 for Enterprise</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* FAQ Tab */}
                {activeTab === "faq" && (
                  <div className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search FAQs..."
                        className="pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-medium transition-all",
                            selectedCategory === category
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                        >
                          {category}
                        </button>
                      ))}
                    </div>

                    {/* FAQ List */}
                    <div className="space-y-2">
                      {filteredFaqs.map((faq, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="rounded-lg border border-border bg-card/50"
                        >
                          <button
                            onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                            className="flex w-full items-center justify-between p-4 text-left"
                          >
                            <div className="flex-1 pr-4">
                              <span className="font-medium">{faq.question}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {faq.category}
                              </Badge>
                            </div>
                            <ChevronRight 
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                expandedFaq === index && "rotate-90"
                              )} 
                            />
                          </button>
                          <AnimatePresence>
                            {expandedFaq === index && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="border-t border-border bg-muted/30 p-4">
                                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                                  <div className="mt-3 flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Was this helpful?</span>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                                      fetch("/api/v1/feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ type: "faq_helpful", helpful: true, faqId: faq.question }),
                                      }).catch(() => {})
                                    }}>
                                      Yes
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                                      fetch("/api/v1/feedback", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ type: "faq_helpful", helpful: false, faqId: faq.question }),
                                      }).catch(() => {})
                                    }}>
                                      No
                                    </Button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>

                    {filteredFaqs.length === 0 && (
                      <div className="py-8 text-center">
                        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/50" />
                        <p className="mt-2 text-muted-foreground">No FAQs found matching your search</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setActiveTab("contact")}>
                          Contact Support
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Chat Tab */}
                {activeTab === "chat" && (
                  <div className="flex h-full flex-col">
                    {/* Chat Messages */}
                    <div className="flex-1 space-y-4 overflow-y-auto pb-4">
                      {chatMessages.map((message, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-2",
                              message.role === "user"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            {message.role === "ai" && (
                              <div className="mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" />
                                <span className="text-xs font-medium text-primary">DigiT AI</span>
                              </div>
                            )}
                            <p className="text-sm">{message.content}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Chat Input */}
                    <div className="border-t border-border pt-4">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
                          const input = document.createElement("input")
                          input.type = "file"
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0]
                            if (!file) return
                            const formData = new FormData()
                            formData.append("file", file)
                            await fetch("/api/support/upload", { method: "POST", body: formData }).catch(() => {})
                          }
                          input.click()
                        }}>
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Input
                          placeholder="Type your message..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                          className="flex-1"
                        />
                        <Button size="icon" onClick={handleSendChat}>
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        AI-powered support available 24/7
                      </p>
                    </div>
                  </div>
                )}

                {/* Contact Tab */}
                {activeTab === "contact" && (
                  <div className="space-y-6">
                    {ticketSubmitted ? (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-12 text-center"
                      >
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                          <CheckCircle2 className="h-8 w-8 text-green-500" />
                        </div>
                        <h3 className="text-lg font-semibold">Ticket Submitted!</h3>
                        <p className="mt-2 text-muted-foreground">
                          We&apos;ll get back to you within 24 hours
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Ticket #DGT-{ticketId ? ticketId.substring(0, 8).toUpperCase() : "NEW"}
                        </p>
                      </motion.div>
                    ) : (
                      <>
                        <div>
                          <h3 className="font-semibold">Submit a Support Ticket</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Our team typically responds within 24 hours
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div>
                            <label className="mb-2 block text-sm font-medium">Subject</label>
                            <Input
                              placeholder="Brief description of your issue"
                              value={ticketForm.subject}
                              onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">Priority</label>
                            <div className="flex gap-2">
                              {["low", "medium", "high", "urgent"].map((priority) => (
                                <button
                                  key={priority}
                                  onClick={() => setTicketForm(prev => ({ ...prev, priority }))}
                                  className={cn(
                                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-all",
                                    ticketForm.priority === priority
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border hover:border-primary/50"
                                  )}
                                >
                                  {priority}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">Description</label>
                            <Textarea
                              placeholder="Please describe your issue in detail..."
                              rows={5}
                              value={ticketForm.description}
                              onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-medium">Attachments (optional)</label>
                            <div
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => fileInputRef.current?.click()}
                              className={cn(
                                "rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer",
                                isDragging
                                  ? "border-primary bg-primary/5"
                                  : "border-border hover:border-primary/50"
                              )}
                            >
                              <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                onChange={handleFileChange}
                                className="hidden"
                              />
                              <Paperclip className="mx-auto h-8 w-8 text-muted-foreground" />
                              <p className="mt-2 text-sm text-muted-foreground">
                                {isDragging ? "Drop files here" : "Drag files here or click to upload"}
                              </p>
                            </div>
                            {files.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {files.map((file, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between rounded-lg border border-border bg-card/50 px-3 py-2"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                      <span className="truncate text-sm">{file.name}</span>
                                      <span className="shrink-0 text-xs text-muted-foreground">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveFile(index)
                                      }}
                                      className="ml-2 text-muted-foreground hover:text-destructive"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <Button className="w-full" onClick={handleSubmitTicket}>
                            Submit Ticket
                          </Button>
                        </div>

                        {/* Alternative Contact */}
                        <div className="border-t border-border pt-6">
                          <h4 className="mb-4 text-sm font-semibold">Other Ways to Reach Us</h4>
                          <div className="space-y-3">
                            <a
                              href="mailto:support@digit.ai"
                              className="flex items-center gap-3 rounded-lg border border-border p-3 transition-all hover:border-primary/50 hover:bg-card"
                            >
                              <Mail className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">Email Support</p>
                                <p className="text-sm text-muted-foreground">support@digit.ai</p>
                              </div>
                              <ExternalLink className="ml-auto h-4 w-4 text-muted-foreground" />
                            </a>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
