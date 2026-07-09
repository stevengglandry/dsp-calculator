import type { PlannerGoal, PlannerSaveV1, PlannerSettings } from './types'

const STORAGE_KEY = 'dsp-calculator:planner-v1'

export function toSave(goals: PlannerGoal[], settings: PlannerSettings): PlannerSaveV1 {
  return {
    version: 1,
    goals,
    settings,
  }
}

export function readSave(): PlannerSaveV1 | undefined {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw) as PlannerSaveV1
    if (parsed.version === 1 && Array.isArray(parsed.goals) && parsed.settings) return parsed
  } catch {
    return undefined
  }

  return undefined
}

export function writeSave(goals: PlannerGoal[], settings: PlannerSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave(goals, settings)))
}

export function parseSave(text: string): PlannerSaveV1 {
  const parsed = JSON.parse(text) as PlannerSaveV1
  if (parsed.version !== 1 || !Array.isArray(parsed.goals) || !parsed.settings) {
    throw new Error('Unsupported planner save file.')
  }
  return parsed
}
