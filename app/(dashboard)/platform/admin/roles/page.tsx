"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, Trash2, Edit2, Save, X, Check, Shield, Users, UserPlus, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  is_system_role: boolean
  created_at: string
}

interface Permission {
  id: string
  name: string
  description: string
  category: string
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentRole, setCurrentRole] = useState<Role | null>(null)
  const [newRole, setNewRole] = useState({
    name: '',
    description: '',
    permissions: [] as string[]
  })
   const [searchTerm, setSearchTerm] = useState('')
  const router = useRouter()

  const fetchRolesAndPermissions = async () => {
    try {
      setLoading(true)
      const [rolesRes, permissionsRes] = await Promise.all([
        fetch('/api/v1/auth/roles'),
        fetch('/api/v1/auth/permissions')
      ])
      
      const rolesData = await rolesRes.json()
      const permissionsData = await permissionsRes.json()
      
      if (rolesRes.ok && permissionsRes.ok) {
        setRoles(rolesData.roles)
        setPermissions(permissionsData.permissions)
      } else {
        toast.error(rolesData.error || permissionsData.error || 'Failed to load roles and permissions')
      }
    } catch (error) {
      toast.error('Error loading roles and permissions')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) {
      toast.error('Role name is required')
      return
    }
    
    try {
      setIsCreating(true)
      const response = await fetch('/api/v1/auth/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRole)
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Role created successfully')
        setNewRole({ name: '', description: '', permissions: [] })
        fetchRolesAndPermissions()
      } else {
        toast.error(result.error || 'Failed to create role')
      }
    } catch (error) {
      toast.error('Error creating role')
      console.error('Error:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!currentRole || !currentRole.id) {
      toast.error('No role selected for update')
      return
    }
    
    try {
      setIsEditing(true)
      const response = await fetch(`/api/v1/auth/roles/${currentRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentRole.name,
          description: currentRole.description,
          permissions: currentRole.permissions
        })
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Role updated successfully')
        setCurrentRole(null)
        fetchRolesAndPermissions()
      } else {
        toast.error(result.error || 'Failed to update role')
      }
    } catch (error) {
      toast.error('Error updating role')
      console.error('Error:', error)
    } finally {
      setIsEditing(false)
    }
  }

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return
    
    try {
      const response = await fetch(`/api/v1/auth/roles/${roleId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (response.ok) {
        toast.success('Role deleted successfully')
        fetchRolesAndPermissions()
      } else {
        toast.error(result.error || 'Failed to delete role')
      }
    } catch (error) {
      toast.error('Error deleting role')
      console.error('Error:', error)
    }
  }

  const togglePermission = (permissionId: string) => {
    if (!currentRole) return
    
    const updatedPermissions = currentRole.permissions.includes(permissionId)
      ? currentRole.permissions.filter(p => p !== permissionId)
      : [...currentRole.permissions, permissionId]
    
    setCurrentRole({
      ...currentRole,
      permissions: updatedPermissions
    })
  }

  const toggleNewPermission = (permissionId: string) => {
    const updatedPermissions = newRole.permissions.includes(permissionId)
      ? newRole.permissions.filter(p => p !== permissionId)
      : [...newRole.permissions, permissionId]
    
    setNewRole({
      ...newRole,
      permissions: updatedPermissions
    })
  }

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const permissionCategories = Array.from(new Set(permissions.map(p => p.category)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Role Management</h1>
          <p className="text-sm text-muted-foreground">Create and manage custom roles with specific permissions</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" /> Create Role
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Define a new role with specific permissions for your organization.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={newRole.name}
                  onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                  placeholder="e.g., Content Manager, Data Analyst"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-description">Description</Label>
                <Input
                  id="role-description"
                  value={newRole.description}
                  onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                  placeholder="Describe the role's responsibilities"
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  {permissionCategories.map(category => (
                    <div key={category} className="mb-4">
                      <h4 className="font-medium text-sm mb-2 capitalize">{category}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {permissions.filter(p => p.category === category).map(permission => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`perm-${permission.id}`}
                              checked={newRole.permissions.includes(permission.id)}
                              onChange={() => toggleNewPermission(permission.id)}
                              className="h-4 w-4"
                            />
                            <Label htmlFor={`perm-${permission.id}`} className="text-sm">
                              {permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setNewRole({ name: '', description: '', permissions: [] })}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Role'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Roles</CardTitle>
              <CardDescription>Manage roles and their permissions</CardDescription>
            </div>
            <Input
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>System Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>{role.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 3).map(permId => {
                          const permission = permissions.find(p => p.id === permId)
                          return permission ? (
                            <span key={permId} className="text-xs bg-secondary px-2 py-1 rounded-full">
                              {permission.name}
                            </span>
                          ) : null
                        })}
                        {role.permissions.length > 3 && (
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                            +{role.permissions.length - 3} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role.is_system_role ? (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full flex items-center gap-1">
                          <Lock className="h-3 w-3" /> System
                        </span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Custom</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCurrentRole(role)}
                              disabled={role.is_system_role}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Role: {currentRole?.name}</DialogTitle>
                              <DialogDescription>
                                Update role details and permissions.
                              </DialogDescription>
                            </DialogHeader>
                            {currentRole && (
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-role-name">Role Name</Label>
                                  <Input
                                    id="edit-role-name"
                                    value={currentRole.name}
                                    onChange={(e) => setCurrentRole({...currentRole, name: e.target.value})}
                                    disabled={currentRole.is_system_role}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-role-description">Description</Label>
                                  <Input
                                    id="edit-role-description"
                                    value={currentRole.description}
                                    onChange={(e) => setCurrentRole({...currentRole, description: e.target.value})}
                                    disabled={currentRole.is_system_role}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Permissions</Label>
                                  <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                                    {permissionCategories.map(category => (
                                      <div key={category} className="mb-4">
                                        <h4 className="font-medium text-sm mb-2 capitalize">{category}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                          {permissions.filter(p => p.category === category).map(permission => (
                                            <div key={permission.id} className="flex items-center space-x-2">
                                              <input
                                                type="checkbox"
                                                id={`edit-perm-${permission.id}`}
                                                checked={currentRole.permissions.includes(permission.id)}
                                                onChange={() => togglePermission(permission.id)}
                                                className="h-4 w-4"
                                                disabled={currentRole.is_system_role}
                                              />
                                              <Label htmlFor={`edit-perm-${permission.id}`} className="text-sm">
                                                {permission.name}
                                              </Label>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setCurrentRole(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateRole} disabled={isEditing || !currentRole || currentRole.is_system_role}>
                                {isEditing ? 'Saving...' : 'Save Changes'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRole(role.id)}
                          disabled={role.is_system_role}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}