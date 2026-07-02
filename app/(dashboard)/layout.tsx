'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/digit/sidebar'
import { Navbar } from '@/components/digit/navbar'
import { AIAssistant } from '@/components/digit/ai-assistant'
import { HelpSupport } from '@/components/digit/help-support'
import { SettingsPanel } from '@/components/digit/settings-panel'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <div className="relative min-h-screen bg-background">
      {/* Background Effects */}
      <div className="pointer-events-none fixed inset-0 digit-radial-bg" />
      <div className="pointer-events-none fixed inset-0 digit-grid-bg opacity-30" />
      
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
      />
      
      {/* Main Content */}
      <div 
        className={cn(
          "transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
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
