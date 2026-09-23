export type Product = { id: string; sku: string; name: string; unit: string; product_type: string }
export type RecipeItem = {
  id: string
  material_id: string
  quantity: number
  unit: string
  material: Product
}
export type Recipe = {
  id: string
  product_id: string
  name: string
  version: number
  output_quantity: number
  output_unit: string
  items: RecipeItem[]
}
export type Stock = { product_id: string; quantity: number }
export type Requirement = RecipeItem & { required: number; available: number; shortage: number }
export function calculateRequirements(recipe: Recipe | undefined, target: number, stock: Stock[]) {
  if (!recipe || !Number.isFinite(target) || target <= 0) return [] as Requirement[]
  const multiplier = target / Number(recipe.output_quantity)
  return recipe.items.map((item) => {
    const required = Number((item.quantity * multiplier).toFixed(3))
    const available = Number(stock.find((s) => s.product_id === item.material_id)?.quantity ?? 0)
    return {
      ...item,
      required,
      available,
      shortage: Math.max(0, Number((required - available).toFixed(3))),
    }
  })
}
export function formatQty(value: number, unit: string) {
  return `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(value)} ${unit}`
}
