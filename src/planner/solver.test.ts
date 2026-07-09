import { describe, expect, it } from 'vitest'
import { dspData } from '../data/normalize'
import { createDefaultSettings, solvePlan } from './solver'
import type { PlannerGoal } from './types'

function goal(itemId: string, ratePerMinute: number): PlannerGoal {
  return {
    id: `${itemId}-${ratePerMinute}`,
    itemId,
    ratePerMinute,
  }
}

describe('DSP data normalization', () => {
  it('loads the FactorioLab DSP snapshot with recipes, icons, machines, and belts', () => {
    expect(dspData.version).toBe('0.10.29.21950')
    expect(dspData.items.length).toBeGreaterThan(450)
    expect(dspData.recipes.length).toBeGreaterThan(450)
    expect(dspData.iconById.get('processor')).toMatchObject({ id: 'processor' })
    expect(dspData.belts.map((belt) => belt.id)).toEqual(['conveyor-belt-1', 'conveyor-belt-2', 'conveyor-belt-3'])
  })
})

describe('solvePlan', () => {
  it('expands Processor 60/min into buildings, belts, power, and raw inputs', () => {
    const result = solvePlan(dspData, [goal('processor', 60)], createDefaultSettings(dspData))

    expect(result.nodes.some((node) => node.itemId === 'processor')).toBe(true)
    expect(result.nodes.some((node) => node.itemId === 'circuit-board')).toBe(true)
    expect(result.nodes.some((node) => node.itemId === 'iron-ore')).toBe(true)
    expect(result.totals.buildings).toBeGreaterThan(0)
    expect(result.totals.powerMw).toBeGreaterThan(0)
    expect(result.totals.beltsPerMinute).toBeGreaterThan(60)
  })

  it('uses enabled alternate recipes when the default exclusion is removed', () => {
    const settings = createDefaultSettings(dspData)
    const disabled = solvePlan(dspData, [goal('graphene', 120)], settings)
    const enabledSettings = {
      ...settings,
      excludedRecipeIds: settings.excludedRecipeIds.filter((recipeId) => recipeId !== 'graphene-advanced'),
      recipeOverrides: [{ itemId: 'graphene', recipeId: 'graphene-advanced' }],
    }
    const enabled = solvePlan(dspData, [goal('graphene', 120)], enabledSettings)

    expect(disabled.nodes.find((node) => node.itemId === 'graphene')?.recipeId).not.toBe('graphene-advanced')
    expect(enabled.nodes.find((node) => node.itemId === 'graphene')?.recipeId).toBe('graphene-advanced')
  })

  it('credits byproducts as surplus for later matching demands', () => {
    const settings = {
      ...createDefaultSettings(dspData),
      excludedRecipeIds: [],
      recipeOverrides: [
        { itemId: 'hydrogen', recipeId: 'x-ray-cracking' },
        { itemId: 'energetic-graphite', recipeId: 'energetic-graphite' },
      ],
    }
    const result = solvePlan(dspData, [goal('hydrogen', 60), goal('energetic-graphite', 30)], settings)
    const graphiteProduction = result.nodes.filter((node) => node.itemId === 'energetic-graphite' && node.recipeId === 'energetic-graphite')

    expect(graphiteProduction.length).toBeLessThanOrEqual(1)
  })

  it('warns and treats cycles as manual inputs', () => {
    const settings = {
      ...createDefaultSettings(dspData),
      recipeOverrides: [{ itemId: 'hydrogen', recipeId: 'x-ray-cracking' }],
      excludedRecipeIds: [],
      maximumDepth: 12,
    }
    const result = solvePlan(dspData, [goal('hydrogen', 60)], settings)

    expect(result.warnings.some((warning) => warning.includes('Cycle detected'))).toBe(true)
    expect(result.rawInputs.some((node) => node.itemId === 'hydrogen')).toBe(true)
  })
})
