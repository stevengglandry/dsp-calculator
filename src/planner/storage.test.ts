import { describe, expect, it } from 'vitest'
import { dspData } from '../data/normalize'
import { createDefaultGoals, createDefaultSettings } from './solver'
import { parseSave, toSave } from './storage'

describe('planner save format', () => {
  it('round trips versioned planner state', () => {
    const goals = createDefaultGoals(dspData)
    const settings = createDefaultSettings(dspData)
    const save = toSave(goals, settings)
    const parsed = parseSave(JSON.stringify(save))

    expect(parsed.version).toBe(1)
    expect(parsed.goals).toEqual(goals)
    expect(parsed.settings.beltId).toBe(settings.beltId)
  })

  it('rejects unsupported planner state', () => {
    expect(() => parseSave(JSON.stringify({ version: 99 }))).toThrow('Unsupported planner save file.')
  })
})
