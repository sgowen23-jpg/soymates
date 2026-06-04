/**
 * Beiersdorf branded PowerPoint export utility.
 * Loads /bdf-template.pptx, selects the correct slides, injects OOXML tables,
 * and downloads the result. Falls back to plain pptxgenjs if the template fetch fails.
 */

// ── Slide dimensions (EMU) ────────────────────────────────────────────────────

const SLIDE_W   = 12192000
const SLIDE_H   = 6858000
const MARGIN_X  = 457200          // 0.5"
const TABLE_W   = SLIDE_W - 2 * MARGIN_X  // 11277600

const TITLE_Y   = 571500
const TITLE_H   = 600000
const GAP       = 114300          // gap between title and table (or subtitle)
const SUB_H     = 320000          // subtitle box height
const TABLE_Y_PLAIN = TITLE_Y + TITLE_H + GAP              // no subtitle
const TABLE_Y_SUB   = TITLE_Y + TITLE_H + GAP + SUB_H + 60000  // with subtitle

// ── Template hero slide mapping ───────────────────────────────────────────────

const HERO_MAP = {
  'DEODORANTS':     3,
  'SUN CARE':       4,
  'SUNCARE':        4,
  'SKINCARE':       5,
  'FACE CARE':      5,
  'LIP CARE':       7,
  'LIPCARE':        7,
  "MEN'S GROOMING": 8,
  'MENS GROOMING':  8,
  'MEDICINAL':      9,
}

function heroSlideNum(cat) {
  return HERO_MAP[(cat || '').toUpperCase().trim()] ?? 2
}

// ── Per-tier settings ─────────────────────────────────────────────────────────

const TIER = {
  1: {
    columns:   [{ text: 'Category', align: 'l' }, { text: 'Products', align: 'c' }, { text: 'Avg DIS%', align: 'c' }],
    colWidths: [7315200, 1981200, 1981200],
    hdrRowH:   381000,
    sz:        1200,
    dataRowH:  381000,
    pageSize:  Infinity,
  },
  2: {
    columns:   [{ text: 'Product', align: 'l' }, { text: 'DIS%', align: 'c' }, { text: 'Gaps', align: 'c' }],
    colWidths: [8229600, 1524000, 1524000],
    hdrRowH:   330000,
    sz:        (n) => n <= 12 ? 1100 : 900,
    dataRowH:  (n) => n <= 12 ? 330000 : 279400,
    pageSize:  Infinity,
  },
  3: {
    columns:   [{ text: 'Store', align: 'l' }, { text: 'State', align: 'c' }, { text: 'Rep', align: 'l' }, { text: 'Gap', align: 'c' }],
    colWidths: [5300472, 1353312, 3383280, 1240536],
    hdrRowH:   304800,
    sz:        (n) => n <= 20 ? 1000 : 800,
    dataRowH:  (n) => n <= 20 ? 304800 : 228600,
    pageSize:  40,
  },
}

// ── XML helpers ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function removeShapeByName(xml, name) {
  const idx = xml.indexOf(`name="${name}"`)
  if (idx === -1) return xml
  const open  = xml.lastIndexOf('<p:sp>', idx)
  const close = xml.indexOf('</p:sp>', idx)
  if (open === -1 || close === -1) return xml
  return xml.slice(0, open) + xml.slice(close + 7)
}

function injectRunInPlaceholder(xml, phIdx, text) {
  const pos = xml.indexOf(`idx="${phIdx}"`)
  if (pos === -1) return xml
  const endRpr = xml.indexOf('<a:endParaRPr', pos)
  if (endRpr === -1) return xml
  const run = `<a:r><a:rPr lang="en-AU" dirty="0"/><a:t>${esc(text)}</a:t></a:r>`
  return xml.slice(0, endRpr) + run + xml.slice(endRpr)
}

function cleanSlideRels(relsXml) {
  return relsXml.replace(/<Relationship[^>]*Type="[^"]*relationships\/slide"[^>]*\/>/g, '')
}

// ── OOXML builders ────────────────────────────────────────────────────────────

