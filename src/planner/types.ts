export type ItemCategory = 'components' | 'buildings' | 'technologies' | 'upgrades' | string

export interface IconDefinition {
  id: string
  x: number
  y: number
  color?: string
}

export interface MachineDefinition {
  drain?: number
  fuelCategories?: string[]
  modules?: number
  speed?: number
  type: string
  usage?: number
}

export interface BeltDefinition {
  speed: number
}

export interface Item {
  id: string
  name: string
  category: ItemCategory
  row?: number
  stack?: number
  machine?: MachineDefinition
  belt?: BeltDefinition
}

export interface Recipe {
  id: string
  name: string
  category: ItemCategory
  time: number
  in: Record<string, number>
  out: Record<string, number>
  producers?: string[]
  row?: number
  flags?: string[]
}

export interface DspCategory {
  id: string
  name: string
  icon?: string
}

export interface RawDspData {
  version: Record<string, string>
  categories: DspCategory[]
  icons: IconDefinition[]
  items: Item[]
  recipes: Recipe[]
  limitations?: {
    productivity?: string[]
  }
  defaults?: unknown
  flags?: string[]
}

export interface DspDefaults {
  excludedRecipes: string[]
  maxBelt: string
  maxMachineRank: string[]
  minBelt: string
  minMachineRank: string[]
  moduleRank: string[]
  fuelRank: string[]
}

export interface NormalizedDspData {
  version: string
  categories: DspCategory[]
  items: Item[]
  buildings: Item[]
  components: Item[]
  recipes: Recipe[]
  icons: IconDefinition[]
  itemById: Map<string, Item>
  iconById: Map<string, IconDefinition>
  recipeById: Map<string, Recipe>
  recipesByOutput: Map<string, Recipe[]>
  belts: Item[]
  machines: Item[]
  defaults: DspDefaults
}

export type ProliferatorId = 'none' | 'proliferator-1' | 'proliferator-2' | 'proliferator-3'
export type MachinePresetId = 'starter' | 'standard' | 'advanced' | 'dark-fog'

export interface PlannerGoal {
  id: string
  itemId: string
  ratePerMinute: number
}

export interface RecipeOverride {
  itemId: string
  recipeId: string
}

export interface PlannerSettings {
  beltId: string
  machinePresetId: MachinePresetId
  proliferatorId: ProliferatorId
  excludedRecipeIds: string[]
  recipeOverrides: RecipeOverride[]
  reuseBuildings: boolean
  includeSplitters: boolean
  maximumDepth: number
}

export interface RecipeFlow {
  itemId: string
  ratePerMinute: number
  amountPerCycle: number
}

export interface PlannerNode {
  id: string
  itemId: string
  recipeId?: string
  depth: number
  parentItemId?: string
  parentNodeId?: string
  ratePerMinute: number
  cyclesPerMinute: number
  machineId?: string
  machineCount: number
  beltLanes: number
  powerMw: number
  inputs: RecipeFlow[]
  outputs: RecipeFlow[]
  warning?: string
}

export interface PlannerResult {
  nodes: PlannerNode[]
  rawInputs: PlannerNode[]
  warnings: string[]
  totals: {
    buildings: number
    beltsPerMinute: number
    powerMw: number
    proliferatorPerMinute: number
  }
}

export interface PlannerSaveV1 {
  version: 1
  goals: PlannerGoal[]
  settings: PlannerSettings
}
