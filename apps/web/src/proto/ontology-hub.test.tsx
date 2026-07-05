import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient } from '@/lib/api-client'
import type { AttractionOntologyResponse } from '@/lib/dashboard-types'
import { OntologyHubScene } from '@/proto/ontology-hub'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getAttractionOntologySourceDocument: vi.fn(),
  },
}))

beforeEach(() => {
  vi.mocked(apiClient.getAttractionOntologySourceDocument).mockReset()
})

function createOntology(
  overrides: Partial<AttractionOntologyResponse> = {},
): AttractionOntologyResponse {
  return {
    moduleKey: 'attraction',
    title: 'Онтология Привлечения',
    governance: {
      decisionRole: 'Технолог бизнес-процессов',
      decisionUnit: 'Центр Технологизации',
    },
    lastReviewedAt: '2026-05-29',
    sources: [
      {
        id: 'module_ontology',
        label: 'MODULE_ONTOLOGY.md',
        kind: 'markdown',
        href: 'docs/modules/attraction/MODULE_ONTOLOGY.md',
        canonicality: 'canonical',
      },
      {
        id: 'regulation_incoming_leads',
        label: 'Регламент обработки входящих лидов',
        kind: 'google-doc',
        href: 'https://docs.google.com/document/d/incoming/edit',
        canonicality: 'supporting',
      },
      {
        id: 'conversion_events_sheet',
        label: 'Конверсионные события',
        kind: 'google-sheet',
        href: 'https://docs.google.com/spreadsheets/d/events/edit',
        canonicality: 'canonical',
      },
    ],
    concepts: [
      {
        id: 'basket',
        type: 'outcome',
        label: 'Корзина',
        status: 'confirmed',
        definition: 'Текущий проигрыш сделки после работы КИ.',
        not: ['возврат поставщику'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-acquisition-outcomes'],
      },
      {
        id: 'warming',
        type: 'outcome',
        label: 'Прогрев',
        status: 'needs-sync',
        definition: 'Отложенная повторная работа по участнику.',
        not: ['корзина'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-acquisition-outcomes'],
      },
      {
        id: 'return_to_lidgen_unqualified',
        type: 'outcome',
        label: 'Возврат в Лидген(неквал)',
        status: 'confirmed',
        definition: 'Возврат поставщику, когда качество не подтверждено.',
        not: ['отказ клиента'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-funnel-flow'],
      },
      {
        id: 'handoff_rejected_by_club',
        type: 'outcome',
        label: 'Отклонено потребителем',
        status: 'confirmed',
        definition: 'Клуб не принял участника на этапе передачи.',
        not: ['отказ клиента'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-acquisition-outcomes'],
      },
      {
        id: 'incoming_base',
        type: 'stage',
        label: 'База входящая',
        status: 'confirmed',
        definition: 'Старт процесса Привлечения.',
        not: ['лидген'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-funnel-flow'],
      },
      {
        id: 'intro_call',
        type: 'stage',
        label: 'Звонок-знакомство',
        status: 'confirmed',
        definition: 'Первый ручной контакт КИ.',
        not: ['автопокупка'],
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-funnel-flow'],
      },
    ],
    transitions: [
      {
        id: 'incoming_to_intro_call_manual',
        label: 'База входящая -> Звонок-знакомство',
        status: 'confirmed',
        fromConceptId: 'incoming_base',
        toConceptId: 'intro_call',
        definition: 'КИ принял карточку в ручную работу.',
        trigger: 'Ручное принятие',
        sourceIds: ['regulation_incoming_leads'],
        reportBindingIds: ['attraction-funnel-flow'],
      },
    ],
    reportBindings: [
      {
        id: 'attraction-funnel-flow',
        label: 'Поток стадий Привлечения',
        sceneId: 'funnel-flow',
        blockId: 'attraction-funnel-flow',
        href: '#attraction-funnel-flow',
      },
      {
        id: 'attraction-acquisition-outcomes',
        label: 'Проигрыши и исходы Привлечения',
        sceneId: 'sales',
        blockId: 'attraction-acquisition-outcomes',
        href: '#attraction-acquisition-outcomes',
      },
      {
        id: 'attraction-ontology-drift',
        label: 'Drift онтологии',
        sceneId: 'ontology',
        blockId: 'attraction-ontology-drift',
        href: '#attraction-ontology-drift',
      },
    ],
    drift: [],
    ...overrides,
  }
}

function createFilters() {
  return {
    rangeStart: '2026-04-01',
    rangeEnd: '2026-04-30',
    compareRanges: [],
    managers: [],
    sources: [],
    businessClubs: [],
    targetGroups: [],
  }
}

describe('OntologyHubScene', () => {
  it('renders governance as role and unit without personal owner names', () => {
    render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: createOntology(),
          operationalStatus: 'ready',
          operationalError: null,
        }}
      />,
    )

    expect(screen.getByText('Технолог бизнес-процессов')).toBeInTheDocument()
    expect(screen.getByText('Центр Технологизации')).toBeInTheDocument()
    expect(screen.queryByText(/Влад/i)).not.toBeInTheDocument()
  })

  it('renders source links, outcome cards, report links, and drift warnings', () => {
    render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: createOntology({
            drift: [
              {
                kind: 'stage',
                severity: 'warning',
                label: 'Новый этап',
                message: 'Bitrix stage не описан в онтологии.',
              },
            ],
          }),
          operationalStatus: 'ready',
          operationalError: null,
        }}
      />,
    )

    const sources = screen.getByTestId('ontology-sources')
    expect(
      within(sources).getByRole('link', { name: /регламент обработки входящих лидов/i }),
    ).toHaveAttribute('href', 'https://docs.google.com/document/d/incoming/edit')
    expect(
      within(sources).getByRole('link', { name: /конверсионные события/i }),
    ).toHaveAttribute('href', 'https://docs.google.com/spreadsheets/d/events/edit')

    const outcomes = screen.getByTestId('ontology-outcomes')
    expect(within(outcomes).getByText('Корзина')).toBeInTheDocument()
    expect(within(outcomes).getByText('Прогрев')).toBeInTheDocument()
    expect(within(outcomes).getByText('Возврат в Лидген(неквал)')).toBeInTheDocument()
    expect(within(outcomes).getByText('Отклонено потребителем')).toBeInTheDocument()

    const reportLinks = screen.getByTestId('ontology-report-links')
    expect(
      within(reportLinks).getByRole('link', { name: /поток стадий привлечения/i }),
    ).toHaveAttribute('href', '#attraction-funnel-flow')
    expect(screen.getByText(/Bitrix stage не описан в онтологии/i)).toBeInTheDocument()
  })

  it('keeps every registry report binding anchored in dashboard source', () => {
    const registry = JSON.parse(
      readFileSync(
        join(
          process.cwd(),
          '../../docs/modules/attraction/ontology/registry/attraction-ontology.json',
        ),
        'utf8',
      ),
    ) as { reportBindings: Array<{ blockId: string }> }
    const sceneSource = readFileSync(join(process.cwd(), 'src/proto/scenes.tsx'), 'utf8')
    const ontologySource = readFileSync(join(process.cwd(), 'src/proto/ontology-hub.tsx'), 'utf8')
    const dashboardSource = `${sceneSource}\n${ontologySource}`

    for (const binding of registry.reportBindings) {
      expect(dashboardSource).toMatch(
        new RegExp(`(?:data-comment-block-id|id)=["']${binding.blockId}["']`),
      )
    }
  })

  it('updates the hash and scrolls when a report link points to an active block', () => {
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    window.history.pushState({}, '', '/')

    try {
      render(
        <OntologyHubScene
          commentMode={false}
          filters={createFilters()}
          runtimeData={{
            managerOptions: [],
            sourceOptions: [],
            attractionOntology: createOntology(),
            operationalStatus: 'ready',
            operationalError: null,
          }}
        />,
      )

      const reportLinks = screen.getByTestId('ontology-report-links')
      fireEvent.click(within(reportLinks).getByRole('link', { name: /drift онтологии/i }))

      expect(window.location.hash).toBe('#attraction-ontology-drift')
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView
    }
  })

  it('navigates to another scene when a report link target is not mounted', () => {
    const onSceneNavigate = vi.fn()
    window.history.pushState({}, '', '/docs/modules/attraction/MODULE_ONTOLOGY.md#stale')

    render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: createOntology(),
          operationalStatus: 'ready',
          operationalError: null,
        }}
        {...({ onSceneNavigate } as Record<string, unknown>)}
      />,
    )

    const reportLinks = screen.getByTestId('ontology-report-links')
    fireEvent.click(
      within(reportLinks).getByRole('link', { name: /поток стадий привлечения/i }),
    )

    expect(onSceneNavigate).toHaveBeenCalledWith(
      'funnel-flow',
      'attraction-funnel-flow',
    )
  })

  it('opens local markdown sources in an internal document reader', async () => {
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = vi.fn()
    vi.mocked(apiClient.getAttractionOntologySourceDocument).mockResolvedValueOnce({
      moduleKey: 'attraction',
      source: {
        id: 'module_ontology',
        label: 'MODULE_ONTOLOGY.md',
        kind: 'markdown',
        href: 'docs/modules/attraction/MODULE_ONTOLOGY.md',
        canonicality: 'canonical',
      },
      content: '# MODULE_ONTOLOGY.md\n\nТекст локального документа.',
    })

    try {
      render(
        <OntologyHubScene
          commentMode={false}
          filters={createFilters()}
          runtimeData={{
            managerOptions: [],
            sourceOptions: [],
            attractionOntology: createOntology(),
            operationalStatus: 'ready',
            operationalError: null,
          }}
        />,
      )

      const sources = screen.getByTestId('ontology-sources')
      fireEvent.click(within(sources).getByRole('button', { name: /module_ontology\.md/i }))

      expect(apiClient.getAttractionOntologySourceDocument).toHaveBeenCalledWith(
        'module_ontology',
      )
      expect(await screen.findByText('Просмотр документа')).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.getByText('Текст локального документа.')).toBeInTheDocument()
      })
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    } finally {
      Element.prototype.scrollIntoView = scrollIntoView
    }
  })

  it('keeps the latest opened local source when an older request resolves later', async () => {
    const baseOntology = createOntology()
    const firstSource = baseOntology.sources[0]
    expect(firstSource).toBeDefined()
    const secondSource = {
      id: 'ontology_state_machine',
      label: '04. Состояния и переходы',
      kind: 'markdown' as const,
      href: 'docs/modules/attraction/ontology/04-state-machine.md',
      canonicality: 'canonical' as const,
    }
    const pendingDocuments = new Map<
      string,
      (document: Awaited<ReturnType<typeof apiClient.getAttractionOntologySourceDocument>>) => void
    >()

    vi.mocked(apiClient.getAttractionOntologySourceDocument).mockImplementation(
      (sourceId) =>
        new Promise((resolve) => {
          pendingDocuments.set(sourceId, resolve)
        }),
    )

    render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: {
            ...baseOntology,
            sources: [...baseOntology.sources, secondSource],
          },
          operationalStatus: 'ready',
          operationalError: null,
        }}
      />,
    )

    const sources = screen.getByTestId('ontology-sources')
    fireEvent.click(within(sources).getByRole('button', { name: /module_ontology\.md/i }))
    fireEvent.click(within(sources).getByRole('button', { name: /состояния и переходы/i }))
    expect(pendingDocuments.has('module_ontology')).toBe(true)
    expect(pendingDocuments.has('ontology_state_machine')).toBe(true)

    await act(async () => {
      pendingDocuments.get('ontology_state_machine')?.({
        moduleKey: 'attraction',
        source: secondSource,
        content: '# Второй документ\n\nАктуальный документ.',
      })
    })

    expect(await screen.findByText('Актуальный документ.')).toBeInTheDocument()

    await act(async () => {
      pendingDocuments.get('module_ontology')?.({
        moduleKey: 'attraction',
        source: firstSource!,
        content: '# Первый документ\n\nУстаревший документ.',
      })
    })

    await waitFor(() => {
      expect(screen.getByText('Актуальный документ.')).toBeInTheDocument()
      expect(screen.queryByText('Устаревший документ.')).not.toBeInTheDocument()
    })
  })

  it('renders markdown pipe tables as readable tables in the document reader', async () => {
    vi.mocked(apiClient.getAttractionOntologySourceDocument).mockResolvedValueOnce({
      moduleKey: 'attraction',
      source: {
        id: 'module_ontology',
        label: 'MODULE_ONTOLOGY.md',
        kind: 'markdown',
        href: 'docs/modules/attraction/MODULE_ONTOLOGY.md',
        canonicality: 'canonical',
      },
      content: [
        '## Слои онтологии',
        '',
        '| Слой | Вопрос | Что фиксируется |',
        '| --- | --- | --- |',
        '| Descriptive layer | Что существует? | Объекты модуля |',
        '| Dynamic layer | Что меняется? | Состояния и переходы |',
      ].join('\n'),
    })

    render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: createOntology(),
          operationalStatus: 'ready',
          operationalError: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /module_ontology\.md/i }))

    const reader = await screen.findByTestId('ontology-source-document-reader')
    const table = await within(reader).findByRole('table')

    expect(within(table).getByRole('columnheader', { name: 'Слой' })).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Вопрос' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Descriptive layer' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Состояния и переходы' })).toBeInTheDocument()
  })

  function renderOntologyScene(ontology: AttractionOntologyResponse = createOntology()) {
    return render(
      <OntologyHubScene
        commentMode={false}
        filters={createFilters()}
        runtimeData={{
          managerOptions: [],
          sourceOptions: [],
          attractionOntology: ontology,
          operationalStatus: 'ready',
          operationalError: null,
        }}
      />,
    )
  }

  it('opens the first process stage in the inspector by default', () => {
    renderOntologyScene()

    const inspector = screen.getByTestId('ontology-inspector')
    expect(within(inspector).getByText('Старт процесса Привлечения.')).toBeInTheDocument()
    expect(within(inspector).getByText('Этап 1 из 2')).toBeInTheDocument()
  })

  it('updates the inspector when a process node is selected on the map', () => {
    renderOntologyScene()

    const processMap = screen.getByTestId('ontology-process-map')
    fireEvent.click(within(processMap).getByRole('button', { name: /Звонок-знакомство/i }))

    const inspector = screen.getByTestId('ontology-inspector')
    expect(within(inspector).getByText('Первый ручной контакт КИ.')).toBeInTheDocument()
    expect(within(inspector).getByText('Этап 2 из 2')).toBeInTheDocument()
  })

  it('selects an outcome from the ledger and shows its disambiguation in the inspector', () => {
    renderOntologyScene()

    const ledger = screen.getByTestId('ontology-outcomes')
    fireEvent.click(within(ledger).getByText('Корзина'))

    const inspector = screen.getByTestId('ontology-inspector')
    expect(
      within(inspector).getByText('Текущий проигрыш сделки после работы КИ.'),
    ).toBeInTheDocument()
    expect(within(inspector).getByText(/возврат поставщику/i)).toBeInTheDocument()
  })

  it('summarizes model trust and counts in the overview', () => {
    renderOntologyScene()

    expect(screen.getByText('Статус модели')).toBeInTheDocument()
    expect(screen.getByText('Концепты')).toBeInTheDocument()
    expect(screen.getByText('5 / 6')).toBeInTheDocument()
    expect(screen.getByText('Расхождений не найдено')).toBeInTheDocument()
  })
})
