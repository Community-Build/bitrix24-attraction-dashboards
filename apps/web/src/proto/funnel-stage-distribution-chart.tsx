import type { TocStageDistribution } from '@/proto/types'

export type FunnelStageNodeAnnotation = {
  evidence: string
  timing: string
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value)
}

function formatDistributionPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%'
  }

  if (value < 1) {
    return '<1%'
  }

  return `${Math.round(value)}%`
}

type DistributionStageTone = 'process' | 'success' | 'loss'

function getDistributionStageTone(stage: string): DistributionStageTone {
  if (/контракт|на\s+передаче|передано\s+в\s+клуб|счет|счёт|успеш|won|оплат/i.test(stage)) {
    return 'success'
  }

  if (/корзин|возврат|отказ|проиг|утер|лидген|неквал/i.test(stage)) {
    return 'loss'
  }

  return 'process'
}

function getDistributionToneOrder(stage: string) {
  const tone = getDistributionStageTone(stage)

  if (tone === 'process') {
    return 0
  }

  if (tone === 'success') {
    return 1
  }

  return 2
}

function getDistributionSvgTone(stage: string) {
  const tone = getDistributionStageTone(stage)

  if (tone === 'loss') {
    return {
      accent: '#f97316',
      fill: '#fff7ed',
      ribbon: '#fb923c',
      stroke: '#fed7aa',
    }
  }

  if (tone === 'success') {
    return {
      accent: '#16a34a',
      fill: '#ecfdf5',
      ribbon: '#22c55e',
      stroke: '#bbf7d0',
    }
  }

  return {
    accent: '#2563eb',
    fill: '#eff6ff',
    ribbon: '#2563eb',
    stroke: '#bfdbfe',
  }
}

function splitDistributionStageLabel(value: string) {
  const words = value.trim().split(/\s+/)
  const lines: string[] = []

  for (const word of words) {
    const lastLine = lines.at(-1)
    if (!lastLine) {
      lines.push(word)
      continue
    }

    if (`${lastLine} ${word}`.length <= 21) {
      lines[lines.length - 1] = `${lastLine} ${word}`
    } else if (lines.length < 2) {
      lines.push(word)
    }
  }

  if (lines.length === 0) {
    return ['Без этапа']
  }

  const lastLine = lines[lines.length - 1] ?? ''
  if (lastLine.length > 24) {
    lines[lines.length - 1] = `${lastLine.slice(0, 21)}...`
  }

  return lines.slice(0, 2)
}

function getDistributionTransitionLabel(
  edge: Pick<TocStageDistribution['edges'][number], 'fromStageId' | 'fromStage' | 'toStage'>,
) {
  if (edge.fromStageId === null) {
    return `Старт выборки -> ${edge.toStage}`
  }

  return `${edge.fromStage} -> ${edge.toStage}`
}

function getDistributionStepLabel(step: number, labelKind: 'stage' | 'milestone' = 'stage') {
  if (step === 0) {
    return 'Старт'
  }

  if (labelKind === 'milestone') {
    return `${step}-й шаг`
  }

  return `${step}-й этап`
}

