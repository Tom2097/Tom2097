"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "@/components/ui/use-toast"
import { Upload, Search, FileText, BookOpen, Tag, Plus, Download, Trash2, Edit, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { useDropzone } from "react-dropzone"
import { Skeleton } from "@/components/ui/skeleton"

// Types
interface Document {
  id: string
  name: string
  description?: string
  file_type: string
  file_size: number
  tags?: string[]
  created_at: string
}

interface Article {
  id: string
  title: string
  category?: string
  tags?: string[]
  is_published: boolean
  created_at: string
}

interface SearchResult {
  id: string
  type: "document" | "article"
  name?: string
  title?: string
  description?: string
  file_type?: string
  created_at: string
}

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState("documents")
  const [documents, setDocuments] = useState<Document[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [articleDialogOpen, setArticleDialogOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  const router = useRouter()

  const fetchDocuments = useCallback(async (page = 1, search = "") => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/v1/resources/documents?limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}&search=${search}`)
      if (!res.ok) throw new Error("Failed to fetch documents")
      const { data, count } = await res.json()
      setDocuments(data)
      setTotalCount(count)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch documents", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchArticles = useCallback(async (page = 1, search = "") => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/v1/resources/kb/articles?limit=${itemsPerPage}&offset=${(page - 1) * itemsPerPage}&search=${search}`)
      if (!res.ok) throw new Error("Failed to fetch articles")
      const { data, count } = await res.json()
      setArticles(data)
      setTotalCount(count)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch articles", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch(`/api/v1/resources/search?query=${encodeURIComponent(query)}&limit=20`)
      if (!res.ok) throw new Error("Failed to search")
      const { data } = await res.json()
      setSearchResults(data)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to search", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === "documents") {
      fetchDocuments(currentPage, searchQuery)
    } else if (activeTab === "articles") {
      fetchArticles(currentPage, searchQuery)
    }
  }, [activeTab, currentPage, fetchDocuments, fetchArticles, searchQuery])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery) {
        performSearch(searchQuery)
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, performSearch])

  const handleUpload = async (file: File, metadata: { name: string; description?: string; tags?: string[] }) => {
    try {
      // In a real app, you would first upload the file to storage, then create the document record
      const formData = new FormData()
      formData.append("file", file)
      formData.append("metadata", JSON.stringify(metadata))

      // Mock implementation - replace with actual API call
      const response = await fetch("/api/v1/resources/documents", {
        method: "POST",
        body: JSON.stringify({
          ...metadata,
          file_path: `uploads/${file.name}`,
          file_type: file.type,
          file_size: file.size,
        }),
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to upload document")

      toast({ title: "Success", description: "Document uploaded successfully" })
      setUploadDialogOpen(false)
      fetchDocuments()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to upload document", variant: "destructive" })
    }
  }

  const handleCreateArticle = async (article: { title: string; content: string; category?: string; tags?: string[]; is_published: boolean }) => {
    try {
      const response = await fetch("/api/v1/resources/kb/articles", {
        method: "POST",
        body: JSON.stringify(article),
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to create article")

      toast({ title: "Success", description: "Article created successfully" })
      setArticleDialogOpen(false)
      fetchArticles()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create article", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    try {
      const endpoint = activeTab === "documents" ? "/api/v1/resources/documents" : "/api/v1/resources/kb/articles"
      const itemIds = selectedItems

      const response = await fetch(endpoint, {
        method: "DELETE",
        body: JSON.stringify({ [activeTab === "documents" ? "documentIds" : "articleIds"]: itemIds }),
        headers: { "Content-Type": "application/json" },
      })

      if (!response.ok) throw new Error("Failed to delete items")

      toast({ title: "Success", description: `${itemIds.length} item(s) deleted successfully` })
      setSelectedItems([])
      if (activeTab === "documents") {
        fetchDocuments()
      } else {
        fetchArticles()
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete items", variant: "destructive" })
    }
  }

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`/api/v1/resources/documents/${id}/download`)
      if (!response.ok) throw new Error("Failed to generate download link")
      const { url } = await response.json()
      window.open(url, "_blank")
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to download document", variant: "destructive" })
    }
  }

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === (activeTab === "documents" ? documents.length : articles.length)) {
      setSelectedItems([])
    } else {
      setSelectedItems((activeTab === "documents" ? documents : articles).map(item => item.id))
    }
  }

  const DocumentUploadDialog = () => {
    const [file, setFile] = useState<File | null>(null)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [tags, setTags] = useState("")

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: acceptedFiles => setFile(acceptedFiles[0]),
      maxFiles: 1,
      accept: {
        'application/pdf': ['.pdf'],
        'application/msword': ['.doc', '.docx'],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
        'application/vnd.ms-excel': ['.xls', '.xlsx'],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        'text/csv': ['.csv'],
        'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
      }
    })

    const handleSubmit = () => {
      if (!file || !name) return
      handleUpload(file, {
        name,
        description,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      })
    }

    return (
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setUploadDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Upload Document</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload a new document to your resources</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tags" className="text-right">Tags</Label>
              <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2, tag3" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">File</Label>
              <div {...getRootProps()} className={`col-span-3 border-2 border-dashed rounded-md p-6 text-center ${isDragActive ? 'border-primary' : 'border-gray-300'}`}>
                <input {...getInputProps()} />
                {file ? (
                  <p>{file.name} ({Math.round(file.size / 1024)} KB)</p>
                ) : (
                  <p>{isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSubmit} disabled={!file || !name}>Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const ArticleCreateDialog = () => {
    const [title, setTitle] = useState("")
    const [content, setContent] = useState("")
    const [category, setCategory] = useState("")
    const [tags, setTags] = useState("")
    const [isPublished, setIsPublished] = useState(false)

    const handleSubmit = () => {
      handleCreateArticle({
        title,
        content,
        category: category || undefined,
        tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        is_published: isPublished,
      })
    }

    return (
      <Dialog open={articleDialogOpen} onOpenChange={setArticleDialogOpen}>
        <DialogTrigger asChild>
          <Button onClick={() => setArticleDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Article</Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Create Knowledge Base Article</DialogTitle>
            <DialogDescription>Create a new article for your knowledge base</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="content" className="text-right pt-2">Content</Label>
              <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} className="col-span-3 min-h-[200px]" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">Category</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tags" className="text-right">Tags</Label>
              <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="tag1, tag2, tag3" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Published</Label>
              <Checkbox checked={isPublished} onCheckedChange={(checked) => setIsPublished(checked as boolean)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSubmit} disabled={!title || !content}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  const renderDocumentsTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">
            <Checkbox
              checked={selectedItems.length === documents.length && documents.length > 0}
              onCheckedChange={toggleSelectAll}
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: itemsPerPage }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
            </TableRow>
          ))
        ) : documents.length > 0 ? (
          documents.map((doc) => (
            <TableRow key={doc.id}>
              <TableCell>
                <Checkbox
                  checked={selectedItems.includes(doc.id)}
                  onCheckedChange={() => toggleSelectItem(doc.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{doc.name}</TableCell>
              <TableCell>{doc.file_type}</TableCell>
              <TableCell>{Math.round(doc.file_size / 1024)} KB</TableCell>
              <TableCell>
                {doc.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="mr-1">{tag}</Badge>
                ))}
              </TableCell>
              <TableCell>{new Date(doc.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => handleDownload(doc.id)}><Download className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-center">No documents found</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  const renderArticlesTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[50px]">
            <Checkbox
              checked={selectedItems.length === articles.length && articles.length > 0}
              onCheckedChange={toggleSelectAll}
            />
          </TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: itemsPerPage }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-4" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
              <TableCell><Skeleton className="h-4 w-full" /></TableCell>
            </TableRow>
          ))
        ) : articles.length > 0 ? (
          articles.map((article) => (
            <TableRow key={article.id}>
              <TableCell>
                <Checkbox
                  checked={selectedItems.includes(article.id)}
                  onCheckedChange={() => toggleSelectItem(article.id)}
                />
              </TableCell>
              <TableCell className="font-medium">{article.title}</TableCell>
              <TableCell>{article.category || '-'}</TableCell>
              <TableCell>
                {article.tags?.map(tag => (
                  <Badge key={tag} variant="secondary" className="mr-1">{tag}</Badge>
                ))}
              </TableCell>
              <TableCell>
                <Badge variant={article.is_published ? "default" : "secondary"}>
                  {article.is_published ? "Published" : "Draft"}
                </Badge>
              </TableCell>
              <TableCell>{new Date(article.created_at).toLocaleDateString()}</TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-center">No articles found</TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  const renderSearchResults = () => (
    <div className="space-y-4">
      {searchResults.length > 0 ? (
        searchResults.map((result) => (
          <Card key={`${result.type}-${result.id}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {result.type === "document" ? <FileText className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
                {result.type === "document" ? result.name : result.title}
              </CardTitle>
              <CardDescription>
                {result.type === "document" ? result.description : result.description?.substring(0, 100) + (result.description?.length > 100 ? "..." : "")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {result.type === "document" && result.file_type && (
                  <Badge variant="outline">{result.file_type}</Badge>
                )}
                <Badge variant="outline">{result.type}</Badge>
                <span className="text-sm text-muted-foreground">
                  {new Date(result.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <p className="text-center text-muted-foreground">No results found</p>
      )}
    </div>
  )

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Resources</h1>
        <div className="flex gap-2">
          {activeTab === "documents" && <DocumentUploadDialog />}
          {activeTab === "articles" && <ArticleCreateDialog />}
          {selectedItems.length > 0 && (
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedItems.length})
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search resources..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {searchQuery ? (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Search Results</h2>
          {renderSearchResults()}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="articles">Knowledge Base</TabsTrigger>
          </TabsList>
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Manage your organization's documents</CardDescription>
              </CardHeader>
              <CardContent>
                {renderDocumentsTable()}
              </CardContent>
              <CardFooter className="justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={currentPage * itemsPerPage >= totalCount}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="articles">
            <Card>
              <CardHeader>
                <CardTitle>Knowledge Base Articles</CardTitle>
                <CardDescription>Manage your organization's knowledge base</CardDescription>
              </CardHeader>
              <CardContent>
                {renderArticlesTable()}
              </CardContent>
              <CardFooter className="justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={currentPage * itemsPerPage >= totalCount}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}