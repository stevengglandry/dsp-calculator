import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  ArrowDown,
  ArrowUp,
  Boxes,
  ChevronDown,
  CircleDot,
  Download,
  Factory,
  FileUp,
  Moon,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'
import { IconSprite } from './components/IconSprite'
import { dspData } from './data/normalize'
import { createDefaultGoals, createDefaultSettings, getAvailableRecipes, machinePresets, proliferators, solvePlan } from './planner/solver'
import { parseSave, readSave, toSave, writeSave } from './planner/storage'
import type { Item, PlannerGoal, PlannerNode, PlannerSettings, Recipe } from './planner/types'

type PickerTab = 'items' | 'buildings'
type PickerMode = 'goal' | 'override'
type PlannerViewMode = 'tree' | 'graph'

interface PickerState {
  mode: PickerMode
  goalId?: string
  itemId?: string
}

const rateFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const countFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})

const powerFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const alternateRecipeIds = dspData.defaults.excludedRecipes
  .filter((recipeId) => dspData.recipeById.has(recipeId))
  .slice(0, 7)

function formatRate(value: number) {
  return `${rateFormatter.format(value)} / min`
}

function formatCount(value: number) {
  return countFormatter.format(value)
}

function itemName(itemId: string) {
  return dspData.itemById.get(itemId)?.name ?? itemId
}

function recipeLabel(recipe?: Recipe) {
  return recipe?.name ?? 'Manual input'
}

function getRecipeOverride(settings: PlannerSettings, itemId: string) {
  return settings.recipeOverrides.find((entry) => entry.itemId === itemId)?.recipeId
}

function getSelectedRecipe(itemId: string, settings: PlannerSettings) {
  const override = getRecipeOverride(settings, itemId)
  if (override) return dspData.recipeById.get(override)
  const excluded = new Set(settings.excludedRecipeIds)
  const recipes = getAvailableRecipes(dspData, itemId)
  return recipes.find((recipe) => !excluded.has(recipe.id)) ?? recipes[0]
}

function replaceRecipeOverride(settings: PlannerSettings, itemId: string, recipeId: string): PlannerSettings {
  const recipeOverrides = settings.recipeOverrides.filter((entry) => entry.itemId !== itemId)
  recipeOverrides.push({ itemId, recipeId })
  return { ...settings, recipeOverrides }
}

function toggleExcludedRecipe(settings: PlannerSettings, recipeId: string): PlannerSettings {
  const excluded = new Set(settings.excludedRecipeIds)
  if (excluded.has(recipeId)) {
    excluded.delete(recipeId)
  } else {
    excluded.add(recipeId)
  }
  return { ...settings, excludedRecipeIds: [...excluded] }
}

function getInitialState() {
  const saved = readSave()
  if (saved) {
    return {
      goals: saved.goals,
      settings: saved.settings,
    }
  }
  return {
    goals: createDefaultGoals(dspData),
    settings: createDefaultSettings(dspData),
  }
}

