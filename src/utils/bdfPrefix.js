// Beiersdorf item-name ranging markers.
//
// Two formats exist in the data:
//   Old (pre Jul-2026 exports):  "( S / M ) NIVEA BODY LOTION..."
//   New (CSV pipeline):          "**SS- *MSL- NIVEA BODY LOTION..."
// S / **SS- = Sea Salt range, M / *MSL- = Must Have (MSL) range.
// Items can carry one, both, or neither marker. Both formats must keep
// parsing so historic share snapshots and re-uploaded old files still work.

// One leading new-format marker: "**SS-" or "*MSL-", case-insensitive,
// tolerating spaces between the asterisks, the code, and the dash.
const NEW_MARKER = /^\s*\*{1,2}\s*(SS|MSL)\s*-\s*/i

// Old-format parenthesised prefix, e.g. "( S / M ) ", "( M ) ", "( DEL ) "
const OLD_PREFIX = /^\(\s*([^)]+)\)\s*/

export function parseBdfPrefix(itemName) {
  const name = String(itemName ?? '')

  let isSS = false, isMSL = false, sawNewMarker = false
  let rest = name, m
  while ((m = rest.match(NEW_MARKER))) {
    sawNewMarker = true
    if (m[1].toUpperCase() === 'SS') isSS = true
    else isMSL = true
    rest = rest.slice(m[0].length)
  }
  if (sawNewMarker) return { isSS, isMSL }

  const old = name.match(OLD_PREFIX)
  if (old) {
    const p = old[1].toUpperCase()
    return { isSS: p.includes('S'), isMSL: p.includes('M') }
  }
  return { isSS: false, isMSL: false }
}

export function cleanBdfName(itemName) {
  const name = String(itemName ?? '')

  let rest = name, m, sawNewMarker = false
  while ((m = rest.match(NEW_MARKER))) {
    sawNewMarker = true
    rest = rest.slice(m[0].length)
  }
  if (sawNewMarker) return rest.trim()

  return name.replace(OLD_PREFIX, '').trim()
}
