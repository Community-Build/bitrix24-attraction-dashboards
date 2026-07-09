import type { PickerOption, ProtoFilterState, ProtoKpi, ProtoScene } from '@/proto/types'

export type ProtoSceneMetadata = Omit<ProtoScene, 'component'>

export const managerOptions: PickerOption[] = [
  { id: '78', label: 'Егоров Андрей', meta: 'Менеджер' },
  { id: '11234', label: 'Ромашова Ольга', meta: 'Менеджер' },
  { id: '7824', label: 'Мусальникова Кристина', meta: 'Менеджер' },
  { id: '6994', label: 'Кузнецова Анастасия', meta: 'Менеджер' },
  { id: '7814', label: 'Дарья Бычкова', meta: 'Менеджер' },
  { id: '72', label: 'Крохалева Мария', meta: 'Менеджер' },
  { id: '2236', label: 'Потапова Мария', meta: 'Менеджер' },
  { id: '2764', label: 'Каньков Вячеслав', meta: 'Менеджер' },
  { id: '13020', label: 'Какулия Илья', meta: 'Менеджер' },
]

export const sourceOptions: PickerOption[] = [
  { id: 'paid-search', label: 'Платный поиск', meta: 'Высокий интент' },
  { id: 'partners', label: 'Партнёры', meta: 'Реферальный поток' },
  { id: 'webinars', label: 'Вебинары', meta: 'Тёплые лиды' },
  { id: 'organic', label: 'Органика', meta: 'Поиск' },
  { id: 'events', label: 'События', meta: 'Оффлайн' },
]

function normalizeDateForInput(date: Date) {
  const normalized = new Date(date)
  normalized.setHours(12, 0, 0, 0)

  return normalized
}

function shiftDate(date: Date, days: number) {
  const shifted = normalizeDateForInput(date)
  shifted.setDate(shifted.getDate() + days)

  return shifted
}