function textShapeXml(id, name, x, y, w, h, text, sz, bold, color, italic = false) {
  return (
    `<p:sp>` +
      `<p:nvSpPr>` +
        `<p:cNvPr id="${id}" name="${name}"/>` +
        `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
        `<p:nvPr/>` +
      `</p:nvSpPr>` +
      `<p:spPr>` +
        `<a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>` +
        `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
        `<a:noFill/><a:ln><a:noFill/></a:ln>` +
      `</p:spPr>` +
      `<p:txBody>` +
        `<a:bodyPr anchor="ctr"/>` +
        `<a:lstStyle/>` +
        `<a:p><a:r>` +
          `<a:rPr lang="en-AU" sz="${sz}" b="${bold ? 1 : 0}" i="${italic ? 1 : 0}" dirty="0">` +
            `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
            `<a:latin typeface="Avenir Next LT Pro Light"/>` +
          `</a:rPr>` +
          `<a:t>${esc(text)}</a:t>` +
        `</a:r></a:p>` +
      `</p:txBody>` +
    `</p:sp>`
  )
}

function cellXml({ text, bold, color, fill, align, sz }) {
  const pPr = (align === 'c' || align === 'center') ? `<a:pPr algn="ctr"/>` : ''
  const ln  = `<a:solidFill><a:srgbClr val="d0d8e4"/></a:solidFill>`
  return (
    `<a:tc>` +
      `<a:txBody>` +
        `<a:bodyPr/>` +
        `<a:lstStyle/>` +
        `<a:p>${pPr}<a:r>` +
          `<a:rPr lang="en-AU" sz="${sz}" b="${bold ? 1 : 0}" dirty="0">` +
            `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>` +
            `<a:latin typeface="Avenir Next LT Pro Light"/>` +
          `</a:rPr>` +
          `<a:t>${esc(text)}</a:t>` +
        `</a:r></a:p>` +
      `</a:txBody>` +
      `<a:tcPr marL="91440" marR="91440" marT="45720" marB="45720">` +
        `<a:lnL w="6350">${ln}</a:lnL>` +
        `<a:lnR w="6350">${ln}</a:lnR>` +
        `<a:lnT w="6350">${ln}</a:lnT>` +
        `<a:lnB w="6350">${ln}</a:lnB>` +
        `<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>` +
      `</a:tcPr>` +
    `</a:tc>`
  )
}

function buildTableXml({ columns, rows, colWidths, hdrRowH, dataRowH, sz, tableY }) {
  const tableH   = hdrRowH + rows.length * dataRowH
  const gridCols = colWidths.map(w => `<a:gridCol w="${w}"/>`).join('')
  const hdrRow   = `<a:tr h="${hdrRowH}">${columns.map(c =>
    cellXml({ text: c.text, bold: true, color: 'FFFFFF', fill: '1a2b5e', align: c.align, sz })
  ).join('')}</a:tr>`
  const dataRows = rows.map((row, ri) => {
    const fill = ri % 2 === 0 ? 'FFFFFF' : 'EEF2F7'
    return `<a:tr h="${dataRowH}">${row.map(cell =>
      cellXml({ text: cell.text, bold: cell.bold ?? false, color: cell.color || '333333', fill, align: cell.align || 'l', sz })
    ).join('')}</a:tr>`
  }).join('')

  return (
    `<p:graphicFrame>` +
      `<p:nvGraphicFramePr>` +
        `<p:cNvPr id="101" name="DataTable"/>` +
        `<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr>` +
        `<p:nvPr/>` +
      `</p:nvGraphicFramePr>` +
      `<p:xfrm>` +
        `<a:off x="${MARGIN_X}" y="${tableY}"/>` +
        `<a:ext cx="${TABLE_W}" cy="${tableH}"/>` +
      `</p:xfrm>` +
      `<a:graphic>` +
        `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">` +
          `<a:tbl>` +
            `<a:tblPr firstRow="1" bandRow="1"><a:noFill/></a:tblPr>` +
            `<a:tblGrid>${gridCols}</a:tblGrid>` +
            hdrRow + dataRows +
          `</a:tbl>` +
        `</a:graphicData>` +
      `</a:graphic>` +
    `</p:graphicFrame>`
  )
}

// ── Slide XML construction ────────────────────────────────────────────────────

function modifyCoverXml(slide1Xml, coverTitle) {
  const monthYear = new Date().toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
  let xml = slide1Xml.replace(/<a:t>June 2026<\/a:t>/, `<a:t>${esc(monthYear)}</a:t>`)
  xml = injectRunInPlaceholder(xml, '10', coverTitle)
  return xml
}

