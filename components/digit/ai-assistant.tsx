'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, User, Sparkles, Minimize2, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MicrophoneButton } from '@/components/ui/microphone-button'
import { cn } from '@/lib/utils'

interface AIAssistantProps {
  isOpen: boolean
  onClose: () => void
}

export function AIAssistant({ isOpen, onClose }: AIAssistantProps) {
  const [input, setInput] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  // Helper to get text content from message parts
  const getMessageText = (message: typeof messages[0]): string => {
    if (!message.parts || !Array.isArray(message.parts)) return ''
    return message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map(p => p.text)
      .join('')
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={cn(
            "fixed top-20 right-6 z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
            isMinimized ? "h-14 w-80" : "h-[600px] w-[400px]"
          )}
        >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary digit-glow-sm">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">DigiT AI Assistant</h3>
            {!isMinimized && (
              <p className="text-xs text-muted-foreground">
                {isLoading ? 'Thinking...' : 'Powered by Claude'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
            <span className="sr-only">{isMinimized ? 'Expand' : 'Minimize'}</span>
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[280px] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
                    <div className="whitespace-pre-wrap">
                      {"Hello! I'm your DigiT AI Assistant powered by Claude. I can help you analyze data, generate insights, and answer questions about your enterprise operations. How can I assist you today?"}
                    </div>
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const text = getMessageText(message)
                if (!text) return null
                
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3",
                      message.role === 'user' && "flex-row-reverse"
                    )}
                  >
                    <div className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      message.role === 'assistant' ? "bg-primary/20 text-primary" : "bg-secondary text-secondary-foreground"
                    )}>
                      {message.role === 'assistant' ? (
                        <Bot className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className={cn(
                      "max-w-[280px] rounded-2xl px-4 py-2.5 text-sm",
                      message.role === 'assistant' 
                        ? "bg-secondary text-secondary-foreground" 
                        : "bg-primary text-primary-foreground"
                    )}>
                      <div className="whitespace-pre-wrap">{text}</div>
                    </div>
                  </div>
                )
              })}
              
              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="max-w-[280px] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="border-t border-border/50 px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {[
                'Show revenue forecast',
                'Risk analysis summary',
                'Active AI operations'
              ].map((action) => (
                <button
                  key={action}
                  onClick={() => {
                    setInput(action)
                  }}
                  className="rounded-full bg-secondary/50 px-3 py-1 text-xs text-secondary-foreground transition-colors hover:bg-secondary"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} className="border-t border-border p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your enterprise data..."
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={isLoading}
              />
              <MicrophoneButton
                onTranscript={(transcript) => {
                  setInput(transcript)
                  sendMessage({ text: transcript })
                }}
              />
              <Button 
                type="submit" 
                size="icon" 
                disabled={!input.trim() || isLoading}
                className="rounded-xl"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </form>
        </>
      )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
