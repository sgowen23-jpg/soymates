import { CURRENT_CYCLE } from '../constants'
export const CYCLE_NUMBER = CURRENT_CYCLE

export const CATEGORIES = ['UHT Core', 'UHT Non Core', 'Chilled', 'Yoghurt']

export const TARGET_REPS = [
  'Ashleigh Tasdarian',
  'David Kerr',
  'Dipen Surani',
  'Sam Gowen',
  'Shane Vandewardt',
]

export const DATA = {
  'UHT Core': {
    'Shane Vandewardt':   { stores: 172, current: 1269, gap: 107, baseline: 1203 },
    'Sam Gowen':          { stores: 130, current: 983,  gap: 57,  baseline: 897  },
    'Ashleigh Tasdarian': { stores: 166, current: 1129, gap: 199, baseline: 1055 },
    'David Kerr':         { stores: 175, current: 1276, gap: 124, baseline: 1225 },
    'Dipen Surani':       { stores: 134, current: 1029, gap: 43,  baseline: 978  },
  },
  'UHT Non Core': {
    'Shane Vandewardt':   { stores: 172, current: 636, gap: 224, baseline: 595 },
    'Sam Gowen':          { stores: 130, current: 522, gap: 128, baseline: 468 },
    'Ashleigh Tasdarian': { stores: 166, current: 489, gap: 341, baseline: 430 },
    'David Kerr':         { stores: 175, current: 671, gap: 204, baseline: 623 },
    'Dipen Surani':       { stores: 134, current: 538, gap: 132, baseline: 491 },
  },
  'Chilled': {
    'Shane Vandewardt':   { stores: 172, current: 1354, gap: 1054, baseline: 1341 },
    'Sam Gowen':          { stores: 130, current: 1195, gap: 625,  baseline: 1072 },
    'Ashleigh Tasdarian': { stores: 166, current: 973,  gap: 1351, baseline: 842  },
    'David Kerr':         { stores: 175, current: 1223, gap: 1227, baseline: 1120 },
    'Dipen Surani':       { stores: 134, current: 1022, gap: 854,  baseline: 937  },
  },
  'Yoghurt': {
    'Shane Vandewardt':   { stores: 172, current: 287, gap: 1089, baseline: 280 },
    'Sam Gowen':          { stores: 130, current: 392, gap: 648,  baseline: 393 },
    'Ashleigh Tasdarian': { stores: 166, current: 218, gap: 1110, baseline: 212 },
    'David Kerr':         { stores: 175, current: 227, gap: 1173, baseline: 255 },
    'Dipen Surani':       { stores: 134, current: 74,  gap: 998,  baseline: 95  },
  },
}

export function getCategorySummary(category) {
  const reps = TARGET_REPS
  const current = reps.reduce((s, r) => s + DATA[category][r].current, 0)
  const gap     = reps.reduce((s, r) => s + DATA[category][r].gap, 0)
  const total   = current + gap
  const pct     = total === 0 ? 0 : Math.round((current / total) * 100)
  return { current, gap, total, pct }
}

export function getOverallSummary() {
  const current = CATEGORIES.reduce((s, c) => s + getCategorySummary(c).current, 0)
  const total   = CATEGORIES.reduce((s, c) => s + getCategorySummary(c).total, 0)
  const gap     = total - current
  const pct     = total === 0 ? 0 : Math.round((current / total) * 100)
  return { current, gap, total, pct }
}
