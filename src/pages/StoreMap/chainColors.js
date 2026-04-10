export const CHAIN_COLORS = {
  Foodland:          '#1a6b3c',
  IGA:               '#e53935',
  'Supa IGA':        '#c62828',
  'IGA Local Grocer':'#d81b60',
  FoodWorks:         '#1565c0',
  Drakes:            '#b71c1c',
  Spar:              '#e65100',
  'Farmer Jacks':    '#f57f17',
  'Fresh & Save':    '#00695c',
  Bernardis:         '#6a1b9a',
  Other:             '#546e7a',
}

export function chainColor(chain) {
  return CHAIN_COLORS[chain] || CHAIN_COLORS.Other
}