function buildDataSlideXml(slide2Xml, slideTitle, subtitle, tableXml) {
  let xml = removeShapeByName(slide2Xml, 'Text Placeholder 2')
  xml     = removeShapeByName(xml, 'Title 3')

  const tableY    = subtitle ? TABLE_Y_SUB : TABLE_Y_PLAIN
  const titleShape = textShapeXml(100, 'ExportTitle', MARGIN_X, TITLE_Y, TABLE_W, TITLE_H, slideTitle, 1600, true, '1a2b5e')
  const subShape   = subtitle
    ? textShapeXml(102, 'Subtitle', MARGIN_X, TITLE_Y + TITLE_H + GAP, TABLE_W, SUB_H, subtitle, 1000, false, '555555', true)
    : ''
  const tblXml = tableXml(tableY)

  return xml.replace('</p:spTree>', titleShape + subShape + tblXml + '</p:spTree>')
}

// ── Presentation-level XML updates ────────────────────────────────────────────

const SLIDE_REL  = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide'
const SLIDE_CT   = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'

function updatePresXml(presXml, count) {
  const ids = Array.from({ length: count }, (_, i) =>
    `<p:sldId id="${300 + i}" r:id="rId${201 + i}"/>`
  ).join('')
  return presXml.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${ids}</p:sldIdLst>`)
}

function updatePresRels(relsXml, count) {
  const xml = relsXml.replace(/<Relationship[^>]*Type="[^"]*relationships\/slide"[^>]*\/>/g, '')
  const newRels = Array.from({ length: count }, (_, i) =>
    `<Relationship Id="rId${201 + i}" Type="${SLIDE_REL}" Target="slides/slide${i + 1}.xml"/>`
  ).join('')
  return xml.replace('</Relationships>', newRels + '</Relationships>')
}

function updateContentTypes(ctXml, count) {
  const xml = ctXml.replace(/<Override[^>]*PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g, '')
  const overrides = Array.from({ length: count }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="${SLIDE_CT}"/>`
  ).join('')
  return xml.replace('</Types>', overrides + '</Types>')
}

// ── Download ──────────────────────────────────────────────────────────────────

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = fileName; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {1|2|3}    opts.tier
 * @param {string}  [opts.heroCategory]  pog_category name — used to pick hero slide (tiers 2 & 3)
 * @param {string}   opts.slideTitle     title shown on data slides and cover
 * @param {string}  [opts.subtitle]      optional subtitle (tier 3: "X stores are a gap…")
 * @param {string}   opts.fileName
 * @param {{ text:string, color?:string, bold?:boolean, align?:string }[][]} opts.rows
 */
export async function bdfTemplateExport(opts) {
  try {
    const resp = await fetch('/bdf-template.pptx')
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf   = await resp.arrayBuffer()
    const JSZip = (await import('jszip')).default
    const tmpl  = await JSZip.loadAsync(buf)
    await _buildAndDownload(JSZip, tmpl, opts)
  } catch (err) {
    console.error('[bdfTemplateExport] falling back to pptxgenjs:', err)
    await _fallback(opts)
  }
}

