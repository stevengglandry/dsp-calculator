import type {
  Item,
  MachinePresetId,
  NormalizedDspData,
  PlannerGoal,
  PlannerNode,
  PlannerResult,
  PlannerSettings,
  ProliferatorId,
  Recipe,
} from './types'

const EPSILON = 0.000001

export const proliferators: Record<
  ProliferatorId,
  { id: ProliferatorId; label: string; productMultiplier: number; sprayCostPerCycle: number }
> = {
  none: {
    id: 'none',
    label: 'None',
    productMultiplier: 1,
    sprayCostPerCycle: 0,
  },
  'proliferator-1': {
    id: 'proliferator-1',
    label: 'Proliferator Mk.I (+12.5%)',
    productMultiplier: 1.125,
    sprayCostPerCycle: 0.25,
  },
  'proliferator-2': {
    id: 'proliferator-2',
    label: 'Proliferator Mk.II (+20%)',
    productMultiplier: 1.2,
    sprayCostPerCycle: 0.25,
  },
  'proliferator-3': {
    id: 'proliferator-3',
    label: 'Proliferator Mk.III (+25%)',
    productMultiplier: 1.25,
    sprayCostPerCycle: 0.25,
  },
}

export const machinePresets: Record<MachinePresetId, { id: MachinePresetId; label: string; allowed: string[] }> = {
  starter: {
    id: 'starter',
    label: 'Assembling Machine Mk.I',
    allowed: ['arc-smelter', 'assembling-machine-1', 'chemical-plant', 'matrix-lab', 'oil-refinery', 'miniature-particle-collider'],
  },
  standard: {
    id: 'standard',
    label: 'Assembling Machine Mk.II',
    allowed: [
      'arc-smelter',
      'plane-smelter',
      'assembling-machine-1',
      'assembling-machine-2',
      'chemical-plant',
      'matrix-lab',
      'oil-refinery',
      'miniature-particle-collider',
      'fractionator',
    ],
  },
  advanced: {
    id: 'advanced',
    label: 'Assembling Machine Mk.III',
    allowed: [
      'arc-smelter',
      'plane-smelter',
      'assembling-machine-1',
      'assembling-machine-2',
      'assembling-machine-3',
      'chemical-plant',
      'quantum-chemical-plant',
      'matrix-lab',
      'oil-refinery',
      'miniature-particle-collider',
      'fractionator',
    ],
  },
  'dark-fog': {
    id: 'dark-fog',
    label: 'Dark Fog machines',
    allowed: [],
  },
}

export function createDefaultSettings(data: NormalizedDspData): PlannerSettings {
  return {
    beltId: data.defaults.maxBelt,
    machinePresetId: 'advanced',
    proliferatorId: 'proliferator-3',
    excludedRecipeIds: [...data.defaults.excludedRecipes],
    recipeOverrides: [],
    reuseBuildings: true,
    includeSplitters: true,
    maximumDepth: 80,
  }
}

export function createDefaultGoals(data: NormalizedDspData): PlannerGoal[] {
  const processor = data.itemById.get('processor')
  const fallback = data.components.find((item) => data.recipesByOutput.has(item.id)) ?? data.items[0]

  return [
    {
      id: crypto.randomUUID(),
      itemId: processor?.id ?? fallback.id,
      ratePerMinute: 60,
    },
  ]
}

function getItemName(data: NormalizedDspData, itemId: string) {
  return data.itemById.get(itemId)?.name ?? itemId
}

function getRecipeOutput(recipe: Recipe, itemId: string) {
  return recipe.out[itemId] ?? 0
}

function getMachineSpeed(item?: Item) {
  return item?.machine?.speed && item.machine.speed > 0 ? item.machine.speed : 1
}

function getMachineUsageKw(item?: Item) {
  return item?.machine?.usage && item.machine.usage > 0 ? item.machine.usage : 0
}

function getAllowedProducerIds(settings: PlannerSettings) {
  const preset = machinePresets[settings.machinePresetId]
  if (!preset || preset.id === 'dark-fog') return undefined
  return new Set(preset.allowed)
}

function chooseProducer(data: NormalizedDspData, recipe: Recipe, settings: PlannerSettings) {
  const producers = recipe.producers ?? []
  if (producers.length === 0) return undefined

  const allowedProducerIds = getAllowedProducerIds(settings)
  const allowed = allowedProducerIds ? producers.filter((producerId) => allowedProducerIds.has(producerId)) : producers
  const candidates = allowed.length > 0 ? allowed : producers

  return candidates
    .map((producerId) => data.itemById.get(producerId))
    .filter((producer): producer is Item => Boolean(producer))
    .sort((left, right) => getMachineSpeed(right) - getMachineSpeed(left))[0]
}

function chooseRecipe(data: NormalizedDspData, itemId: string, settings: PlannerSettings) {
  const override = settings.recipeOverrides.find((entry) => entry.itemId === itemId)
  if (override) {
    const recipe = data.recipeById.get(override.recipeId)
    if (recipe) return recipe
  }

  const excluded = new Set(settings.excludedRecipeIds)
  const recipes = data.recipesByOutput.get(itemId) ?? []
  return recipes.find((recipe) => !excluded.has(recipe.id)) ?? recipes[0]
}