export function FunnelStageDistributionChart({
  distribution,
  title = 'Распределение этапов воронки',
  description = 'Проценты считаются от фактического предыдущего этапа; пропущенные этапы не докидываются.',
  mapLabel = 'Карта маршрутов',
  legendLabel = 'Процент на линии от предыдущего этапа',
  createdLabel = 'Создано',
  ariaLabel = 'Визуальная карта фактических переходов по стадиям воронки',
  stepLabelKind = 'stage',
  nodeAnnotations,
}: {
  distribution: TocStageDistribution
  title?: string
  description?: string
  mapLabel?: string
  legendLabel?: string
  createdLabel?: string
  ariaLabel?: string
  stepLabelKind?: 'stage' | 'milestone'
  nodeAnnotations?: Record<string, FunnelStageNodeAnnotation>
}) {
  const nodes = [...distribution.nodes].sort((left, right) => left.sortOrder - right.sortOrder)
  const nodeById = new Map(nodes.map((node) => [node.stageId, node]))
  const edges = distribution.edges.filter(
    (edge) =>
      nodeById.has(edge.toStageId) &&
      (edge.fromStageId === null || nodeById.has(edge.fromStageId)),
  )
  const hasData = nodes.length > 0 && edges.length > 0

  if (!hasData) {
    return (
      <section className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
              Распределение этапов воронки
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Фактические переходы по созданным сделкам за выбранный период.
            </p>
          </div>
          <span className="badge-chip badge-neutral">ожидает stage-history</span>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5 text-sm text-slate-500">
          API пока не передал фактические переходы между этапами для этого отчета.
        </div>
      </section>
    )
  }

  type StepVisualNode = {
    id: string
    stageId: string | null
    stage: string
    step: number
    count: number
    shareOfCreatedDeals: number
    sortOrder: number
  }
  type StepVisualEdge = {
    id: string
    edge: TocStageDistribution['edges'][number]
    fromVisualId: string
    toVisualId: string
    step: number
  }

  let visualColumns: StepVisualNode[][] = []
  let visualEdgeLinks: StepVisualEdge[] = []
  const routeNodes = distribution.routeNodes ?? []
  const routeEdges = distribution.routeEdges ?? []

  if (routeNodes.length > 0 && routeEdges.length > 0) {
    const routeColumnsByStep = new Map<number, StepVisualNode[]>()
    const routeNodeByKey = new Map<string, StepVisualNode>()

    for (const node of routeNodes) {
      if (!node.stageId || node.count <= 0) {
        continue
      }

      const visualNode: StepVisualNode = {
        id: node.id,
        stageId: node.stageId,
        stage: node.stage,
        step: node.step,
        count: node.count,
        shareOfCreatedDeals: node.shareOfCreatedDeals,
        sortOrder: node.sortOrder,
      }
      const column = routeColumnsByStep.get(node.step) ?? []
      column.push(visualNode)
      routeColumnsByStep.set(node.step, column)
      routeNodeByKey.set(`${node.step}->${node.stageId}`, visualNode)
    }

    visualColumns = Array.from(routeColumnsByStep.entries())
      .sort(([leftStep], [rightStep]) => leftStep - rightStep)
      .map(([, column]) =>
        column.sort((left, right) => {
          const byCount = right.count - left.count
          const byTone = getDistributionToneOrder(left.stage) - getDistributionToneOrder(right.stage)
          return byCount || byTone || left.sortOrder - right.sortOrder || left.stage.localeCompare(right.stage)
        }),
      )

    visualEdgeLinks = routeEdges.flatMap((edge) => {
      const fromNode = routeNodeByKey.get(`${edge.fromStep}->${edge.fromStageId}`)
      const toNode = routeNodeByKey.get(`${edge.toStep}->${edge.toStageId}`)

      if (!fromNode || !toNode) {
        return []
      }

      return [
        {
          id: edge.id,
          edge: {
            id: edge.id,
            fromStageId: edge.fromStageId,
            fromStage: edge.fromStage,
            toStageId: edge.toStageId,
            toStage: edge.toStage,
            count: edge.count,
            conversionRate: edge.conversionRate,
          },
          fromVisualId: fromNode.id,
          toVisualId: toNode.id,
          step: edge.toStep,
        },
      ]
    })
  }

  if (visualColumns.length === 0 || visualEdgeLinks.length === 0) {
    const rootEdges = edges
      .filter((edge) => edge.fromStageId === null)
      .sort((left, right) => {
        const leftStage = nodeById.get(left.toStageId)
        const rightStage = nodeById.get(right.toStageId)

        return right.count - left.count || (leftStage?.sortOrder ?? 0) - (rightStage?.sortOrder ?? 0)
      })
    const outgoingByStage = new Map<string, typeof edges>()
    for (const edge of edges) {
      if (!edge.fromStageId) {
        continue
      }

      const outgoing = outgoingByStage.get(edge.fromStageId) ?? []
      outgoing.push(edge)
      outgoingByStage.set(edge.fromStageId, outgoing)
    }
    const rootAnchorEdge =
      rootEdges.length === 1 &&
      /база|входящ/i.test(rootEdges[0]?.toStage ?? '') &&
      outgoingByStage.has(rootEdges[0]?.toStageId ?? '')
        ? rootEdges[0]
        : null
    const rootNode: StepVisualNode = {
      id: 'step-0-root',
      stageId: rootAnchorEdge?.toStageId ?? null,
      stage: rootAnchorEdge?.toStage ?? 'База входящая',
      step: 0,
      count: rootAnchorEdge?.count ?? distribution.totalCreatedDeals,
      shareOfCreatedDeals: rootAnchorEdge?.conversionRate ?? 100,
      sortOrder: rootAnchorEdge ? nodeById.get(rootAnchorEdge.toStageId)?.sortOrder ?? 0 : 0,
    }

    visualColumns = [[rootNode]]
    visualEdgeLinks = []
    const usedTransitionIds = new Set<string>()
    let previousStepNodes: StepVisualNode[] = [rootNode]
    const maxStepColumns = Math.min(6, nodes.length + 1)

    for (let step = 1; step <= maxStepColumns; step += 1) {
      const stepCandidates: Array<{
        edge: (typeof edges)[number]
        parentNode: StepVisualNode
      }> = []

      if (step === 1) {
        const firstStepEdges = rootAnchorEdge?.toStageId
          ? outgoingByStage.get(rootAnchorEdge.toStageId) ?? []
          : rootEdges

        for (const edge of firstStepEdges) {
          if (usedTransitionIds.has(edge.id)) {
            continue
          }
          stepCandidates.push({ edge, parentNode: rootNode })
        }
      } else {
        for (const parentNode of previousStepNodes) {
          if (!parentNode.stageId) {
            continue
          }

          for (const edge of outgoingByStage.get(parentNode.stageId) ?? []) {
            if (usedTransitionIds.has(edge.id)) {
              continue
            }
            stepCandidates.push({ edge, parentNode })
          }
        }
      }

      if (stepCandidates.length === 0) {
        break
      }

      const stepGroups = new Map<
        string,
        {
          count: number
          incoming: typeof stepCandidates
        }
      >()
      for (const candidate of stepCandidates) {
        const group = stepGroups.get(candidate.edge.toStageId) ?? {
          count: 0,
          incoming: [],
        }
        group.count += candidate.edge.count
        group.incoming.push(candidate)
        stepGroups.set(candidate.edge.toStageId, group)
      }

      const stepNodes = Array.from(stepGroups.entries())
        .map(([stageId, group]) => {
          const stageNode = nodeById.get(stageId)
          return {
            id: `step-${step}-${stageId}`,
            stageId,
            stage: stageNode?.stage ?? group.incoming[0]?.edge.toStage ?? stageId,
            step,
            count: group.count,
            shareOfCreatedDeals:
              distribution.totalCreatedDeals > 0 ? (group.count / distribution.totalCreatedDeals) * 100 : 0,
            sortOrder: stageNode?.sortOrder ?? step,
          } satisfies StepVisualNode
        })
        .sort((left, right) => {
          const byCount = right.count - left.count
          const byTone = getDistributionToneOrder(left.stage) - getDistributionToneOrder(right.stage)
          return byCount || byTone || left.sortOrder - right.sortOrder || left.stage.localeCompare(right.stage)
        })

      if (stepNodes.length === 0) {
        break
      }

      visualColumns.push(stepNodes)
      const stepNodeByStageId = new Map(stepNodes.map((stepNode) => [stepNode.stageId, stepNode]))
      for (const [stageId, group] of stepGroups.entries()) {
        const toNode = stepNodeByStageId.get(stageId)
        if (!toNode) {
          continue
        }

        for (const incoming of group.incoming) {
          if (usedTransitionIds.has(incoming.edge.id)) {
            continue
          }

          usedTransitionIds.add(incoming.edge.id)
          visualEdgeLinks.push({
            id: `step-${step}-${incoming.parentNode.id}-${incoming.edge.id}`,
            edge: incoming.edge,
            fromVisualId: incoming.parentNode.id,
            toVisualId: toNode.id,
            step,
          })
        }
      }

      previousStepNodes = stepNodes
    }
  }

  const hasNodeAnnotations = Boolean(nodeAnnotations)
  const nodeWidth = hasNodeAnnotations ? 206 : 178
  const nodeHeight = hasNodeAnnotations ? 116 : 92
  const columnGap = hasNodeAnnotations ? 174 : 190
  const rowGap = 58
  const paddingX = 50
  const columnTopY = 82
  const chartBottomPadding = 56
  const maxRows = Math.max(...visualColumns.map((column) => column.length), 1)
  const chartWidth =
    paddingX * 2 + visualColumns.length * nodeWidth + (visualColumns.length - 1) * columnGap
  const chartHeight = Math.max(
    430,
    columnTopY + maxRows * nodeHeight + (maxRows - 1) * rowGap + chartBottomPadding,
  )
  const layoutNodes = new Map<
    string,
    StepVisualNode & { x: number; y: number; width: number; height: number }
  >()

  visualColumns.forEach((columnNodes, columnIndex) => {
    const firstStepHeight =
      (visualColumns[1]?.length ?? 0) > 0
        ? (visualColumns[1]?.length ?? 0) * nodeHeight +
          ((visualColumns[1]?.length ?? 1) - 1) * rowGap
        : nodeHeight
    const startY =
      columnIndex === 0
        ? columnTopY + Math.min(180, Math.max(0, (firstStepHeight - nodeHeight) / 2))
        : columnTopY

    columnNodes.forEach((node, index) => {
      layoutNodes.set(node.id, {
        ...node,
        x: paddingX + columnIndex * (nodeWidth + columnGap),
        y: startY + index * (nodeHeight + rowGap),
        width: nodeWidth,
        height: nodeHeight,
      })
    })
  })

  const maxEdgeCount = Math.max(...visualEdgeLinks.map((link) => link.edge.count), 1)
  const visualEdges = visualEdgeLinks.flatMap((link) => {
    const fromNode = layoutNodes.get(link.fromVisualId)
    const toNode = layoutNodes.get(link.toVisualId)
    if (!fromNode || !toNode) {
      return []
    }

    const fromX = fromNode.x + fromNode.width
    const fromY = fromNode.y + fromNode.height / 2
    const toX = toNode.x
    const toY = toNode.y + toNode.height / 2
    const curve = Math.max(84, Math.abs(toX - fromX) * 0.5)

    return [
      {
        edge: link.edge,
        fromX,
        fromY,
        labelX: fromX + (toX - fromX) * 0.54,
        labelY: fromY + (toY - fromY) * 0.54,
        path: [
          `M ${fromX} ${fromY}`,
          `C ${fromX + curve} ${fromY}`,
          `${toX - curve} ${toY}`,
          `${toX} ${toY}`,
        ].join(' '),
        strokeWidth: Math.max(5, Math.min(24, (link.edge.count / maxEdgeCount) * 24)),
        toNode,
      },
    ]
  })
  const drawnEdges = [...visualEdges].sort((left, right) => right.edge.count - left.edge.count)
  const labeledEdges = visualEdges

  return (
    <section className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-600">
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1">
            <span className="inline-flex h-2.5 w-8 rounded-full bg-blue-600" />
            {legendLabel}
          </span>
          <span className="rounded-full bg-white px-3 py-1">
            {createdLabel}: {formatNumber(distribution.totalCreatedDeals)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <p className="subtle-label">{mapLabel}</p>
          <p className="text-xs font-semibold text-slate-500">
            {formatNumber(nodes.length)} этапов · {formatNumber(edges.length)} переходов
          </p>
        </div>
        <div className="overflow-x-auto">
          <svg
            role="img"
            aria-label={ariaLabel}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="block min-w-[920px]"
            style={{ width: chartWidth, height: chartHeight }}
          >
            <title>{ariaLabel}</title>
            <defs>
              <filter id="stage-distribution-node-shadow" x="-18%" y="-22%" width="136%" height="150%">
                <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.12" />
              </filter>
            </defs>

            {visualColumns.map((column, columnIndex) => {
              const x = paddingX + columnIndex * (nodeWidth + columnGap)
              return (
                <g key={`column-${columnIndex}`}>
                  <line
                    x1={x + nodeWidth / 2}
                    y1="36"
                    x2={x + nodeWidth / 2}
                    y2={chartHeight - 18}
                    stroke="#e2e8f0"
                    strokeDasharray="4 12"
                    strokeWidth="1"
                  />
                  <text x={x} y="24" fontSize="12" fontWeight="800" fill="#64748b">
                    {getDistributionStepLabel(column[0]?.step ?? columnIndex, stepLabelKind)}
                  </text>
                </g>
              )
            })}

            {drawnEdges.map((visualEdge) => {
              const tone = getDistributionSvgTone(visualEdge.edge.toStage)
              return (
                <path
                  key={`path-${visualEdge.edge.id}`}
                  d={visualEdge.path}
                  fill="none"
                  stroke={tone.ribbon}
                  strokeLinecap="round"
                  strokeOpacity={visualEdge.edge.fromStageId === null ? 0.2 : 0.28}
                  strokeWidth={visualEdge.strokeWidth}
                />
              )
            })}

            {labeledEdges.map((visualEdge, index) => {
              const tone = getDistributionSvgTone(visualEdge.edge.toStage)
              const label = formatDistributionPercent(visualEdge.edge.conversionRate)
              const labelWidth = Math.max(42, label.length * 9 + 18)
              const offsetY = ((index % 5) - 2) * 13

              return (
                <g
                  key={`label-${visualEdge.edge.id}`}
                  transform={`translate(${visualEdge.labelX - labelWidth / 2} ${visualEdge.labelY - 13 + offsetY})`}
                >
                  <rect
                    width={labelWidth}
                    height="24"
                    rx="12"
                    fill="#ffffff"
                    stroke={tone.stroke}
                    strokeWidth="1"
                  />
                  <text
                    x={labelWidth / 2}
                    y="16"
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight="800"
                    fill={tone.accent}
                  >
                    {label}
                  </text>
                </g>
              )
            })}

            {Array.from(layoutNodes.values()).map((node) => {
              const tone = getDistributionSvgTone(node.stage)
              const labelLines = splitDistributionStageLabel(node.stage)
              const annotation = node.stageId ? nodeAnnotations?.[node.stageId] : undefined
              const percentY = labelLines.length > 1 ? 61 : 57
              const progressY = annotation ? 96 : 74

              return (
                <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                  <rect
                    width={node.width}
                    height={node.height}
                    rx="16"
                    fill={tone.fill}
                    stroke={tone.stroke}
                    strokeWidth="1.5"
                    filter="url(#stage-distribution-node-shadow)"
                  />
                  <rect x="14" y={progressY} width={node.width - 28} height="4" rx="2" fill="#ffffff" />
                  <rect
                    x="14"
                    y={progressY}
                    width={(node.width - 28) * Math.max(0, Math.min(100, node.shareOfCreatedDeals)) / 100}
                    height="4"
                    rx="2"
                    fill={tone.accent}
                  />
                  {labelLines.map((line, index) => (
                    <text
                      key={`${node.id}-${line}`}
                      x="14"
                      y={24 + index * 15}
                      fontSize="12"
                      fontWeight="800"
                      fill="#0f172a"
                    >
                      {line}
                    </text>
                  ))}
                  <text x="14" y={percentY} fontSize="25" fontWeight="900" fill="#0f172a">
                    {formatDistributionPercent(node.shareOfCreatedDeals)}
                  </text>
                  <text x="88" y={percentY - 2} fontSize="11" fontWeight="800" fill="#64748b">
                    {formatNumber(node.count)} сдел.
                  </text>
                  {annotation ? (
                    <>
                      <text x="14" y="77" fontSize="10.5" fontWeight="700" fill="#475569">
                        {annotation.evidence}
                      </text>
                      <text x="14" y="90" fontSize="10.5" fontWeight="700" fill="#64748b">
                        {annotation.timing}
                      </text>
                    </>
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      <ul className="sr-only">
        {visualEdgeLinks.map((link) => (
          <li key={`route-text-${link.id}`}>
            {getDistributionTransitionLabel(link.edge)}: {formatDistributionPercent(link.edge.conversionRate)} ·{' '}
            {formatNumber(link.edge.count)} сдел.
          </li>
        ))}
      </ul>
    </section>
  )
}
