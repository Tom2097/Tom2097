export interface AssetNode {
  id: string; name: string; type: string; parentId: string | null; children: AssetNode[]
  metadata: Record<string, unknown>; path: string;
}

export function buildAssetTree(assets: Array<Omit<AssetNode, "children" | "path">>): AssetNode[] {
  const map = new Map<string, AssetNode>()
  const roots: AssetNode[] = []

  assets.forEach((a) => map.set(a.id, { ...a, children: [], path: "" }))
  assets.forEach((a) => {
    const node = map.get(a.id)!
    const pathParts: string[] = [node.name]
    let parent = a.parentId ? map.get(a.parentId) : null
    while (parent) {
      pathParts.unshift(parent.name)
      parent = parent.parentId ? map.get(parent.parentId) : null
    }
    node.path = pathParts.join(" > ")
    if (a.parentId && map.has(a.parentId)) {
      map.get(a.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  })
  return roots
}

export function findAssetByPath(root: AssetNode[], path: string): AssetNode | null {
  for (const node of root) {
    if (node.path === path) return node
    const found = findAssetByPath(node.children, path)
    if (found) return found
  }
  return null
}

export function flattenTree(nodes: AssetNode[]): AssetNode[] {
  const result: AssetNode[] = []
  for (const node of nodes) {
    result.push(node)
    result.push(...flattenTree(node.children))
  }
  return result
}