async function _buildAndDownload(JSZip, tmpl, opts) {
  const { tier, heroCategory, slideTitle, subtitle, fileName, rows } = opts
  const cfg      = TIER[tier]
  const n        = rows.length
  const sz       = typeof cfg.sz       === 'function' ? cfg.sz(n)       : cfg.sz
  const dataRowH = typeof cfg.dataRowH === 'function' ? cfg.dataRowH(n) : cfg.dataRowH
  const hdrRowH  = cfg.hdrRowH
  const pageSize = cfg.pageSize === Infinity ? Math.max(1, n) : cfg.pageSize

  // Paginate rows
  const pages = []
  for (let i = 0; i < Math.max(1, n); i += pageSize) pages.push(rows.slice(i, i + pageSize))
  const totalPages = pages.length

  const heroNum = (tier === 2 || tier === 3) ? heroSlideNum(heroCategory) : null

  // Read required template files
  const readStr = (p) => tmpl.file(p)?.async('string') ?? Promise.resolve('')
  const [slide1Xml, slide1Rels, slide2Xml, slide2Rels, presXml, presRels, ctXml,
         heroXml, heroRels] = await Promise.all([
    readStr('ppt/slides/slide1.xml'),
    readStr('ppt/slides/_rels/slide1.xml.rels'),
    readStr('ppt/slides/slide2.xml'),
    readStr('ppt/slides/_rels/slide2.xml.rels'),
    readStr('ppt/presentation.xml'),
    readStr('ppt/_rels/presentation.xml.rels'),
    readStr('[Content_Types].xml'),
    heroNum ? readStr(`ppt/slides/slide${heroNum}.xml`)                  : Promise.resolve(null),
    heroNum ? readStr(`ppt/slides/_rels/slide${heroNum}.xml.rels`)       : Promise.resolve(null),
  ])

  // Build ordered slide list
  const outputSlides = []

  // Cover
  outputSlides.push({
    xml:  modifyCoverXml(slide1Xml, slideTitle),
    rels: cleanSlideRels(slide1Rels),
  })

  // Hero (tiers 2 & 3)
  if (heroXml) {
    outputSlides.push({ xml: heroXml, rels: cleanSlideRels(heroRels) })
  }

  // Data slide(s)
  for (let pi = 0; pi < pages.length; pi++) {
    const pageRows  = pages[pi]
    const pageTitle = totalPages > 1 ? `${slideTitle} (${pi + 1} of ${totalPages})` : slideTitle
    const pageSub   = pi === 0 ? (subtitle || null) : null

    // tableXml is a closure that receives the final tableY after subtitle layout is known
    const tblFactory = (tableY) => buildTableXml({
      columns:   cfg.columns,
      rows:      pageRows,
      colWidths: cfg.colWidths,
      hdrRowH,
      dataRowH,
      sz,
      tableY,
    })

    outputSlides.push({
      xml:  buildDataSlideXml(slide2Xml, pageTitle, pageSub, tblFactory),
      rels: slide2Rels,
    })
  }

  // Assemble output zip
  const out = new JSZip()
  const skipSet = new Set([
    'ppt/presentation.xml',
    'ppt/_rels/presentation.xml.rels',
    '[Content_Types].xml',
  ])
  tmpl.forEach((relPath, file) => {
    if (file.dir) return
    if (skipSet.has(relPath)) return
    if (/^ppt\/slides\/slide\d+\.xml$/.test(relPath)) return
    if (/^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/.test(relPath)) return
    out.file(relPath, file.async('uint8array'))
  })

  outputSlides.forEach(({ xml, rels }, i) => {
    out.file(`ppt/slides/slide${i + 1}.xml`, xml)
    out.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, rels)
  })

  out.file('ppt/presentation.xml',            updatePresXml(presXml,   outputSlides.length))
  out.file('ppt/_rels/presentation.xml.rels', updatePresRels(presRels, outputSlides.length))
  out.file('[Content_Types].xml',             updateContentTypes(ctXml, outputSlides.length))

  const blob = await out.generateAsync({
    type:        'blob',
    mimeType:    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    compression: 'DEFLATE',
  })
  triggerDownload(blob, fileName)
}

// ── Fallback: plain pptxgenjs ─────────────────────────────────────────────────

async function _fallback({ tier, slideTitle, subtitle, fileName, rows }) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx      = new PptxGenJS()
  const slide     = pptx.addSlide()
  const DARK      = '1a2b5e'
  const cfg       = TIER[tier]
  const n         = rows.length
  const sz        = (typeof cfg.sz === 'function' ? cfg.sz(n) : cfg.sz) / 100
  const rowH      = (typeof cfg.dataRowH === 'function' ? cfg.dataRowH(n) : cfg.dataRowH) / 914400
  const colW      = cfg.colWidths.map(w => (w / TABLE_W) * 9)

  slide.addText(slideTitle, { x: 0.3, y: 0.2, w: '94%', h: 0.5, fontSize: 15, bold: true, color: DARK })
  if (subtitle) slide.addText(subtitle, { x: 0.3, y: 0.75, w: '94%', h: 0.3, fontSize: 11, italic: true, color: '555555' })

  const headerRow = cfg.columns.map(c => ({
    text: c.text,
    options: { bold: true, fill: { color: DARK }, color: 'FFFFFF', fontSize: sz, align: c.align === 'c' ? 'center' : 'left' },
  }))
  const dataRows = rows.map(row => row.map(cell => ({
    text: cell.text,
    options: { fontSize: sz, bold: cell.bold ?? false, color: cell.color || '333333', align: cell.align === 'c' ? 'center' : 'left' },
  })))

  slide.addTable([headerRow, ...dataRows], {
    x: 0.3, y: subtitle ? 1.15 : 0.85, w: 9, colW, rowH,
    border: { type: 'solid', color: 'e0e0e0', pt: 0.5 },
  })

  pptx.writeFile({ fileName })
}
