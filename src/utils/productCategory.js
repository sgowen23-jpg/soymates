const RTD_ITEM_IDS = ['849103', '289772']

export function getProductCategory(itemName, pogCategory = null, itemId = null) {
  if (itemId != null && RTD_ITEM_IDS.includes(String(itemId))) return 'RTD'
  if (pogCategory) {
    if (pogCategory === 'DAIRY - YOGHURTS & DESSERTS')        return 'Yoghurt'
    if (pogCategory === 'DAIRY - SPECIALTY & FLAVOURED MILK') return 'Fresh'
    if (pogCategory === 'BEVERAGES - MILK & CREAM LONG LIFE')
      return itemName && itemName.trimStart().startsWith('*') ? 'UHT Core' : 'UHT'
    return 'Fresh'
  }
  // Regex fallback when pog_category is not available (store_distribution, promo_calendar)
  if (!itemName) return 'Fresh'
  if (/ygt/i.test(itemName))   return 'Yoghurt'
  if (/frsh|esl/i.test(itemName)) return 'Fresh'
  if (itemName.trimStart().startsWith('*') && /uht/i.test(itemName)) return 'UHT Core'
  if (/uht/i.test(itemName))   return 'UHT'
  return 'Fresh'
}
