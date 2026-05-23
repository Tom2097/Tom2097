'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/digit/sidebar'
import { Navbar } from '@/components/digit/navbar'
import { AIAssistant } from '@/components/digit/ai-assistant'
import { HelpSupport } from '@/components/digit/help-support'
import { SettingsPanel } from '@/components/digit/settings-panel'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAIOpen, setIsAIOpen] = useState(false)

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 digit-radial-bg" />
      <div className="pointer-events-none fixed inset-0 digit-grid-bg opacity-30" />
      
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="ml-64 transition-all duration-300">
        <Navbar onOpenAI={() => setIsAIOpen(true)} />
        <main className="relative min-h-[calc(100vh-4rem)] p-6">
          {children}
        </main>
      </div>
      
      {/* AI Assistant */}
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} />
      
      {/* Settings Panel */}
      <SettingsPanel />
      
      {/* Help & Support */}
      <HelpSupport />
    </div>
  )
}
