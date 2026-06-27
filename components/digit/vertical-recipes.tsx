"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pill, Wind, Truck, FlaskConical, FileText, Activity, Loader2 } from "lucide-react"

const verticalRecipes = [
  {
    vertical: "Pharmaceutical",
    icon: Pill,
    color: "text-emerald-500",
    recipes: [
      { name: "Batch Record Review", description: "Extract batch data → verify against specs → flag deviations → archive", steps: 4 },
      { name: "Certificate of Analysis", description: "Extract COA fields → compare to limits → log batch disposition", steps: 3 },
      { name: "Deviation Report", description: "Parse deviation → create CAPA → notify QA → track closure", steps: 5 },
      { name: "Stability Study", description: "Extract timepoints → flag out-of-spec → generate trend report", steps: 4 },
    ],
  },
  {
    vertical: "Renewable Energy",
    icon: Wind,
    color: "text-cyan-500",
    recipes: [
      { name: "Site Survey Report", description: "Extract coordinates, terrain data → create asset → schedule validation", steps: 3 },
      { name: "Generation Report", description: "Parse generation data → compare to forecasts → flag anomalies", steps: 4 },
      { name: "O&M Log", description: "Extract maintenance entries → update asset status → schedule next service", steps: 4 },
      { name: "Turbine Inspection", description: "Parse inspection findings → create work order → assign technician", steps: 4 },
    ],
  },
  {
    vertical: "Logistics & Supply Chain",
    icon: Truck,
    color: "text-amber-500",
    recipes: [
      { name: "Proof of Delivery", description: "Extract POD fields → update shipment → trigger invoicing", steps: 3 },
      { name: "E-Way Bill", description: "Extract consignment data → validate route → log transit record", steps: 3 },
      { name: "Manifest", description: "Parse manifest → reconcile inventory → flag discrepancies", steps: 4 },
      { name: "Customs Declaration", description: "Extract HS codes → validate docs → file clearance request", steps: 5 },
    ],
  },
]

export function VerticalRecipes() {
  const [activeVertical, setActiveVertical] = useState(verticalRecipes[0].vertical)
  const [runningRecipe, setRunningRecipe] = useState<string | null>(null)

  const current = verticalRecipes.find((v) => v.vertical === activeVertical)!

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {verticalRecipes.map((v) => (
          <Button key={v.vertical} variant={activeVertical === v.vertical ? "default" : "outline"} size="sm" onClick={() => setActiveVertical(v.vertical)}>
            <v.icon className={`h-4 w-4 mr-1.5 ${v.color}`} />{v.vertical}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {current.recipes.map((recipe, i) => (
          <motion.div
            key={recipe.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{recipe.name}</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">{recipe.steps} steps</Badge>
                </div>
                <CardDescription className="text-xs mt-1">{recipe.description}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => {
                  setRunningRecipe(recipe.name)
                  setTimeout(() => {
                    fetch("/api/v1/operations/run-recipe", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ recipe: recipe.name, vertical: current.vertical }),
                    }).catch(() => {}).finally(() => setRunningRecipe(null))
                  }, 500)
                }} disabled={runningRecipe === recipe.name}>
                  {runningRecipe === recipe.name ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Activity className="h-3 w-3 mr-1" />}
                  {runningRecipe === recipe.name ? "Running..." : "Run Recipe"}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
