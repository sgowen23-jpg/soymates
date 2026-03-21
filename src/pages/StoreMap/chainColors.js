export const CHAIN_COLORS = {
  Foodland:  '#1a6b3c',
  IGA:       '#e53935',
  FoodWorks: '#1565c0',
  Spar:      '#e65100',
  Bernardis: '#6a1b9a',
  Other:     '#546e7a',
}

export function chainColor(chain) {
  return CHAIN_COLORS[chain] || CHAIN_COLORS.Other
}
