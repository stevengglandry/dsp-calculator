import rawData from './dsp/data.json'
import defaultsData from './dsp/defaults.json'
import type {
  DspDefaults,
  IconDefinition,
  Item,
  NormalizedDspData,
  RawDspData,
  Recipe,
} from '../planner/types'

const raw = rawData as unknown as RawDspData
const defaults = defaultsData as unknown as DspDefaults

const categoryOrder = new Map([
  ['components', 0],
  ['buildings', 1],
  ['technologies', 2],
  ['upgrades', 3],
])

function byRowThenName<T extends { row?: number; name: string }>(left: T, right: T) {
  const leftGroup = left.row ?? 999
  const rightGroup = right.row ?? 999
  if (leftGroup !== rightGroup) return leftGroup - rightGroup
  return left.name.localeCompare(right.name)
}

function byCategoryRowName(left: Item, right: Item) {
  const leftCategory = categoryOrder.get(left.category) ?? 99
  const rightCategory = categoryOrder.get(right.category) ?? 99
  if (leftCategory !== rightCategory) return leftCategory - rightCategory
  return byRowThenName(left, right)
}

function createRecipesByOutput(recipes: Recipe[]) {
  const map = new Map<string, Recipe[]>()

  for (const recipe of recipes) {
    for (const itemId of Object.keys(recipe.out)) {
      const list = map.get(itemId) ?? []
      list.push(recipe)
      map.set(itemId, list)
    }
  }

  for (const list of map.values()) {
    list.sort((left, right) => {
      const leftLocked = left.flags?.includes('locked') ? 0 : 1
      const rightLocked = right.flags?.includes('locked') ? 0 : 1
      if (leftLocked !== rightLocked) return leftLocked - rightLocked
      return byRowThenName(left, right)
    })
  }

  return map
}

function normalize(): NormalizedDspData {
  const items = [...raw.items].sort(byCategoryRowName)
  const recipes = [...raw.recipes].sort(byRowThenName)
  const icons = [...raw.icons].sort((left, right) => left.id.localeCompare(right.id))
  const itemById = new Map(items.map((item) => [item.id, item] as const))
  const iconById = new Map(icons.map((icon: IconDefinition) => [icon.id, icon] as const))
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe] as const))
  const recipesByOutput = createRecipesByOutput(recipes)
  const buildings = items.filter((item) => item.category === 'buildings')
  const components = items.filter((item) => item.category !== 'buildings')
  const belts = buildings.filter((item) => item.belt)
  const machines = buildings.filter((item) => item.machine?.speed)

  return {
    version: raw.version.DSP,
    categories: raw.categories,
    items,
    buildings,
    components,
    recipes,
    icons,
    itemById,
    iconById,
    recipeById,
    recipesByOutput,
    belts,
    machines,
    defaults,
  }
}

export const dspData = normalize()
export const iconAtlasUrl = `${import.meta.env.BASE_URL}data/dsp/icons.webp`
