"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Edit2, Save, X, Check, Search, Filter, Ticket, Clock, AlertCircle, CheckCircle2, MessageSquare, Paperclip, User, Tag, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'

interface SupportTicket {
  id: string
  subject: string
  description: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category: string
  contact_id: string | null
  company_id: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  created_by: string
  contact_name?: string
  company_name?: string
  assignee_name?: string
}

interface Contact {
  id: string
  first_name: string
  last_name: string
  email: string
}

interface User {
  id: string
  name: string
  email: string
}

export function CrmSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null)
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    status: 'open',
    priority: 'medium',
    category: '',
    contact_id: null as string | null,
    company_id: null as string | null,
    assigned_to: null as string | null
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null)
  const router = useRouter()

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/v1/crm/support-tickets')
      const data = await response.json()
      
      if (response.ok) {
        setTickets(data)
      } else {
        toast.error(data.error || 'Failed to load support tickets')
      }
    } catch (error) {
      toast.error('Error loading support tickets')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchContacts = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/crm/contacts?limit=100')
      const data = await response.json()
      
      if (response.ok) {
        setContacts(data)
      }
    } catch (error) {
      console.error('Error loading contacts:', error)
    }
  }, [])

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('/api/v1/auth/users')
      const data = await response.json()
      
      if (response.ok) {
        setUsers(data)
      }
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      await fetchTickets()
      await fetchContacts()
      await fetchUsers()
    }
    load()
  }, [fetchTickets, fetchContacts, fetchUsers])

  const handleCreateTicket = async () => {
    if (!newTicket.subject.trim()) {
      toast.error('Subject is required')
      return
    }
    
    try {
      setIsCreating(true)
      const response = await fetch('/api/v1/crm/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTicket)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Support ticket created successfully')
        setNewTicket({
          subject: '',
          description: '',
          status: 'open',
          priority: 'medium',
          category: '',
          contact_id: null,
          company_id: null,
          assigned_to: null
        })
        fetchTickets()
      } else {
        toast.error(result.error || 'Failed to create support ticket')
      }
    } catch (error) {
      toast.error('Error creating support ticket')
      console.error('Error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateTicket = async () => {
    if (!currentTicket || !currentTicket.id) {
      toast.error('No ticket selected for update')
      return
    }
    
    try {
      setIsEditing(true)
      const response = await fetch(`/api/v1/crm/support-tickets/${currentTicket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: currentTicket.subject,
          description: currentTicket.description,
          status: currentTicket.status,
          priority: currentTicket.priority,
          category: currentTicket.category,
          contact_id: currentTicket.contact_id,
          company_id: currentTicket.company_id,
          assigned_to: currentTicket.assigned_to
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Support ticket updated successfully')
        setCurrentTicket(null)
        fetchTickets()
      } else {
        toast.error(result.error || 'Failed to update support ticket')
      }
    } catch (error) {
      toast.error('Error updating support ticket')
      console.error('Error:', error)
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this support ticket?')) return
    
    try {
      const response = await fetch(`/api/v1/crm/support-tickets/${ticketId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Support ticket deleted successfully')
        fetchTickets()
      } else {
        toast.error(result.error || 'Failed to delete support ticket')
      }
    } catch (error) {
      toast.error('Error deleting support ticket')
      console.error('Error:', error)
    }
  }

   const getStatusBadgeVariant = (status: string) => {
     switch (status) {
       case 'open': return 'destructive'
       case 'in_progress': return 'secondary'
       case 'resolved': return 'default'
       case 'closed': return 'secondary'
       default: return 'secondary'
     }
   }

   const getPriorityBadgeVariant = (priority: string) => {
     switch (priority) {
       case 'critical': return 'destructive'
       case 'high': return 'secondary'
       case 'medium': return 'default'
       case 'low': return 'secondary'
       default: return 'secondary'
     }
   }

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.category ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ticket.contact_name && ticket.contact_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (ticket.company_name && ticket.company_name.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesStatus = statusFilter ? ticket.status === statusFilter : true
    const matchesPriority = priorityFilter ? ticket.priority === priorityFilter : true
    
    return matchesSearch && matchesStatus && matchesPriority
  })

  const getContactName = (contactId: string | null) => {
    if (!contactId) return 'N/A'
    const contact = contacts.find(c => c.id === contactId)
    return contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown'
  }

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return 'Unassigned'
    const user = users.find(u => u.id === userId)
    return user ? user.name : 'Unknown'
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>Manage customer support requests and issues</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Ticket className="h-4 w-4 mr-2" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>
                  Create a new support ticket for a customer issue.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-subject">Subject</Label>
                  <Input
                    id="ticket-subject"
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({...newTicket, subject: e.target.value})}
                    placeholder="e.g., Login issue, Feature request"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-description">Description</Label>
                  <Textarea
                    id="ticket-description"
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({...newTicket, description: e.target.value})}
                    placeholder="Describe the issue in detail..."
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ticket-status">Status</Label>
                    <Select
                      value={newTicket.status}
                      onValueChange={(value) => setNewTicket({...newTicket, status: value as any})}
                    >
                      <SelectTrigger id="ticket-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ticket-priority">Priority</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value) => setNewTicket({...newTicket, priority: value as any})}
                    >
                      <SelectTrigger id="ticket-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticket-category">Category</Label>
                  <Input
                    id="ticket-category"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({...newTicket, category: e.target.value})}
                    placeholder="e.g., Technical, Billing, Feature Request"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ticket-contact">Contact</Label>
                    <Select
                      value={newTicket.contact_id || ''}
                      onValueChange={(value) => setNewTicket({...newTicket, contact_id: value})}
                    >
                      <SelectTrigger id="ticket-contact">
                        <SelectValue placeholder="Select contact" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {contacts.map(contact => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.first_name} {contact.last_name} ({contact.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ticket-assignee">Assignee</Label>
                    <Select
                      value={newTicket.assigned_to || ''}
                      onValueChange={(value) => setNewTicket({...newTicket, assigned_to: value})}
                    >
                      <SelectTrigger id="ticket-assignee">
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewTicket({
                  subject: '',
                  description: '',
                  status: 'open',
                  priority: 'medium',
                  category: '',
                  contact_id: null,
                  company_id: null,
                  assigned_to: null
                })}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateTicket} disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Ticket'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter || ''} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter || ''} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length > 0 ? (
                    filteredTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-muted-foreground" />
                            {ticket.subject}
                          </div>
                        </TableCell>
                        <TableCell>
                          {ticket.contact_name || getContactName(ticket.contact_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(ticket.status)}>
                            {ticket.status.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                            {ticket.priority.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{ticket.category || 'N/A'}</TableCell>
                        <TableCell>{ticket.assignee_name || getAssigneeName(ticket.assigned_to)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCurrentTicket(ticket)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Edit Support Ticket</DialogTitle>
                                  <DialogDescription>
                                    Update support ticket details.
                                  </DialogDescription>
                                </DialogHeader>
                                {currentTicket && (
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-ticket-subject">Subject</Label>
                                      <Input
                                        id="edit-ticket-subject"
                                        value={currentTicket.subject}
                                        onChange={(e) => setCurrentTicket({...currentTicket, subject: e.target.value})}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-ticket-description">Description</Label>
                                      <Textarea
                                        id="edit-ticket-description"
                                        value={currentTicket.description}
                                        onChange={(e) => setCurrentTicket({...currentTicket, description: e.target.value})}
                                        rows={5}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-ticket-status">Status</Label>
                                        <Select
                                          value={currentTicket.status}
                                          onValueChange={(value) => setCurrentTicket({...currentTicket, status: value as any})}
                                        >
                                          <SelectTrigger id="edit-ticket-status">
                                            <SelectValue placeholder="Select status" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="open">Open</SelectItem>
                                            <SelectItem value="in_progress">In Progress</SelectItem>
                                            <SelectItem value="resolved">Resolved</SelectItem>
                                            <SelectItem value="closed">Closed</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-ticket-priority">Priority</Label>
                                        <Select
                                          value={currentTicket.priority}
                                          onValueChange={(value) => setCurrentTicket({...currentTicket, priority: value as any})}
                                        >
                                          <SelectTrigger id="edit-ticket-priority">
                                            <SelectValue placeholder="Select priority" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="low">Low</SelectItem>
                                            <SelectItem value="medium">Medium</SelectItem>
                                            <SelectItem value="high">High</SelectItem>
                                            <SelectItem value="critical">Critical</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="edit-ticket-category">Category</Label>
                                      <Input
                                        id="edit-ticket-category"
                                        value={currentTicket.category}
                                        onChange={(e) => setCurrentTicket({...currentTicket, category: e.target.value})}
                                      />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-ticket-contact">Contact</Label>
                                        <Select
                                          value={currentTicket.contact_id || ''}
                                          onValueChange={(value) => setCurrentTicket({...currentTicket, contact_id: value})}
                                        >
                                          <SelectTrigger id="edit-ticket-contact">
                                            <SelectValue placeholder="Select contact" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            {contacts.map(contact => (
                                              <SelectItem key={contact.id} value={contact.id}>
                                                {contact.first_name} {contact.last_name} ({contact.email})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="edit-ticket-assignee">Assignee</Label>
                                        <Select
                                          value={currentTicket.assigned_to || ''}
                                          onValueChange={(value) => setCurrentTicket({...currentTicket, assigned_to: value})}
                                        >
                                          <SelectTrigger id="edit-ticket-assignee">
                                            <SelectValue placeholder="Select assignee" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="">Unassigned</SelectItem>
                                            {users.map(user => (
                                              <SelectItem key={user.id} value={user.id}>
                                                {user.name} ({user.email})
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                <DialogFooter>
                                  <Button variant="outline" onClick={() => setCurrentTicket(null)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={handleUpdateTicket} disabled={isEditing}>
                                    {isEditing ? 'Saving...' : 'Save Changes'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTicket(ticket.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        No support tickets found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}