function productMultiplierFor(recipe: Recipe, settings: PlannerSettings) {
  if (settings.proliferatorId === 'none') return 1
  if (recipe.flags?.includes('noProductivity')) return 1
  return proliferators[settings.proliferatorId].productMultiplier
}

function addToMap(map: Map<string, number>, itemId: string, value: number) {
  map.set(itemId, (map.get(itemId) ?? 0) + value)
}

function nodeId(prefix: string, index: number) {
  return `${prefix}-${index.toString(36)}`
}

export function solvePlan(data: NormalizedDspData, goals: PlannerGoal[], settings: PlannerSettings): PlannerResult {
  const belt = data.itemById.get(settings.beltId)
  const beltSpeed = belt?.belt?.speed ?? 30
  const nodes: PlannerNode[] = []
  const rawInputs: PlannerNode[] = []
  const warnings: string[] = []
  const surplus = new Map<string, number>()
  let nodeIndex = 0
  let proliferatorPerMinute = 0

  function createRawInput(itemId: string, ratePerMinute: number, depth: number, warning?: string) {
    const node: PlannerNode = {
      id: nodeId('raw', nodeIndex++),
      itemId,
      depth,
      ratePerMinute,
      cyclesPerMinute: 0,
      machineCount: 0,
      beltLanes: ratePerMinute / beltSpeed,
      powerMw: 0,
      inputs: [],
      outputs: [
        {
          itemId,
          ratePerMinute,
          amountPerCycle: 0,
        },
      ],
      warning,
    }
    rawInputs.push(node)
    nodes.push(node)
  }

  function expandDemand(itemId: string, requestedRate: number, depth: number, trail: string[], parentItemId?: string) {
    if (requestedRate <= EPSILON) return

    const availableSurplus = surplus.get(itemId) ?? 0
    const credited = Math.min(availableSurplus, requestedRate)
    if (credited > EPSILON) {
      surplus.set(itemId, availableSurplus - credited)
      requestedRate -= credited
    }
    if (requestedRate <= EPSILON) return

    if (depth > settings.maximumDepth) {
      const warning = `Stopped expanding ${getItemName(data, itemId)} at depth ${settings.maximumDepth}.`
      warnings.push(warning)
      createRawInput(itemId, requestedRate, depth, warning)
      return
    }

    if (trail.includes(itemId)) {
      const warning = `Cycle detected while expanding ${getItemName(data, itemId)}.`
      warnings.push(warning)
      createRawInput(itemId, requestedRate, depth, warning)
      return
    }

    const recipe = chooseRecipe(data, itemId, settings)
    const outputAmount = recipe ? getRecipeOutput(recipe, itemId) : 0
    if (!recipe || outputAmount <= 0) {
      createRawInput(itemId, requestedRate, depth)
      return
    }

    const productMultiplier = productMultiplierFor(recipe, settings)
    const effectiveOutput = outputAmount * productMultiplier
    const cyclesPerMinute = requestedRate / effectiveOutput
    const machine = chooseProducer(data, recipe, settings)
    const machineSpeed = getMachineSpeed(machine)
    const machineCount = (cyclesPerMinute * recipe.time) / (60 * machineSpeed)
    const powerMw = (machineCount * getMachineUsageKw(machine)) / 1000
    const inputs = Object.entries(recipe.in).map(([inputItemId, amountPerCycle]) => ({
      itemId: inputItemId,
      amountPerCycle,
      ratePerMinute: amountPerCycle * cyclesPerMinute,
    }))
    const outputs = Object.entries(recipe.out).map(([outputItemId, amountPerCycle]) => ({
      itemId: outputItemId,
      amountPerCycle,
      ratePerMinute: amountPerCycle * cyclesPerMinute * productMultiplier,
    }))

    for (const output of outputs) {
      if (output.itemId !== itemId) {
        addToMap(surplus, output.itemId, output.ratePerMinute)
      }
    }

    proliferatorPerMinute += inputs.length * cyclesPerMinute * proliferators[settings.proliferatorId].sprayCostPerCycle

    nodes.push({
      id: nodeId('node', nodeIndex++),
      itemId,
      recipeId: recipe.id,
      depth,
      parentItemId,
      ratePerMinute: requestedRate,
      cyclesPerMinute,
      machineId: machine?.id,
      machineCount,
      beltLanes: requestedRate / beltSpeed,
      powerMw,
      inputs,
      outputs,
      warning: machine ? undefined : `No producer found for ${recipe.name}.`,
    })

    for (const input of inputs) {
      expandDemand(input.itemId, input.ratePerMinute, depth + 1, [...trail, itemId], itemId)
    }
  }

  for (const goal of goals) {
    expandDemand(goal.itemId, goal.ratePerMinute, 0, [])
  }

  const totals = nodes.reduce(
    (acc, node) => {
      if (node.machineCount > 0) {
        acc.buildings += node.machineCount
        acc.powerMw += node.powerMw
      }
      acc.beltsPerMinute += node.ratePerMinute
      return acc
    },
    {
      buildings: 0,
      beltsPerMinute: 0,
      powerMw: 0,
      proliferatorPerMinute,
    },
  )

  return {
    nodes,
    rawInputs,
    warnings,
    totals,
  }
}

export function getAvailableRecipes(data: NormalizedDspData, itemId: string) {
  return data.recipesByOutput.get(itemId) ?? []
}