function App() {
  const [initialState] = useState(getInitialState)
  const [goals, setGoals] = useState<PlannerGoal[]>(initialState.goals)
  const [settings, setSettings] = useState<PlannerSettings>(initialState.settings)
  const [picker, setPicker] = useState<PickerState | undefined>()
  const [globalSearch, setGlobalSearch] = useState('')
  const deferredSearch = useDeferredValue(globalSearch)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const result = useMemo(() => solvePlan(dspData, goals, settings), [goals, settings])
  const selectedGoalItem = dspData.itemById.get(goals[0]?.itemId ?? 'processor') ?? dspData.items[0]
  const searchMatches = useMemo(() => searchItems(deferredSearch, dspData.items).slice(0, 6), [deferredSearch])

  useEffect(() => {
    writeSave(goals, settings)
  }, [goals, settings])

  function updateGoalRate(goalId: string, ratePerMinute: number) {
    setGoals((current) => current.map((goal) => (goal.id === goalId ? { ...goal, ratePerMinute } : goal)))
  }

  function updateGoalItem(goalId: string, itemId: string) {
    setGoals((current) => current.map((goal) => (goal.id === goalId ? { ...goal, itemId } : goal)))
  }

  function addGoal(itemId = selectedGoalItem.id) {
    setGoals((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        itemId,
        ratePerMinute: 60,
      },
    ])
  }

  function removeGoal(goalId: string) {
    setGoals((current) => (current.length === 1 ? current : current.filter((goal) => goal.id !== goalId)))
  }

  function handlePickerSelect(item: Item, recipe?: Recipe) {
    if (!picker) return
    if (picker.mode === 'goal' && picker.goalId) {
      updateGoalItem(picker.goalId, item.id)
    }
    if (picker.mode === 'override' && recipe) {
      setSettings((current) => replaceRecipeOverride(current, item.id, recipe.id))
    }
    setPicker(undefined)
  }

  function exportPlanner() {
    const payload = JSON.stringify(toSave(goals, settings), null, 2)
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'dsp-calculator-plan.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importPlanner(file: File) {
    const text = await file.text()
    const save = parseSave(text)
    setGoals(save.goals)
    setSettings(save.settings)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <CircleDot size={23} />
          </span>
          <h1>DSP Calculator</h1>
        </div>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            className="hidden-file"
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importPlanner(file)
              event.currentTarget.value = ''
            }}
          />
          <button className="ghost-button" type="button" onClick={() => fileInputRef.current?.click()}>
            <FileUp size={16} />
            Import
          </button>
          <button className="ghost-button" type="button" onClick={exportPlanner}>
            <Download size={16} />
            Export
          </button>
          <button className="icon-button" type="button" aria-label="Settings">
            <Settings size={18} />
          </button>
          <button className="moon-button" type="button" aria-label="Dark mode">
            <Moon size={17} />
          </button>
        </div>
      </header>

      <section className="goal-bar" aria-label="Production goals">
        <span className="goal-label">Add production goal</span>
        <button
          className="select-control goal-select"
          type="button"
          onClick={() => setPicker({ mode: 'goal', goalId: goals[0]?.id, itemId: goals[0]?.itemId })}
        >
          <IconSprite icon={dspData.iconById.get(selectedGoalItem.id)} label={selectedGoalItem.name} size={28} />
          <span>{selectedGoalItem.name}</span>
          <ChevronDown size={16} />
        </button>
        <label className="rate-input">
          <input
            value={goals[0]?.ratePerMinute ?? 60}
            type="number"
            min="1"
            step="1"
            onChange={(event) => updateGoalRate(goals[0].id, Number(event.target.value))}
          />
          <span>/ min</span>
        </label>
        <button className="primary-button" type="button" onClick={() => addGoal()}>
          <Plus size={17} />
          Add
        </button>
        <div className="goal-search">
          <Search size={17} />
          <input
            value={globalSearch}
            placeholder="Search items..."
            onChange={(event) => setGlobalSearch(event.target.value)}
          />
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
          {deferredSearch && searchMatches.length > 0 ? (
            <div className="quick-results">
              {searchMatches.map((item) => (
                <button key={item.id} type="button" onClick={() => addGoal(item.id)}>
                  <IconSprite icon={dspData.iconById.get(item.id)} label={item.name} size={22} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="workspace">
        <SideRail
          goals={goals}
          rawInputs={result.rawInputs}
          totals={result.totals}
          settings={settings}
          onPickGoal={(goalId) => setPicker({ mode: 'goal', goalId, itemId: goals.find((goal) => goal.id === goalId)?.itemId })}
          onRateChange={updateGoalRate}
          onRemoveGoal={removeGoal}
        />
        <PlannerPanel result={result} settings={settings} onOpenRecipe={(itemId) => setPicker({ mode: 'override', itemId })} />
        <SettingsPanel settings={settings} onSettingsChange={setSettings} />
      </section>

      {picker ? <RecipePicker picker={picker} settings={settings} onClose={() => setPicker(undefined)} onSelect={handlePickerSelect} /> : null}
    </main>
  )
}

interface SideRailProps {
  goals: PlannerGoal[]
  rawInputs: PlannerNode[]
  totals: {
    buildings: number
    beltsPerMinute: number
    powerMw: number
    proliferatorPerMinute: number
  }
  settings: PlannerSettings
  onPickGoal: (goalId: string) => void
  onRateChange: (goalId: string, ratePerMinute: number) => void
  onRemoveGoal: (goalId: string) => void
}

function SideRail({ goals, rawInputs, totals, settings, onPickGoal, onRateChange, onRemoveGoal }: SideRailProps) {
  const belt = dspData.itemById.get(settings.beltId)
  const proliferator = proliferators[settings.proliferatorId]

  return (
    <aside className="side-rail">
      <section className="rail-panel outputs-panel">
        <PanelHeading title="Outputs" count={goals.length} />
        <div className="goal-list">
          {goals.map((goal) => {
            const item = dspData.itemById.get(goal.itemId)
            if (!item) return null
            return (
              <div className="rail-row" key={goal.id}>
                <button className="rail-item-button" type="button" onClick={() => onPickGoal(goal.id)}>
                  <IconSprite icon={dspData.iconById.get(item.id)} label={item.name} size={30} />
                  <span>{item.name}</span>
                </button>
                <input
                  className="rail-rate"
                  value={goal.ratePerMinute}
                  type="number"
                  min="1"
                  onChange={(event) => onRateChange(goal.id, Number(event.target.value))}
                />
                <button className="row-icon-button" type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveGoal(goal.id)}>
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rail-panel inputs-panel">
        <PanelHeading title="Inputs" count={rawInputs.length} />
        {rawInputs.length === 0 ? (
          <div className="empty-state">
            <span>No manual inputs</span>
            <p>Add outputs to see required raw inputs.</p>
          </div>
        ) : (
          <div className="input-list">
            {rawInputs.slice(0, 9).map((node) => {
              const item = dspData.itemById.get(node.itemId)
              return (
                <div className="compact-row" key={node.id}>
                  <IconSprite icon={dspData.iconById.get(node.itemId)} label={itemName(node.itemId)} size={24} />
                  <span>{item?.name ?? node.itemId}</span>
                  <strong>{formatRate(node.ratePerMinute)}</strong>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="rail-panel totals-panel">
        <MetricRow icon={<Sparkles size={17} />} label="Total Power" value={`${powerFormatter.format(totals.powerMw)} MW`} />
        <MetricRow icon={<Factory size={17} />} label="Buildings" value={formatCount(totals.buildings)} />
        <MetricRow
          icon={<Boxes size={17} />}
          label={`Belts (${belt?.name.replace('Conveyor Belt ', '') ?? 'Max'})`}
          value={formatRate(totals.beltsPerMinute)}
        />
        <MetricRow
          icon={<IconSprite icon={dspData.iconById.get(settings.proliferatorId)} label={proliferator.label} size={18} />}
          label="Proliferator Use"
          value={formatRate(totals.proliferatorPerMinute)}
        />
      </section>
    </aside>
  )
}

function PanelHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      <span>{count}</span>
      <ChevronDown size={15} />
    </div>
  )
}

function MetricRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-row">
      <span className="metric-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

interface PlannerPanelProps {
  result: ReturnType<typeof solvePlan>
  settings: PlannerSettings
  onOpenRecipe: (itemId: string) => void
}

function PlannerPanel({ result, settings, onOpenRecipe }: PlannerPanelProps) {
  const [viewMode, setViewMode] = useState<PlannerViewMode>('tree')
  const tableRows = result.nodes.filter((node) => node.machineCount > 0).slice(0, 14)

  return (
    <section className="planner-panel">
      <div className="panel-title-row">
        <h2>Production Chain</h2>
        <div className="view-toggle" aria-label="View mode">
          <button className={viewMode === 'tree' ? 'active' : ''} type="button" aria-pressed={viewMode === 'tree'} onClick={() => setViewMode('tree')}>
            <Boxes size={15} />
            Tree
          </button>
          <button className={viewMode === 'graph' ? 'active' : ''} type="button" aria-pressed={viewMode === 'graph'} onClick={() => setViewMode('graph')}>
            <CircleDot size={15} />
            Graph
          </button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="chain-view" aria-label="Production chain">
          {result.nodes.slice(0, 34).map((node) => (
            <ProductionNode key={node.id} node={node} settings={settings} onOpenRecipe={onOpenRecipe} />
          ))}
        </div>
      ) : (
        <ProductionGraph nodes={result.nodes} />
      )}

      {result.warnings.length > 0 ? (
        <div className="warning-strip">
          {result.warnings.slice(0, 2).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}

      <div className="summary-table" aria-label="Planner summary">
        <div className="summary-head">
          <span>Item / Building</span>
          <span>Rate</span>
          <span>Machines</span>
          <span>Belt Demand</span>
        </div>
        {tableRows.map((node) => {
          const item = dspData.itemById.get(node.itemId)
          const machine = node.machineId ? dspData.itemById.get(node.machineId) : undefined
          return (
            <button key={node.id} className="summary-row" type="button" onClick={() => onOpenRecipe(node.itemId)}>
              <span>
                <IconSprite icon={dspData.iconById.get(node.itemId)} label={itemName(node.itemId)} size={24} />
                <span>
                  <strong>{item?.name ?? node.itemId}</strong>
                  <small>{recipeLabel(node.recipeId ? dspData.recipeById.get(node.recipeId) : undefined)}</small>
                </span>
              </span>
              <span>{formatRate(node.ratePerMinute)}</span>
              <span>{machine ? `${formatCount(node.machineCount)} ${machine.name}` : formatCount(node.machineCount)}</span>
              <span>{formatCount(node.beltLanes)} lanes</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

interface GraphLayoutNode {
  node: PlannerNode
  x: number
  y: number
}

interface GraphLayoutEdge {
  id: string
  from: GraphLayoutNode
  to: GraphLayoutNode
}

interface GraphPoint {
  x: number
  y: number
}

const graphNodeWidth = 146
const graphNodeHeight = 62
const graphColumnGap = 166
const graphRowGap = 78
const graphPadding = 18
const graphMaxColumns = 6
const graphMinZoom = 0.55
const graphMaxZoom = 1.9
const graphZoomStep = 0.1

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function buildGraphLayout(nodes: PlannerNode[]) {
  const visibleNodes = nodes.filter((node) => node.machineCount > 0 || node.warning).slice(0, 32)
  const maxColumn = Math.min(
    graphMaxColumns,
    visibleNodes.reduce((max, node) => Math.max(max, node.depth), 0),
  )
  const rowsByColumn = new Map<number, number>()
  const layoutNodes: GraphLayoutNode[] = visibleNodes.map((node) => {
    const column = maxColumn - Math.min(node.depth, maxColumn)
    const row = rowsByColumn.get(column) ?? 0
    rowsByColumn.set(column, row + 1)
    return {
      node,
      x: graphPadding + column * graphColumnGap,
      y: graphPadding + row * graphRowGap,
    }
  })
  const layoutNodeById = new Map(layoutNodes.map((layoutNode) => [layoutNode.node.id, layoutNode] as const))
  const layoutEdges: GraphLayoutEdge[] = []

  for (const layoutNode of layoutNodes) {
    if (!layoutNode.node.parentNodeId) continue
    const parentLayoutNode = layoutNodeById.get(layoutNode.node.parentNodeId)
    if (!parentLayoutNode) continue
    layoutEdges.push({
      id: `${layoutNode.node.id}-${parentLayoutNode.node.id}`,
      from: layoutNode,
      to: parentLayoutNode,
    })
  }

  const maxRows = Math.max(1, ...rowsByColumn.values())
  return {
    edges: layoutEdges,
    height: Math.max(515, graphPadding * 2 + maxRows * graphRowGap),
    nodes: layoutNodes,
    structureKey: visibleNodes.map((node) => `${node.id}:${node.itemId}:${node.parentNodeId ?? ''}`).join('|'),
    width: graphPadding * 2 + (maxColumn + 1) * graphColumnGap,
  }
}

function ProductionGraph({ nodes }: { nodes: PlannerNode[] }) {
  const graphViewRef = useRef<HTMLDivElement>(null)
  const layout = useMemo(() => buildGraphLayout(nodes), [nodes])
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [nodePositionState, setNodePositionState] = useState<{ positions: Record<string, GraphPoint>; structureKey: string }>({
    positions: {},
    structureKey: '',
  })
  const [zoom, setZoom] = useState(1)

  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  const layoutRef = useRef(layout)
  useEffect(() => {
    layoutRef.current = layout
  }, [layout])

  const nodePositions = useMemo(
    () => (nodePositionState.structureKey === layout.structureKey ? nodePositionState.positions : {}),
    [layout.structureKey, nodePositionState.positions, nodePositionState.structureKey],
  )

  const positionedNodes = useMemo(
    () =>
      layout.nodes.map((layoutNode) => ({
        ...layoutNode,
        ...(nodePositions[layoutNode.node.id] ?? {}),
      })),
    [layout.nodes, nodePositions],
  )
  const positionedNodeById = useMemo(() => new Map(positionedNodes.map((layoutNode) => [layoutNode.node.id, layoutNode] as const)), [positionedNodes])
  const positionedEdges = useMemo(
    () =>
      layout.edges.flatMap((edge) => {
        const from = positionedNodeById.get(edge.from.node.id)
        const to = positionedNodeById.get(edge.to.node.id)
        return from && to ? [{ ...edge, from, to }] : []
      }),
    [layout.edges, positionedNodeById],
  )

  const stageWidth = useMemo(() => {
    const maxNodeX = positionedNodes.reduce((max, n) => Math.max(max, n.x), 0)
    return Math.max(layout.width, maxNodeX + graphNodeWidth + graphPadding)
  }, [layout.width, positionedNodes])

  const stageHeight = useMemo(() => {
    const maxNodeY = positionedNodes.reduce((max, n) => Math.max(max, n.y), 0)
    return Math.max(layout.height, maxNodeY + graphNodeHeight + graphPadding)
  }, [layout.height, positionedNodes])

  useEffect(() => {
    const graphView = graphViewRef.current
    if (!graphView) return

    const handleWheelNative = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()

      const rect = graphView.getBoundingClientRect()
      const pointerX = event.clientX - rect.left
      const pointerY = event.clientY - rect.top
      const scrollX = graphView.scrollLeft + pointerX
      const scrollY = graphView.scrollTop + pointerY
      const direction = event.deltaY < 0 ? 1 : -1

      setZoom((currentZoom) => {
        const nextZoom = clamp(Number((currentZoom + direction * graphZoomStep).toFixed(2)), graphMinZoom, graphMaxZoom)
        if (nextZoom === currentZoom) return currentZoom

        const zoomRatio = nextZoom / currentZoom
        requestAnimationFrame(() => {
          graphView.scrollLeft = scrollX * zoomRatio - pointerX
          graphView.scrollTop = scrollY * zoomRatio - pointerY
        })

        return nextZoom
      })
    }

    graphView.addEventListener('wheel', handleWheelNative, { passive: false })
    return () => {
      graphView.removeEventListener('wheel', handleWheelNative)
    }
  }, [])

  function handleNodePointerDown(event: ReactPointerEvent<HTMLButtonElement>, nodeId: string, startX: number, startY: number) {
    if (event.button !== 0) return

    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Fallback
    }

    const startClientX = event.clientX
    const startClientY = event.clientY

    const handlePointerMove = (e: PointerEvent) => {
      const currentZoom = zoomRef.current
      const currentLayout = layoutRef.current
      const deltaX = (e.clientX - startClientX) / currentZoom
      const deltaY = (e.clientY - startClientY) / currentZoom

      const maxDragX = Math.max(currentLayout.width + 1500, startX)
      const maxDragY = Math.max(currentLayout.height + 1000, startY)
      const nextPosition = {
        x: clamp(startX + deltaX, graphPadding, maxDragX - graphNodeWidth - graphPadding),
        y: clamp(startY + deltaY, graphPadding, maxDragY - graphNodeHeight - graphPadding),
      }

      setNodePositionState((currentPositionState) => {
        const currentPositions = currentPositionState.structureKey === currentLayout.structureKey ? currentPositionState.positions : {}
        return {
          positions: {
            ...currentPositions,
            [nodeId]: nextPosition,
          },
          structureKey: currentLayout.structureKey,
        }
      })
    }

    const handlePointerUp = () => {
      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // ignore
      }

      document.removeEventListener('pointermove', handlePointerMove)
      document.removeEventListener('pointerup', handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)

      setDraggingNodeId(null)
    }

    setDraggingNodeId(nodeId)
    document.addEventListener('pointermove', handlePointerMove)
    document.addEventListener('pointerup', handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
  }

  return (
    <div
      className="graph-view"
      aria-label="Production graph"
      data-dragging={draggingNodeId ?? ''}
      data-zoom={zoom.toFixed(2)}
      ref={graphViewRef}
    >
      <div className="graph-canvas" style={{ width: `${stageWidth * zoom}px`, height: `${stageHeight * zoom}px` }}>
        <div className="graph-stage" style={{ width: `${stageWidth}px`, height: `${stageHeight}px`, transform: `scale(${zoom})` }}>
        <svg className="graph-edges" viewBox={`0 0 ${stageWidth} ${stageHeight}`} aria-hidden="true">
          {positionedEdges.map((edge) => {
            const startX = edge.from.x + graphNodeWidth
            const startY = edge.from.y + graphNodeHeight / 2
            const endX = edge.to.x
            const endY = edge.to.y + graphNodeHeight / 2
            const gradientId = `gradient-${edge.id}`
            return (
              <g key={edge.id}>
                <defs>
                  <linearGradient
                    id={gradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                  >
                    <stop offset="0%" stopColor="rgba(84, 217, 229, 0.18)" />
                    <stop offset="100%" stopColor="rgba(84, 217, 229, 0.58)" />
                  </linearGradient>
                </defs>
                <path
                  d={`M ${startX} ${startY} C ${startX + 42} ${startY}, ${endX - 42} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={`url(#${gradientId})`}
                  strokeWidth="2"
                />
              </g>
            )
          })}
        </svg>
        {positionedNodes.map(({ node, x, y }) => {
          const item = dspData.itemById.get(node.itemId)
          return (
            <button
              key={node.id}
              className={`graph-node ${node.machineCount === 0 ? 'raw' : ''} ${draggingNodeId === node.id ? 'dragging' : ''}`}
              data-depth={node.depth}
              data-item-id={node.itemId}
              data-node-id={node.id}
              data-x={x.toFixed(1)}
              data-y={y.toFixed(1)}
              type="button"
              style={{ transform: `translate(${x}px, ${y}px)` }}
              onPointerDown={(event) => handleNodePointerDown(event, node.id, x, y)}
              onDragStart={(event) => event.preventDefault()}
              title={item?.name ?? node.itemId}
            >
              <IconSprite icon={dspData.iconById.get(node.itemId)} label={itemName(node.itemId)} size={28} />
              <span className="graph-node-copy">
                <strong>{item?.name ?? node.itemId}</strong>
                <small>{formatRate(node.ratePerMinute)}</small>
              </span>
            </button>
          )
        })}
        </div>
      </div>
    </div>
  )
}

function ProductionNode({ node, settings, onOpenRecipe }: { node: PlannerNode; settings: PlannerSettings; onOpenRecipe: (itemId: string) => void }) {
  const item = dspData.itemById.get(node.itemId)
  const machine = node.machineId ? dspData.itemById.get(node.machineId) : undefined
  const recipe = node.recipeId ? dspData.recipeById.get(node.recipeId) : undefined
  const selectedRecipeId = getRecipeOverride(settings, node.itemId)
  const treeOffset = Math.min(node.depth, 6) * 22

  return (
    <button
      className={`chain-node ${node.machineCount === 0 ? 'raw' : ''}`}
      type="button"
      style={{ marginLeft: `${treeOffset}px`, width: `calc(100% - ${treeOffset}px)` }}
      onClick={() => onOpenRecipe(node.itemId)}
    >
      <span className="tree-line" aria-hidden="true" />
      <IconSprite icon={dspData.iconById.get(node.itemId)} label={itemName(node.itemId)} size={30} />
      <span className="node-copy">
        <strong>{item?.name ?? node.itemId}</strong>
        <small>{node.warning ?? recipeLabel(recipe)}</small>
      </span>
      <span className="node-rate">{formatRate(node.ratePerMinute)}</span>
      {machine ? (
        <span className="node-machine">
          <IconSprite icon={dspData.iconById.get(machine.id)} label={machine.name} size={21} />
          {formatCount(node.machineCount)}
        </span>
      ) : null}
      {selectedRecipeId ? <span className="recipe-badge">Alt</span> : null}
    </button>
  )
}

function SettingsPanel({ settings, onSettingsChange }: { settings: PlannerSettings; onSettingsChange: (settings: PlannerSettings) => void }) {
  return (
    <aside className="settings-column">
      <section className="settings-card">
        <div className="settings-heading">
          <h2>Settings</h2>
          <button type="button" onClick={() => onSettingsChange(createDefaultSettings(dspData))}>
            Reset
          </button>
        </div>
        <SelectField
          label="Proliferator"
          value={settings.proliferatorId}
          onChange={(value) => onSettingsChange({ ...settings, proliferatorId: value as PlannerSettings['proliferatorId'] })}
          options={Object.values(proliferators).map((entry) => ({ value: entry.id, label: entry.label }))}
        />
        <SelectField
          label="Belt Tier (Max)"
          value={settings.beltId}
          onChange={(value) => onSettingsChange({ ...settings, beltId: value })}
          options={dspData.belts.map((belt) => ({ value: belt.id, label: belt.name }))}
        />
        <SelectField
          label="Assembler Tier (Max)"
          value={settings.machinePresetId}
          onChange={(value) => onSettingsChange({ ...settings, machinePresetId: value as PlannerSettings['machinePresetId'] })}
          options={Object.values(machinePresets).map((preset) => ({ value: preset.id, label: preset.label }))}
        />
      </section>

      <section className="settings-card alternate-card">
        <h2>Alternate Recipes</h2>
        <div className="toggle-list">
          {alternateRecipeIds.map((recipeId) => {
            const recipe = dspData.recipeById.get(recipeId)
            if (!recipe) return null
            const enabled = !settings.excludedRecipeIds.includes(recipeId)
            return (
              <button key={recipeId} className="toggle-row" type="button" onClick={() => onSettingsChange(toggleExcludedRecipe(settings, recipeId))}>
                <span>{recipe.name}</span>
                <span className={`switch ${enabled ? 'on' : ''}`} aria-hidden="true" />
              </button>
            )
          })}
        </div>
      </section>

      <section className="settings-card options-card">
        <h2>Options</h2>
        <ToggleOption
          checked={settings.reuseBuildings}
          label="Reuse buildings when possible"
          onChange={() => onSettingsChange({ ...settings, reuseBuildings: !settings.reuseBuildings })}
        />
        <ToggleOption
          checked={settings.includeSplitters}
          label="Implement splitters / mergers"
          onChange={() => onSettingsChange({ ...settings, includeSplitters: !settings.includeSplitters })}
        />
        <label className="depth-field">
          <span>Planner maximum level</span>
          <input
            type="number"
            min="12"
            max="160"
            value={settings.maximumDepth}
            onChange={(event) => onSettingsChange({ ...settings, maximumDepth: Number(event.target.value) })}
          />
        </label>
      </section>
    </aside>
  )
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function ToggleOption({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return (
    <button className="option-row" type="button" onClick={onChange}>
      <span className={`check ${checked ? 'checked' : ''}`}>{checked ? '✓' : ''}</span>
      <span>{label}</span>
    </button>
  )
}

interface RecipePickerProps {
  picker: PickerState
  settings: PlannerSettings
  onClose: () => void
  onSelect: (item: Item, recipe?: Recipe) => void
}

function RecipePicker({ picker, settings, onClose, onSelect }: RecipePickerProps) {
  const initialItem = picker.itemId ? dspData.itemById.get(picker.itemId) : undefined
  const [tab, setTab] = useState<PickerTab>(initialItem?.category === 'buildings' ? 'buildings' : 'items')
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const candidates = tab === 'buildings' ? dspData.buildings : dspData.components
  const items = useMemo(() => searchItems(deferredQuery, candidates).slice(0, 112), [candidates, deferredQuery])
  const selectedItem = initialItem ?? items[0] ?? dspData.items[0]
  const recipes = getAvailableRecipes(dspData, selectedItem.id)
  const selectedRecipe = recipes.find((recipe) => recipe.id === getRecipeOverride(settings, selectedItem.id)) ?? recipes[0]

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="recipe-picker-title">
        <button className="modal-close" type="button" aria-label="Close recipe picker" onClick={onClose}>
          <X size={24} />
        </button>
        <h2 id="recipe-picker-title">Select a Recipe</h2>
        <div className="modal-tabs" role="tablist" aria-label="Recipe type">
          <button className={tab === 'items' ? 'active' : ''} type="button" onClick={() => setTab('items')}>
            Items
          </button>
          <button className={tab === 'buildings' ? 'active' : ''} type="button" onClick={() => setTab('buildings')}>
            Buildings
          </button>
        </div>
        <div className="modal-search">
          <Search size={18} />
          <input value={query} placeholder="Search item or building" autoFocus onChange={(event) => setQuery(event.target.value)} />
          <button type="button" aria-label="Recipe filters">
            <SlidersHorizontal size={18} />
          </button>
        </div>
        <div className="icon-grid" aria-label={`${tab} grid`}>
          {items.map((item) => {
            const recipeCount = getAvailableRecipes(dspData, item.id).length
            const isSelected = item.id === selectedItem.id
            return (
              <button
                key={item.id}
                className={`icon-tile ${isSelected ? 'selected' : ''}`}
                type="button"
                title={item.name}
                onClick={() => onSelect(item, getSelectedRecipe(item.id, settings))}
              >
                <IconSprite icon={dspData.iconById.get(item.id)} label={item.name} size={42} />
                {recipeCount > 1 ? <span className="variant-dot">{recipeCount}</span> : null}
              </button>
            )
          })}
        </div>
        <RecipePreview item={selectedItem} recipe={selectedRecipe} onSelect={() => onSelect(selectedItem, selectedRecipe)} />
      </section>
    </div>
  )
}

function RecipePreview({ item, recipe, onSelect }: { item: Item; recipe?: Recipe; onSelect: () => void }) {
  return (
    <footer className="recipe-preview">
      <div className="preview-selected">
        <span>Selected Recipe</span>
        <div>
          <IconSprite icon={dspData.iconById.get(item.id)} label={item.name} size={42} />
          <strong>{item.name}</strong>
        </div>
      </div>
      <FlowPreview title="Inputs" icon={<ArrowDown size={16} />} flows={recipe?.in ?? {}} />
      <FlowPreview title="Output" icon={<ArrowUp size={16} />} flows={recipe?.out ?? { [item.id]: 1 }} />
      <button className="primary-button" type="button" onClick={onSelect}>
        Select Recipe
      </button>
    </footer>
  )
}

function FlowPreview({ title, icon, flows }: { title: string; icon: React.ReactNode; flows: Record<string, number> }) {
  return (
    <div className="flow-preview">
      <span>
        {icon}
        {title}
      </span>
      {Object.entries(flows)
        .slice(0, 3)
        .map(([itemId, amount]) => (
          <div className="flow-row" key={itemId}>
            <IconSprite icon={dspData.iconById.get(itemId)} label={itemName(itemId)} size={22} />
            <span>{itemName(itemId)}</span>
            <strong>{amount}</strong>
          </div>
        ))}
    </div>
  )
}

function searchItems(query: string, items: Item[]) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return items
  const terms = normalizedQuery.split(/\s+/)
  return items.filter((item) => {
    const haystack = `${item.name} ${item.id}`.toLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export default App
