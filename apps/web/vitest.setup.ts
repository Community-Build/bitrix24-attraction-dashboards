import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.mock('@hugeicons/react', () => ({
  __esModule: true,
  HugeiconsIcon: () => null,
}))

vi.mock('@hugeicons/core-free-icons', () => {
  const iconNames = [
    'AiSearch02Icon',
    'Alert02Icon',
    'AnalyticsUpIcon',
    'ArrowDown01Icon',
    'ArrowRight01Icon',
    'ArrowUpRight01Icon',
    'Calendar03Icon',
    'Cancel01Icon',
    'ChartHistogramIcon',
    'ChartUpIcon',
    'CheckmarkCircle02Icon',
    'CursorMagicSelection02Icon',
    'InformationCircleIcon',
    'Loading03Icon',
    'MultiplicationSignCircleIcon',
    'Notification03Icon',
    'RefreshIcon',
    'SaleTag02Icon',
    'SearchIcon',
    'SourceCodeCircleIcon',
    'Tick02Icon',
  ]

  return Object.fromEntries([
    ['__esModule', true],
    ...iconNames.map((name) => [name, name]),
  ])
})

class ResizeObserverMock implements ResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

for (const [property, value] of [
  ['clientWidth', 960],
  ['clientHeight', 320],
  ['offsetWidth', 960],
  ['offsetHeight', 320],
] as const) {
  Object.defineProperty(HTMLElement.prototype, property, {
    configurable: true,
    get: () => value,
  })
}
