import { useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type {
  ConversionEventTypeSettingsData,
  ConversionEventTypeSettingsInput,
  DealPricingRuleInput,
  DealPricingSettings,
  ManagerWhitelistSettingsData,
  ManagerWhitelistSettingsInput,
  OperationalThresholdSettings,
  OperationalThresholdSettingsInput,
  UnitEconomicsCalculationMethod,
  UnitEconomicsCostRule,
  UnitEconomicsCostRulesInput,
  UnitEconomicsEventParticipantMode,
  UnitEconomicsSettings,
} from '@/lib/dashboard-types'
import { formatAmount, formatInteger } from '@/lib/formatters'

type ModuleSettingsPanelProps = {
  canEdit: boolean
  pricingSettings?: DealPricingSettings | undefined
  operationalThresholdSettings?: OperationalThresholdSettings | undefined
  conversionEventTypeSettings?: ConversionEventTypeSettingsData | undefined
  unitEconomicsSettings?: UnitEconomicsSettings | undefined
  managerWhitelistSettings?: ManagerWhitelistSettingsData | undefined
  pricingSettingsLoading?: boolean
  pricingSettingsSaving?: boolean
  pricingSettingsSaveError?: string | null
  operationalThresholdSettingsLoading?: boolean
  operationalThresholdSettingsSaving?: boolean
  operationalThresholdSettingsSaveError?: string | null
  conversionEventTypeSettingsLoading?: boolean
  conversionEventTypeSettingsSaving?: boolean
  conversionEventTypeSettingsSaveError?: string | null
  unitEconomicsSettingsLoading?: boolean
  unitEconomicsSettingsSaving?: boolean
  unitEconomicsSettingsSaveError?: string | null
  managerWhitelistSettingsLoading?: boolean
  managerWhitelistSettingsSaving?: boolean
  managerWhitelistSettingsSaveError?: string | null
  managerWhitelistSettingsNotice?: string | null
  onPricingSettingsSave?: (rows: DealPricingRuleInput[]) => Promise<void>
  onOperationalThresholdSettingsSave?: (
    input: OperationalThresholdSettingsInput,
  ) => Promise<void>
  onConversionEventTypeSettingsSave?: (
    input: ConversionEventTypeSettingsInput,
  ) => Promise<void>
  onUnitEconomicsCostRulesSave?: (
    input: UnitEconomicsCostRulesInput,
  ) => Promise<void>
  onManagerWhitelistSettingsSave?: (
    input: ManagerWhitelistSettingsInput,
  ) => Promise<void>
  managerWhitelistDraft?: ManagerWhitelistDraftState
  onManagerWhitelistDraftChange?: Dispatch<SetStateAction<ManagerWhitelistDraftState>>
}

export type ManagerTeamOption = {
  id: string
  name: string
  sortOrder: number
}

export type ManagerWhitelistDraftState = {
  managerIds: string[] | null
  managerTeamIds: Record<string, string> | null
  managerTeamOptions: ManagerTeamOption[] | null
  isCreatingManagerTeam: boolean
  newManagerTeamName: string
}

export function createEmptyManagerWhitelistDraftState(): ManagerWhitelistDraftState {
  return {
    managerIds: null,
    managerTeamIds: null,
    managerTeamOptions: null,
    isCreatingManagerTeam: false,
    newManagerTeamName: '',
  }
}

const PNL_LEVEL_LABELS: Record<string, string> = {
  variable_contribution: 'Себестоимость производства',
  above_ebitda: 'Прямые расходы',
  below_ebitda: 'Налоги и финсервис',
}

const CALCULATION_METHOD_LABELS: Record<UnitEconomicsCalculationMethod, string> = {
  manual_amount: 'Сумма',
  percent_of_module_revenue: '% от выручки',
  percent_of_sale: '% от продажи',
  percent_of_club_membership: '% от членства',
  amount_per_lead: 'На лид',
  amount_per_participant: 'На участника',
  amount_per_contract: 'На won-сделку',
  amount_per_event: 'На мероприятие',
  amount_per_period: 'За период',
  imported_fact: 'Факт',
}

function getEnabledWhitelistManagerIds(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
) {
  return (managerWhitelistSettings?.settings ?? [])
    .filter((setting) => setting.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((setting) => setting.managerId)
}

function getManagerTeamIds(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
) {
  return Object.fromEntries(
    (managerWhitelistSettings?.settings ?? []).map((setting) => {
      const teamName = setting.teamName?.trim() ?? ''
      const teamId = setting.teamId?.trim() || teamName

      return [setting.managerId, teamId]
    }),
  )
}

function getManagerTeamOptions(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
): ManagerTeamOption[] {
  const teams = new Map<string, ManagerTeamOption>()

  for (const team of managerWhitelistSettings?.teams ?? []) {
    const id = team.id.trim()
    const name = team.name.trim()
    if (!id || !name) {
      continue
    }

    teams.set(id, { id, name, sortOrder: team.sortOrder })
  }

  for (const setting of managerWhitelistSettings?.settings ?? []) {
    const name = setting.teamName?.trim() ?? ''
    const id = setting.teamId?.trim() || name
    if (!id || !name || teams.has(id)) {
      continue
    }

    teams.set(id, { id, name, sortOrder: setting.sortOrder })
  }

  return Array.from(teams.values())
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

function buildManagerTeamSettingsInput(
  managerIds: string[],
  teamIdsByManagerId: Record<string, string>,
  teamOptions: ManagerTeamOption[],
) {
  const optionById = new Map(teamOptions.map((team) => [team.id, team]))
  const teams = new Map<string, { id: string; name: string; managerIds: string[] }>()

  for (const managerId of managerIds) {
    const teamId = (teamIdsByManagerId[managerId] ?? '').trim()
    if (!teamId) {
      continue
    }

    const option = optionById.get(teamId)
    if (!option) {
      continue
    }

    const team = teams.get(option.id)
    if (team) {
      team.managerIds.push(managerId)
    } else {
      teams.set(option.id, {
        id: option.id,
        name: option.name,
        managerIds: [managerId],
      })
    }
  }

  return Array.from(teams.values()).map((team) => ({
    id: team.id,
    name: team.name,
    managerIds: team.managerIds,
  }))
}

function normalizeManagerTeamOptionKey(value: string) {
  return value.trim().toLocaleLowerCase('ru-RU')
}

function createDraftManagerTeamId(name: string, options: ManagerTeamOption[]) {
  const existingIds = new Set(options.map((option) => option.id))
  if (!existingIds.has(name)) {
    return name
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${name}-${index}`
    if (!existingIds.has(candidate)) {
      return candidate
    }
  }

  return `${name}-${Date.now()}`
}

function ManagerTeamPicker({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: ManagerTeamOption[]
  disabled: boolean
  onChange: (teamId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedTeam = options.find((option) => option.id === value)
  const summary = selectedTeam?.name ?? 'Без команды'

  function selectTeam(teamId: string) {
    onChange(teamId)
    setOpen(false)
  }

  return (
    <div className="grid gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
      <span>Команда</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="field flex h-9 items-center justify-between text-left text-sm normal-case tracking-normal"
            aria-label={label}
            disabled={disabled}
          >
            <span className="truncate">{summary}</span>
            <span className="text-slate-400">{open ? '−' : '+'}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={8}
          className="proto-select-popover w-[var(--radix-popover-trigger-width)] rounded-xl p-2"
        >
          <Command className="proto-select-command">
            <CommandInput placeholder="Поиск команды" />
            <CommandList className="proto-select-list">
              <CommandEmpty>Ничего не найдено</CommandEmpty>
              <CommandGroup heading="Команда">
                <CommandItem
                  value="Без команды"
                  data-checked={!value}
                  className="cursor-pointer"
                  onSelect={() => selectTeam('')}
                >
                  <div className="flex min-w-0 flex-col">
                    <strong className="truncate text-sm">Без команды</strong>
                    <span className="truncate text-xs text-slate-500">Не входит в команду</span>
                  </div>
                </CommandItem>
                {options.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.name} ${option.id}`}
                    data-checked={value === option.id}
                    className="cursor-pointer"
                    onSelect={() => selectTeam(option.id)}
                  >
                    <div className="flex min-w-0 flex-col">
                      <strong className="truncate text-sm">{option.name}</strong>
                      <span className="truncate text-xs text-slate-500">{option.id}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function buildManagerWhitelistRows(
  managerWhitelistSettings: ManagerWhitelistSettingsData | undefined,
) {
  const settings = managerWhitelistSettings?.settings ?? []
  const options = managerWhitelistSettings?.options ?? []
  const settingById = new Map(settings.map((setting) => [setting.managerId, setting]))
  const optionById = new Map(options.map((option) => [option.id, option]))
  const ids = new Set([...options.map((option) => option.id), ...settings.map((setting) => setting.managerId)])

  return Array.from(ids)
    .map((id, index) => {
      const setting = settingById.get(id)
      const option = optionById.get(id)

      return {
        id,
        name: option?.name ?? setting?.managerName ?? id,
        sortOrder: setting?.sortOrder ?? index * 10,
        teamName: setting?.teamName ?? '',
      }
    })
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
}

type OperationalThresholdDraftEdits = {
  stageAging: Record<string, number>
  noCallsMaxDays?: number
  noActivityMaxDays?: number
  sla1?: number
  sla2?: number
  sla3?: number
}

function toOperationalDraftInteger(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
}

function toOperationalSavedInteger(value: number) {
  return Math.max(1, Math.round(value) || 1)
}

function isPercentUnitEconomicsRule(rule: UnitEconomicsCostRule) {
  return (
    rule.calculationMethod === 'percent_of_module_revenue' ||
    rule.calculationMethod === 'percent_of_sale' ||
    rule.calculationMethod === 'percent_of_club_membership'
  )
}

function isAmountUnitEconomicsRule(rule: UnitEconomicsCostRule) {
  return (
    rule.calculationMethod === 'manual_amount' ||
    rule.calculationMethod === 'amount_per_period'
  )
}

function getUnitEconomicsRuleValue(rule: UnitEconomicsCostRule) {
  if (isPercentUnitEconomicsRule(rule)) {
    return rule.percent ?? 0
  }

  if (isAmountUnitEconomicsRule(rule)) {
    return rule.amount ?? rule.unitPrice ?? 0
  }

  return rule.unitPrice ?? 0
}

function buildUnitEconomicsValuePatch(
  rule: UnitEconomicsCostRule,
  value: number,
): Partial<UnitEconomicsCostRule> {
  if (isPercentUnitEconomicsRule(rule)) {
    return { percent: value, unitPrice: null, amount: null }
  }

  if (isAmountUnitEconomicsRule(rule)) {
    return { amount: value, unitPrice: null, percent: null }
  }

  return { unitPrice: value, amount: null, percent: null }
}

function getUnitEconomicsEventScope(
  rule: UnitEconomicsCostRule,
  eventNamePattern: string,
) {
  if (
    rule.calculationMethod !== 'amount_per_participant' ||
    (rule.articleId !== 'demo_events' && rule.articleId !== 'ambassador_activities')
  ) {
    return null
  }

  return eventNamePattern
    ? `Событие: ${eventNamePattern}`
    : 'Все остальные конверсионные мероприятия'
}

export function ModuleSettingsPanel({
  canEdit,
  pricingSettings,
  operationalThresholdSettings,
  conversionEventTypeSettings,
  unitEconomicsSettings,
  managerWhitelistSettings,
  pricingSettingsLoading = false,
  pricingSettingsSaving = false,
  pricingSettingsSaveError = null,
  operationalThresholdSettingsLoading = false,
  operationalThresholdSettingsSaving = false,
  operationalThresholdSettingsSaveError = null,
  conversionEventTypeSettingsLoading = false,
  conversionEventTypeSettingsSaving = false,
  conversionEventTypeSettingsSaveError = null,
  unitEconomicsSettingsLoading = false,
  unitEconomicsSettingsSaving = false,
  unitEconomicsSettingsSaveError = null,
  managerWhitelistSettingsLoading = false,
  managerWhitelistSettingsSaving = false,
  managerWhitelistSettingsSaveError = null,
  managerWhitelistSettingsNotice = null,
  onPricingSettingsSave,
  onOperationalThresholdSettingsSave,
  onConversionEventTypeSettingsSave,
  onUnitEconomicsCostRulesSave,
  onManagerWhitelistSettingsSave,
  managerWhitelistDraft,
  onManagerWhitelistDraftChange,
}: ModuleSettingsPanelProps) {
  const [draftPricingEdits, setDraftPricingEdits] = useState<
    Record<string, Partial<Pick<DealPricingRuleInput, 'attractionRevenueAmount' | 'enabled'>>>
  >({})
  const draftPricingRows = useMemo(
    () =>
      (pricingSettings?.rules ?? []).map((rule) => ({
        id: rule.id,
        customerLabel: rule.customerLabel,
        tariffLabel: rule.tariffLabel,
        attractionRevenueAmount: rule.attractionRevenueAmount,
        enabled: rule.enabled,
        sortOrder: rule.sortOrder,
        ...(draftPricingEdits[rule.id] ?? {}),
      })),
    [draftPricingEdits, pricingSettings?.rules],
  )
  const totalEnabledAmount = useMemo(
    () =>
      draftPricingRows
        .filter((row) => row.enabled)
        .reduce((total, row) => total + row.attractionRevenueAmount, 0),
    [draftPricingRows],
  )
  const [draftOperationalThresholdEdits, setDraftOperationalThresholdEdits] =
    useState<OperationalThresholdDraftEdits>({ stageAging: {} })
  const draftOperationalStageRows = useMemo(
    () =>
      (operationalThresholdSettings?.stageAging ?? []).map((threshold) => ({
        ...threshold,
        maxDaysOnStage:
          draftOperationalThresholdEdits.stageAging[threshold.stageId] ??
          threshold.maxDaysOnStage,
      })),
    [draftOperationalThresholdEdits.stageAging, operationalThresholdSettings?.stageAging],
  )
  const draftOperationalThresholdValues = {
    noCallsMaxDays:
      draftOperationalThresholdEdits.noCallsMaxDays ??
      operationalThresholdSettings?.noCallsMaxDays ??
      7,
    noActivityMaxDays:
      draftOperationalThresholdEdits.noActivityMaxDays ??
      operationalThresholdSettings?.noActivityMaxDays ??
      5,
    sla1:
      draftOperationalThresholdEdits.sla1 ??
      operationalThresholdSettings?.slaBusinessHours.sla1 ??
      24,
    sla2:
      draftOperationalThresholdEdits.sla2 ??
      operationalThresholdSettings?.slaBusinessHours.sla2 ??
      5,
    sla3:
      draftOperationalThresholdEdits.sla3 ??
      operationalThresholdSettings?.slaBusinessHours.sla3 ??
      72,
  }
  const [draftUnitEconomicsEdits, setDraftUnitEconomicsEdits] = useState<
    Record<string, Partial<UnitEconomicsCostRule>>
  >({})
  const [draftEventParticipantMode, setDraftEventParticipantMode] =
    useState<UnitEconomicsEventParticipantMode | null>(null)
  const selectedEventParticipantMode =
    draftEventParticipantMode ?? unitEconomicsSettings?.eventParticipantMode ?? 'invited'
  const unitEconomicsArticleById = useMemo(
    () =>
      new Map(
        (unitEconomicsSettings?.articles ?? []).map((article) => [
          article.id,
          article,
        ]),
      ),
    [unitEconomicsSettings?.articles],
  )
  const draftUnitEconomicsRows = useMemo(
    () =>
      (unitEconomicsSettings?.rules ?? [])
        .map((rule) => ({
          ...rule,
          ...(draftUnitEconomicsEdits[rule.id] ?? {}),
        }))
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [draftUnitEconomicsEdits, unitEconomicsSettings?.rules],
  )
  const enabledUnitEconomicsRows = draftUnitEconomicsRows.filter((row) => row.enabled)

  const eventTypeOptions = useMemo(
    () => conversionEventTypeSettings?.options ?? [],
    [conversionEventTypeSettings?.options],
  )
  const selectedEventTypeIdsFromSettings = useMemo(
    () =>
      eventTypeOptions
        .filter((option) => option.selectedForPlannedInventory)
        .map((option) => option.id),
    [eventTypeOptions],
  )
  const [draftSelectedEventTypeIds, setDraftSelectedEventTypeIds] = useState<
    string[] | null
  >(null)
  const selectedEventTypeIds =
    draftSelectedEventTypeIds ?? selectedEventTypeIdsFromSettings

  const managerRows = useMemo(
    () => buildManagerWhitelistRows(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const selectedManagerIdsFromSettings = useMemo(
    () => getEnabledWhitelistManagerIds(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const managerTeamIdsFromSettings = useMemo(
    () => getManagerTeamIds(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const managerTeamOptionsFromSettings = useMemo(
    () => getManagerTeamOptions(managerWhitelistSettings),
    [managerWhitelistSettings],
  )
  const [localManagerWhitelistDraft, setLocalManagerWhitelistDraft] = useState(
    createEmptyManagerWhitelistDraftState,
  )
  const managerWhitelistDraftState = managerWhitelistDraft ?? localManagerWhitelistDraft
  const setManagerWhitelistDraftState =
    onManagerWhitelistDraftChange ?? setLocalManagerWhitelistDraft
  const selectedManagerIds =
    managerWhitelistDraftState.managerIds ?? selectedManagerIdsFromSettings
  const managerTeamIds =
    managerWhitelistDraftState.managerTeamIds ?? managerTeamIdsFromSettings
  const managerTeamOptions =
    managerWhitelistDraftState.managerTeamOptions ?? managerTeamOptionsFromSettings
  const { isCreatingManagerTeam, newManagerTeamName } = managerWhitelistDraftState

  function patchManagerWhitelistDraft(patch: Partial<ManagerWhitelistDraftState>) {
    setManagerWhitelistDraftState((current) => ({
      ...current,
      ...patch,
    }))
  }

  function updatePricingRule(
    ruleId: string,
    patch: Partial<Pick<DealPricingRuleInput, 'attractionRevenueAmount' | 'enabled'>>,
  ) {
    if (!canEdit) {
      return
    }

    setDraftPricingEdits((current) => ({
      ...current,
      [ruleId]: {
        ...(current[ruleId] ?? {}),
        ...patch,
      },
    }))
  }

  function updateOperationalStageThreshold(stageId: string, maxDaysOnStage: number) {
    if (!canEdit) {
      return
    }

    setDraftOperationalThresholdEdits((current) => ({
      ...current,
      stageAging: {
        ...current.stageAging,
        [stageId]: toOperationalDraftInteger(maxDaysOnStage),
      },
    }))
  }

  function updateOperationalThresholdValue(
    key: Exclude<keyof OperationalThresholdDraftEdits, 'stageAging'>,
    value: number,
  ) {
    if (!canEdit) {
      return
    }

    setDraftOperationalThresholdEdits((current) => ({
      ...current,
      [key]: toOperationalDraftInteger(value),
    }))
  }

  function buildOperationalThresholdInput(): OperationalThresholdSettingsInput {
    return {
      stageAging: draftOperationalStageRows.map((row) => ({
        stageId: row.stageId,
        maxDaysOnStage: toOperationalSavedInteger(row.maxDaysOnStage),
      })),
      noCallsMaxDays: toOperationalSavedInteger(
        draftOperationalThresholdValues.noCallsMaxDays,
      ),
      noActivityMaxDays: toOperationalSavedInteger(
        draftOperationalThresholdValues.noActivityMaxDays,
      ),
      slaBusinessHours: {
        sla1: toOperationalSavedInteger(draftOperationalThresholdValues.sla1),
        sla2: toOperationalSavedInteger(draftOperationalThresholdValues.sla2),
        sla3: toOperationalSavedInteger(draftOperationalThresholdValues.sla3),
      },
    }
  }

  function updateUnitEconomicsRule(
    ruleId: string,
    patch: Partial<UnitEconomicsCostRule>,
  ) {
    if (!canEdit) {
      return
    }

    setDraftUnitEconomicsEdits((current) => ({
      ...current,
      [ruleId]: {
        ...(current[ruleId] ?? {}),
        ...patch,
      },
    }))
  }

  function toggleEventType(eventTypeId: string) {
    if (!canEdit) {
      return
    }

    setDraftSelectedEventTypeIds((current) => {
      const source = current ?? selectedEventTypeIdsFromSettings

      return source.includes(eventTypeId)
        ? source.filter((id) => id !== eventTypeId)
        : [...source, eventTypeId]
    })
  }

  function toggleManager(managerId: string) {
    if (!canEdit) {
      return
    }

    setManagerWhitelistDraftState((current) => {
      const source = current.managerIds ?? selectedManagerIdsFromSettings

      return {
        ...current,
        managerIds: source.includes(managerId)
          ? source.filter((id) => id !== managerId)
          : [...source, managerId],
      }
    })
  }

  function updateManagerTeamId(managerId: string, teamId: string) {
    if (!canEdit) {
      return
    }

    setManagerWhitelistDraftState((current) => ({
      ...current,
      managerTeamIds: {
        ...(current.managerTeamIds ?? managerTeamIdsFromSettings),
        [managerId]: teamId,
      },
    }))
  }

  function createManagerTeam() {
    if (!canEdit) {
      return
    }

    const teamName = newManagerTeamName.trim()
    if (!teamName) {
      return
    }

    setManagerWhitelistDraftState((current) => {
      const source = current.managerTeamOptions ?? managerTeamOptionsFromSettings
      const normalizedTeamName = teamName.toLocaleLowerCase('ru-RU')
      const exists = source.some(
        (option) => normalizeManagerTeamOptionKey(option.name) === normalizedTeamName,
      )

      return {
        ...current,
        managerTeamOptions: exists
          ? source
          : [
              ...source,
              {
                id: createDraftManagerTeamId(teamName, source),
                name: teamName,
                sortOrder: source.length * 10,
              },
            ],
        newManagerTeamName: '',
        isCreatingManagerTeam: false,
      }
    })
  }

  return (
    <section className="panel grid gap-5 p-5" aria-labelledby="module-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="subtle-label">Настройки модуля</div>
          <h2 id="module-settings-title" className="mt-1 text-xl font-bold text-slate-900">
            Настройки модуля
          </h2>
        </div>
        <span className="badge-chip badge-neutral">
          {canEdit ? 'Редактирование' : 'Только просмотр'}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
          <div className="grid min-w-[42rem] grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.8fr)_10rem_7rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Заказчик</span>
            <span>Тариф</span>
            <span>Доход</span>
            <span>Активно</span>
          </div>

          {pricingSettingsLoading && draftPricingRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Загружаю цены.</div>
          ) : draftPricingRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Правила цен не настроены.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {draftPricingRows.map((row) => (
                <div
                  key={row.id}
                  className="grid min-w-[42rem] grid-cols-[minmax(10rem,1fr)_minmax(9rem,0.8fr)_10rem_7rem] gap-3 px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-950">{row.customerLabel}</div>
                    <div className="truncate text-xs text-slate-500">{row.id}</div>
                  </div>
                  <div className="self-center font-medium text-slate-700">{row.tariffLabel}</div>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    className="field h-10"
                    value={row.attractionRevenueAmount}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updatePricingRule(row.id, {
                        attractionRevenueAmount: Math.max(0, Number(event.target.value) || 0),
                      })
                    }
                    aria-label={`Цена ${row.customerLabel} ${row.tariffLabel}`}
                  />
                  <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      disabled={!canEdit}
                      onChange={(event) => updatePricingRule(row.id, { enabled: event.target.checked })}
                    />
                    Да
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="subtle-label">Правила цен</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {formatAmount(totalEnabledAmount)}
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {formatInteger(draftPricingRows.filter((row) => row.enabled).length)} правил
          </div>
          {pricingSettingsSaveError ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {pricingSettingsSaveError}
            </div>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={pricingSettingsSaving || draftPricingRows.length === 0}
              onClick={() => void onPricingSettingsSave?.(draftPricingRows)}
            >
              {pricingSettingsSaving ? 'Сохранение...' : 'Сохранить цены'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white/80">
          <div className="grid min-w-[34rem] grid-cols-[minmax(11rem,1fr)_10rem_8rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
            <span>Этап</span>
            <span>ID</span>
            <span>Дней</span>
          </div>

          {operationalThresholdSettingsLoading &&
          draftOperationalStageRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Загружаю пороги.</div>
          ) : draftOperationalStageRows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500">Пороги не настроены.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {draftOperationalStageRows.map((row) => (
                <div
                  key={row.stageId}
                  className="grid min-w-[34rem] grid-cols-[minmax(11rem,1fr)_10rem_8rem] gap-3 px-4 py-3 text-sm"
                >
                  <div className="font-semibold text-slate-950">{row.stageName}</div>
                  <div className="self-center truncate text-xs text-slate-500">
                    {row.stageId}
                  </div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="field h-10"
                    value={row.maxDaysOnStage}
                    disabled={!canEdit}
                    onChange={(event) =>
                      updateOperationalStageThreshold(
                        row.stageId,
                        Number(event.target.value),
                      )
                    }
                    aria-label={`Порог этапа ${row.stageName}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="subtle-label">Операционные пороги</div>
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>Без звонков, дней</span>
              <input
                type="number"
                min={1}
                step={1}
                className="field h-10"
                value={draftOperationalThresholdValues.noCallsMaxDays}
                disabled={!canEdit}
                onChange={(event) =>
                  updateOperationalThresholdValue(
                    'noCallsMaxDays',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>Без активностей, дней</span>
              <input
                type="number"
                min={1}
                step={1}
                className="field h-10"
                value={draftOperationalThresholdValues.noActivityMaxDays}
                disabled={!canEdit}
                onChange={(event) =>
                  updateOperationalThresholdValue(
                    'noActivityMaxDays',
                    Number(event.target.value),
                  )
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>SLA1, часов</span>
              <input
                type="number"
                min={1}
                step={1}
                className="field h-10"
                value={draftOperationalThresholdValues.sla1}
                disabled={!canEdit}
                onChange={(event) =>
                  updateOperationalThresholdValue('sla1', Number(event.target.value))
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>SLA2, часов</span>
              <input
                type="number"
                min={1}
                step={1}
                className="field h-10"
                value={draftOperationalThresholdValues.sla2}
                disabled={!canEdit}
                onChange={(event) =>
                  updateOperationalThresholdValue('sla2', Number(event.target.value))
                }
              />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              <span>SLA3, часов</span>
              <input
                type="number"
                min={1}
                step={1}
                className="field h-10"
                value={draftOperationalThresholdValues.sla3}
                disabled={!canEdit}
                onChange={(event) =>
                  updateOperationalThresholdValue('sla3', Number(event.target.value))
                }
              />
            </label>
          </div>
          {operationalThresholdSettingsSaveError ? (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {operationalThresholdSettingsSaveError}
            </div>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary mt-4 w-full"
              disabled={
                operationalThresholdSettingsSaving ||
                draftOperationalStageRows.length === 0
              }
              onClick={() =>
                void onOperationalThresholdSettingsSave?.(
                  buildOperationalThresholdInput(),
                )
              }
            >
              {operationalThresholdSettingsSaving
                ? 'Сохранение...'
                : 'Сохранить пороги'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Расходы и финрезультат
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Правила для закупки лидов, контрактации и операционных статей P&L.
            </p>
          </div>
          <span className="badge-chip badge-neutral">
            {formatInteger(enabledUnitEconomicsRows.length)} активно
          </span>
        </div>

        {unitEconomicsSettingsLoading && draftUnitEconomicsRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Загружаю правила расходов.</div>
        ) : draftUnitEconomicsRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Правила расходов пока не настроены.</div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                Расходы событий
              </span>
              {([
                ['invited', 'Приглашенные'],
                ['attended', 'Дошедшие'],
              ] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={
                    selectedEventParticipantMode === mode
                      ? 'btn btn-primary'
                      : 'btn btn-ghost'
                  }
                  aria-pressed={selectedEventParticipantMode === mode}
                  disabled={!canEdit}
                  onClick={() => setDraftEventParticipantMode(mode)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <div className="grid min-w-[56rem] grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_9rem_10rem_7rem] gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                <span>Статья</span>
                <span>Срез</span>
                <span>Метод</span>
                <span>Значение</span>
                <span>Активно</span>
              </div>
              <div className="divide-y divide-slate-100">
                {draftUnitEconomicsRows.map((row) => {
                  const article = unitEconomicsArticleById.get(row.articleId)
                  const articleName = article?.name ?? row.articleId
                  const eventNamePattern = row.eventNamePattern?.trim() ?? ''
                  const eventScope = getUnitEconomicsEventScope(row, eventNamePattern)
                  const ruleScope = [
                    row.sourceKey,
                    row.qualityValue,
                    eventScope,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const inputLabel = `Расход ${articleName} ${ruleScope}`.trim()

                  return (
                    <div
                      key={row.id}
                      className="grid min-w-[56rem] grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_9rem_10rem_7rem] gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-950">{articleName}</div>
                        <div className="truncate text-xs text-slate-500">
                          {PNL_LEVEL_LABELS[row.pnlLevel] ?? row.pnlLevel}
                        </div>
                      </div>
                      <div className="min-w-0 self-center text-slate-600">
                        {ruleScope || 'Общий модуль'}
                        <div className="truncate text-xs text-slate-500">{row.id}</div>
                        {row.calculationMethod === 'amount_per_participant' ? (
                          <input
                            type="text"
                            className="field mt-2 h-9"
                            value={eventNamePattern}
                            disabled={!canEdit}
                            onChange={(event) =>
                              updateUnitEconomicsRule(row.id, {
                                eventNamePattern:
                                  event.target.value.trim().length > 0
                                    ? event.target.value
                                    : null,
                              })
                            }
                            aria-label={`Паттерн события ${articleName}`}
                            placeholder="Паттерн события"
                          />
                        ) : null}
                      </div>
                      <div className="self-center font-medium text-slate-700">
                        {CALCULATION_METHOD_LABELS[row.calculationMethod]}
                      </div>
                      <input
                        type="number"
                        min={0}
                        step={isPercentUnitEconomicsRule(row) ? 0.1 : 1000}
                        className="field h-10"
                        value={getUnitEconomicsRuleValue(row)}
                        disabled={!canEdit}
                        onChange={(event) => {
                          const value = Math.max(0, Number(event.target.value) || 0)
                          updateUnitEconomicsRule(
                            row.id,
                            buildUnitEconomicsValuePatch(row, value),
                          )
                        }}
                        aria-label={inputLabel}
                      />
                      <label className="flex items-center gap-2 self-center text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          disabled={!canEdit}
                          onChange={(event) =>
                            updateUnitEconomicsRule(row.id, {
                              enabled: event.target.checked,
                            })
                          }
                          aria-label={`Активно ${articleName}`}
                        />
                        Да
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {unitEconomicsSettingsSaveError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {unitEconomicsSettingsSaveError}
          </div>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={unitEconomicsSettingsSaving || draftUnitEconomicsRows.length === 0}
            onClick={() =>
              void onUnitEconomicsCostRulesSave?.({
                rules: draftUnitEconomicsRows,
                eventParticipantMode: selectedEventParticipantMode,
              })
            }
          >
            {unitEconomicsSettingsSaving ? 'Сохранение...' : 'Сохранить расходы'}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Плановые мероприятия
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Типы мероприятий, которые попадают в плановый отчет даже без приглашенных.
            </p>
          </div>
          <span className="badge-chip badge-neutral">
            {formatInteger(selectedEventTypeIds.length)} выбрано
          </span>
        </div>

        {conversionEventTypeSettingsLoading && eventTypeOptions.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Загружаю типы мероприятий.</div>
        ) : eventTypeOptions.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Типы мероприятий пока не загружены.</div>
        ) : (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {eventTypeOptions.map((option) => (
              <label
                key={option.id}
                className="flex min-h-12 items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selectedEventTypeIds.includes(option.id)}
                  disabled={!canEdit}
                  onChange={() => toggleEventType(option.id)}
                />
                <span className="min-w-0">
                  <span className="block font-semibold text-slate-900">{option.title}</span>
                  <span className="block truncate text-xs text-slate-500">{option.id}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {conversionEventTypeSettingsSaveError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {conversionEventTypeSettingsSaveError}
          </div>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={conversionEventTypeSettingsSaving}
            onClick={() =>
              void onConversionEventTypeSettingsSave?.({
                eventTypeIds: selectedEventTypeIds,
              })
            }
          >
            {conversionEventTypeSettingsSaving ? 'Сохранение...' : 'Сохранить мероприятия'}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-500">
              Вайтлист менеджеров
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Эти менеджеры используются в отчетах, фильтрах и привязке сотрудников.
            </p>
          </div>
          <span className="badge-chip badge-neutral">
            {formatInteger(selectedManagerIds.length)} менеджеров
          </span>
        </div>

        {managerWhitelistSettingsLoading && managerRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Загружаю менеджеров.</div>
        ) : managerRows.length === 0 ? (
          <div className="mt-4 text-sm text-slate-500">Вайтлист менеджеров пуст.</div>
        ) : (
          <>
            {canEdit ? (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="subtle-label">Команды</div>
                    <div className="mt-1 text-sm text-slate-600">
                      Создайте команду один раз, затем назначьте менеджеров через список.
                    </div>
                  </div>
                  {!isCreatingManagerTeam ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => patchManagerWhitelistDraft({ isCreatingManagerTeam: true })}
                    >
                      Создать команду
                    </button>
                  ) : null}
                </div>

                {managerTeamOptions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {managerTeamOptions.map((team) => (
                      <span key={team.id} className="badge-chip badge-neutral">
                        {team.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">Команды пока не созданы.</div>
                )}

                {isCreatingManagerTeam ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,18rem)_auto_auto]">
                    <input
                      type="text"
                      className="field h-10"
                      value={newManagerTeamName}
                      onChange={(event) =>
                        patchManagerWhitelistDraft({
                          newManagerTeamName: event.currentTarget.value,
                        })
                      }
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          createManagerTeam()
                        }
                      }}
                      aria-label="Название команды"
                      placeholder="Название команды"
                    />
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!newManagerTeamName.trim()}
                      onClick={createManagerTeam}
                    >
                      Добавить команду
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        patchManagerWhitelistDraft({
                          newManagerTeamName: '',
                          isCreatingManagerTeam: false,
                        })
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {managerRows.map((manager) => (
                <div
                  key={manager.id}
                  className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm"
                >
                  <label className="flex min-h-12 items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedManagerIds.includes(manager.id)}
                      disabled={!canEdit}
                      onChange={() => toggleManager(manager.id)}
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{manager.name}</span>
                      <span className="block truncate text-xs text-slate-500">{manager.id}</span>
                    </span>
                  </label>
                  <ManagerTeamPicker
                    label={`Команда менеджера ${manager.name}`}
                    value={managerTeamIds[manager.id] ?? ''}
                    options={managerTeamOptions}
                    disabled={!canEdit || !selectedManagerIds.includes(manager.id)}
                    onChange={(teamId) => updateManagerTeamId(manager.id, teamId)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        {managerWhitelistSettingsNotice ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {managerWhitelistSettingsNotice}
          </div>
        ) : null}
        {managerWhitelistSettingsSaveError ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {managerWhitelistSettingsSaveError}
          </div>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary mt-4"
            disabled={managerWhitelistSettingsSaving}
            onClick={() =>
              {
                const managerIds = managerRows
                  .filter((manager) => selectedManagerIds.includes(manager.id))
                  .map((manager) => manager.id)

                void onManagerWhitelistSettingsSave?.({
                  managerIds,
                  teams: buildManagerTeamSettingsInput(managerIds, managerTeamIds, managerTeamOptions),
                })
              }
            }
          >
            {managerWhitelistSettingsSaving ? 'Сохранение...' : 'Сохранить менеджеров'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