function formatDateInputValue(date: Date) {
  const normalized = normalizeDateForInput(date)
  const year = normalized.getFullYear()
  const month = String(normalized.getMonth() + 1).padStart(2, '0')
  const day = String(normalized.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function startOfCalendarWeek(date: Date) {
  const normalized = normalizeDateForInput(date)
  const daysSinceMonday = (normalized.getDay() + 6) % 7

  return shiftDate(normalized, -daysSinceMonday)
}

export function createDefaultFilters(today = new Date()): ProtoFilterState {
  const currentWeekStart = startOfCalendarWeek(today)
  const previousWeekStart = shiftDate(currentWeekStart, -7)
  const previousWeekEnd = shiftDate(previousWeekStart, 6)

  return {
    rangeStart: formatDateInputValue(previousWeekStart),
    rangeEnd: formatDateInputValue(previousWeekEnd),
    compareRanges: [],
    managers: [],
    sources: [],
    businessClubs: [],
    targetGroups: [],
  }
}

export const defaultFilters: ProtoFilterState = createDefaultFilters()

const activityKpis: ProtoKpi[] = [
  {
    label: 'Создано задач',
    value: '486',
    note: 'за активный диапазон',
    compare: 'пред. период: 441',
    delta: '+10%',
    deltaTone: 'positive',
  },
  {
    label: 'Перенесён дедлайн',
    value: '92',
    note: '19% от всех дел',
    compare: 'пред. период: 104',
    delta: '-12%',
    deltaTone: 'positive',
  },
  {
    label: 'Закрыто задач',
    value: '401',
    note: '82% от созданных',
    compare: 'пред. период: 362',
    delta: '+11%',
    deltaTone: 'positive',
  },
  {
    label: 'Звонков на сделку',
    value: '2.8',
    note: 'среднее по воронке',
    compare: 'пред. период: 2.4',
    delta: '+17%',
    deltaTone: 'positive',
  },
  {
    label: 'Задач на сделку',
    value: '4.6',
    note: 'среднее по воронке',
    compare: 'пред. период: 4.9',
    delta: '-6%',
    deltaTone: 'neutral',
  },
]

export const sceneMetadata: ProtoSceneMetadata[] = [
  {
    id: 'operations',
    label: 'Операционный',
    description: 'Сводка дня: поток, встречи, продажи, SLA и риски по зависшим сделкам.',
    focus: 'Поток / риски / SLA',
    kpis: [],
  },
  {
    id: 'sales',
    label: 'Отчет по продажам',
    description: 'Источники, качество и проход по ключевым этапам после статуса “Готов ко встрече”.',
    focus: 'Продажи / источники / качество',
    kpis: [
      { label: 'Создано сделок', value: '182', note: 'за активный диапазон' },
      { label: 'Готов ко встрече', value: '74', note: '41% от созданных' },
      { label: 'Конверсия в звонок', value: '53%', note: 'из качества в звонок-знакомство' },
      { label: 'Win-rate', value: '18%', note: 'по всей выборке' },
      { label: 'Средний цикл', value: '28 дн.', note: 'успешная сделка' },
    ],
  },
  {
    id: 'sales-plan',
    label: 'План продаж',
    description: 'План продаж по менеджерам и таргет-группам/клубам заказчика.',
    focus: 'План / факт / клубы',
    kpis: [],
  },
  {
    id: 'activities-calls',
    label: 'Отчет активности',
    description: 'Матричная структура по менеджерам и этапам: дела, звонки и переносы дедлайнов.',
    focus: 'Дела / звонки / дисциплина',
    kpis: activityKpis,
  },
  {
    id: 'cohorts',
    label: 'Когортный отчет',
    description: 'Создание сделки по месяцам, закрытие по окнам времени и когортная конверсия.',
    focus: 'Когорты / цикл / закрытие',
    kpis: [
      { label: 'Средняя когортная конверсия', value: '24%', note: 'среднее по когортам за год' },
      { label: 'В 1 месяц', value: '8%', note: 'среднее по когортам за год' },
      { label: 'Во 2 месяц', value: '9%', note: 'среднее по когортам за год' },
      { label: 'В 3 месяц', value: '5%', note: 'среднее по когортам за год' },
      { label: 'В 4+ месяц', value: '2%', note: 'среднее по когортам за год' },
      { label: 'Средний цикл', value: '67 дн.', note: 'среднее по выигранным сделкам за год' },
    ],
  },
  {
    id: 'source-cohorts',
    label: 'Конверсии',
    description: 'Когорта создания сделки по источникам, менеджерам и заказчикам с траекторией стадий и фактических действий.',
    focus: 'Источники / менеджеры / факты',
    kpis: [],
  },
  {
    id: 'revenue-velocity',
    label: 'Денежная скорость',
    description: 'Состояние денежной системы, оперативные действия и когортная эффективность.',
    focus: 'Денежная скорость / действия / клубы',
    kpis: [],
  },
  {
    id: 'unit-economics',
    label: 'Финрезультат',
    description: 'P&L модуля: переменные расходы, EBITDA, Net Profit и экономика источников.',
    focus: 'P&L / расходы / маржа',
    kpis: [],
  },
  {
    id: 'funnel-flow',
    label: 'Движение по воронке',
    description: 'Сколько сделок копится на этапах, какая пропускная способность и где ограничение системы.',
    focus: 'Очередь / throughput / ограничения',
    kpis: [
      {
        label: 'Сделок в работе',
        value: '223',
        note: 'вся очередь на конец периода',
        compare: 'пред. период: 205',
        delta: '+9%',
        deltaTone: 'negative',
      },
      {
        label: 'Выход за период',
        value: '68',
        note: 'через все этапы воронки',
        compare: 'пред. период: 61',
        delta: '+11%',
        deltaTone: 'positive',
      },
      {
        label: 'Главное ограничение',
        value: 'Проблематизация',
        note: 'самый плотный этап',
        compare: '17 сделок в очереди',
      },
      {
        label: 'Средний WIP',
        value: '31',
        note: 'на один активный этап',
        compare: 'пред. период: 28',
        delta: '+3',
        deltaTone: 'negative',
      },
      {
        label: 'Средний цикл этапа',
        value: '9 дн.',
        note: 'по этапам с накоплением',
        compare: 'пред. период: 10 дн.',
        delta: '-1 дн.',
        deltaTone: 'positive',
      },
    ],
  },
]
