"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { CapaRecord, CapaSeverity } from "@/lib/compliance/capa"

const capaFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  source: z.string().min(1, "Source is required"),
  severity: z.enum(["minor", "major", "critical"]),
  assigned_to: z.string().optional(),
  sla_days: z.coerce.number().min(1).optional(),
})

type CapaFormValues = z.infer<typeof capaFormSchema>

interface CapaFormProps {
  onSubmit: (values: CapaFormValues) => Promise<void>
  initialData?: Partial<CapaFormValues> & { id?: string }
  isEditing?: boolean
}

export function CapaForm({ onSubmit, initialData, isEditing = false }: CapaFormProps) {
  const { toast } = useToast()
  const form = useForm<CapaFormValues>({
    resolver: zodResolver(capaFormSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      source: initialData?.source || "",
      severity: initialData?.severity || "minor",
      assigned_to: initialData?.assigned_to || "",
      sla_days: initialData?.sla_days || 30,
    },
  })

  async function handleSubmit(values: CapaFormValues) {
    try {
      await onSubmit(values)
      toast({
        title: isEditing ? "CAPA updated" : "CAPA created",
        description: `The CAPA has been ${isEditing ? "updated" : "created"} successfully.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? "update" : "create"} CAPA. Please try again.`,
        variant: "destructive",
      })
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="CAPA title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Detailed description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="source"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Source</FormLabel>
              <FormControl>
                <Input placeholder="Source of the CAPA (e.g., Audit, Incident)" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="severity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Severity</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(capaFormSchema.shape.severity.options) as CapaSeverity[]).map((severity) => (
                    <SelectItem key={severity} value={severity}>
                      {severity.charAt(0).toUpperCase() + severity.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="assigned_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Assigned To (Email)</FormLabel>
              <FormControl>
                <Input placeholder="user@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="sla_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>SLA Days</FormLabel>
              <FormControl>
                <Input type="number" placeholder="30" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full">
          {isEditing ? "Update CAPA" : "Create CAPA"}
        </Button>
      </form>
    </Form>
  )
}