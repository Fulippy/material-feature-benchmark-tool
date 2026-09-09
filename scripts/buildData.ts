import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import * as XLSXModule from 'xlsx'

const XLSX = ((XLSXModule as typeof XLSXModule & { default?: typeof XLSXModule }).default ?? XLSXModule)

type Cell = string | number | boolean | null | undefined
type RawRow = Cell[]
type MatchType = 'exact' | 'contains' | 'fuzzy'

type SourceCase = {
  rowNumber: number
  materials: string[]
  productName: string
  description: string
  localImagePath: string
  imageReadable: boolean
}

type OutputCase = {
  productName: string
  description: string
  image: string
  sourceMaterial: string
  matchType: MatchType
}

type OutputMaterial = {
  name: string
  category: string
  min: number
  max: number
  image: string
  images: string[]
  description: string
  cognitiveText: string
  cases: OutputCase[]
}

type MaterialImageSource = {
  materialName: string
  title: string
  sourcePath: string
  isMain: boolean
  rowNumber: number
}

const PROJECT_ROOT = process.cwd()
const REPORT_PATH = path.join(PROJECT_ROOT, 'data_inspection_report.md')
const OUTPUT_DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data')
const OUTPUT_CASE_IMAGE_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'cases')
const OUTPUT_MATERIAL_IMAGE_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'materials')
const PLACEHOLDER_WEB_PATH = '/assets/cases/placeholder.svg'
const MATERIAL_PLACEHOLDER_WEB_PATH = '/assets/materials/placeholder.svg'
const CASE_LIMIT = 20
const MIN_CASE_TARGET = 10

// 已由材料名称复核结果和案例“总”表共同确认的跨表同义名。
// “瓷”是网页最终名称，案例表仍主要使用“陶瓷”。
const VERIFIED_CASE_ALIAS_GROUPS = [
  ['工程瓷', '瓷', '陶瓷'],
]

const parameterMeta: Record<string, {
  id: string
  sheet: string
  definition: string
  designMeaning: string
  iconType: string
}> = {
  密度: {
    id: 'density',
    sheet: 'density_final',
    definition: '密度表示单位体积材料的质量，通常用于判断材料的轻重感。密度越高，在相同体积下材料越重。',
    designMeaning: '帮助设计师理解材料的轻重感、体量感与便携性。',
    iconType: 'density',
  },
  弹性模量: {
    id: 'elastic-modulus',
    sheet: 'elastic_modulus_final',
    definition: '弹性模量表示材料抵抗弹性变形的能力。数值越高，材料通常越刚硬、不易弯曲。',
    designMeaning: '帮助设计师理解材料在受力时的刚硬程度与形变倾向。',
    iconType: 'elastic-modulus',
  },
  导热系数: {
    id: 'thermal-conductivity',
    sheet: 'thermal_conductivity_final',
    definition: '导热系数表示材料传递热量的能力。数值越高，材料越容易传递热量，触摸时更容易产生冷感或热传递感。',
    designMeaning: '帮助设计师理解材料的热传递速度与接触温感。',
    iconType: 'thermal-conductivity',
  },
  拉伸强度: {
    id: 'tensile-strength',
    sheet: 'tensile_strength_final',
    definition: '拉伸强度表示材料在拉伸作用下抵抗断裂的能力。数值越高，材料越能承受拉伸载荷。',
    designMeaning: '帮助设计师理解材料承受拉力与抵抗断裂的能力。',
    iconType: 'tensile-strength',
  },
  线膨胀系数: {
    id: 'thermal-expansion',
    sheet: 'thermal_expansion_final',
    definition: '线膨胀系数表示材料受温度变化时尺寸变化的程度。数值越高，热胀冷缩越明显。',
    designMeaning: '帮助设计师理解温度变化对材料尺寸稳定性的影响。',
    iconType: 'thermal-expansion',
  },
}

function clean(value: Cell): string {
  return String(value ?? '').trim()
}

function asNumber(value: Cell): number {
  const parsed = typeof value === 'number' ? value : Number(clean(value))
  if (!Number.isFinite(parsed)) throw new Error(`无法将“${clean(value)}”转换为数值。`)
  return parsed
}

function normalizeName(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s·•()（）\[\]【】_/\\,，、;；:：+\-]/g, '')
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function isLocalImagePath(value: string): boolean {
  if (!value || isHttpUrl(value)) return false
  return /^(?:[a-z]:\\|\\\\).+\.(?:jpe?g|png|webp|gif|bmp|tiff?|avif)$/i.test(value)
}

function isCodeOnly(value: string): boolean {
  return /^\s*[\d.\-_/]+\s*$/.test(value)
}

function firstParagraph(value: string): string {
  return value.split(/\r?\n\s*\r?\n/)[0]?.trim() ?? ''
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function findFileRecursive(root: string, filename: string): Promise<string | null> {
  const { readdir } = await import('node:fs/promises')
  const ignored = new Set(['node_modules', 'dist', '.git', '.inspection_runtime'])
  const queue = [root]
  while (queue.length) {
    const current = queue.shift()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isFile() && entry.name === filename) return fullPath
      if (entry.isDirectory()) queue.push(fullPath)
    }
  }
  return null
}

function reportedPaths(report: string, filename: string): string[] {
  const results: string[] = []
  for (const line of report.split(/\r?\n/)) {
    if (!line.includes(filename)) continue
    for (const part of line.split('|')) {
      const candidate = part.trim().replace(/^`|`$/g, '').replace(/\\\\/g, '\\')
      if (/^[a-z]:\\/i.test(candidate) && candidate.endsWith(filename)) results.push(candidate)
    }
    const inline = line.match(/实际路径：\s*([A-Za-z]:\\.+)$/)
    if (inline) results.push(inline[1].trim())
  }
  return [...new Set(results)]
}

async function locateWorkbook(filename: string, report: string): Promise<string> {
  for (const candidate of reportedPaths(report, filename)) {
    if (await exists(candidate)) return candidate
  }
  const local = await findFileRecursive(PROJECT_ROOT, filename)
  if (local) return local
  throw new Error(`未找到数据文件：${filename}`)
}

async function locateReviewWorkbook(filename: string, environmentKey: string, report: string): Promise<string> {
  const environmentPath = clean(process.env[environmentKey])
  if (environmentPath) {
    if (await exists(environmentPath)) return environmentPath
    throw new Error(`${environmentKey} 指向的文件不存在：${environmentPath}`)
  }
  for (const candidate of reportedPaths(report, filename)) {
    if (await exists(candidate)) return candidate
  }
  const searchRoots = [PROJECT_ROOT, path.dirname(PROJECT_ROOT)]
  for (const root of searchRoots) {
    const located = await findFileRecursive(root, filename)
    if (located) return located
  }
  throw new Error(`未找到人工复核文件：${filename}。文件位于项目外时，请设置 ${environmentKey}。`)
}

function sheetRows(workbook: XLSXModule.WorkBook, sheetName: string, raw = true): RawRow[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`工作簿中不存在 sheet：${sheetName}；实际 sheet：${workbook.SheetNames.join('、')}`)
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { header: 1, defval: '', raw })
}

function records(workbook: XLSXModule.WorkBook, sheetName: string): Record<string, Cell>[] {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`工作簿中不存在 sheet：${sheetName}`)
  return XLSX.utils.sheet_to_json<Record<string, Cell>>(sheet, { defval: '', raw: true })
}

function recordsFromHeaderRow(workbook: XLSXModule.WorkBook, sheetName: string, headerRow: number): Record<string, Cell>[] {
  const rows = sheetRows(workbook, sheetName, true)
  const headers = rows[headerRow - 1]?.map(clean) ?? []
  return rows.slice(headerRow).map((row) => Object.fromEntries(
    headers.flatMap((header, index) => header ? [[header, row[index] ?? ''] as const] : []),
  ))
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const ignored = new Set(['node_modules', 'dist', '.git', 'thumbnails'])
  const results: string[] = []
  const queue = [root]
  while (queue.length) {
    const current = queue.shift()!
    let entries
    try {
      entries = await readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) queue.push(fullPath)
      if (entry.isFile()) results.push(fullPath)
    }
  }
  return results
}

function normalizeRelativePath(value: string): string {
  return value.replace(/[\\/]+/g, path.sep).replace(/^[/\\]+/, '').toLowerCase()
}

function parseAliases(workbook: XLSXModule.WorkBook): Map<string, Set<string>> {
  const rows = workbook.Sheets.Sheet5 ? sheetRows(workbook, 'Sheet5', false).slice(1) : []
  const groups = rows
    .map((row) => {
      const standard = clean(row[1])
      const aliases = clean(row[2])
        .split(/[、，,\n↩]+/)
        .map((item) => item.trim())
        .filter(Boolean)
      return { standard, names: [standard, ...aliases].filter(Boolean) }
    })
    .filter((group) => group.standard)

  const byMaterial = new Map<string, Set<string>>()
  for (const group of [...groups, ...VERIFIED_CASE_ALIAS_GROUPS.map((names) => ({ standard: names[0], names }))]) {
    const normalizedGroup = new Set(group.names.map(normalizeName).filter(Boolean))
    for (const name of group.names) {
      byMaterial.set(normalizeName(name), normalizedGroup)
    }
  }
  return byMaterial
}

function parseNameChanges(workbook: XLSXModule.WorkBook) {
  const rows = recordsFromHeaderRow(workbook, '名称变动', 3)
  const byCurrentName = new Map<string, string>()
  const changes: Array<{ from: string; to: string; action: string; reason: string }> = []

  for (const row of rows) {
    const currentName = clean(row['current_standard_material（当前标准名）'])
    const finalName = clean(row['manual_final_material_name（人工）'])
    const action = clean(row['manual_name_action（人工）'])
    if (!currentName || !finalName || finalName === currentName) continue
    byCurrentName.set(normalizeName(currentName), finalName)
    changes.push({
      from: currentName,
      to: finalName,
      action,
      reason: clean(row['manual_name_change_reason（人工）']),
    })
  }
  return { byCurrentName, changes }
}

async function parseMaterialReview(
  workbook: XLSXModule.WorkBook,
  workbookPath: string,
  imageReadFailures: Array<Record<string, unknown>>,
) {
  const workbookDirectory = path.dirname(workbookPath)
  const indexedFiles = await listFilesRecursive(workbookDirectory)
  const indexedBySuffix = indexedFiles.map((filePath) => ({
    filePath,
    normalized: filePath.toLowerCase().replace(/[\\/]+/g, path.sep),
  }))
  const resolvedPathCache = new Map<string, string>()

  const resolveImagePath = async (relativePath: string): Promise<string> => {
    const cached = resolvedPathCache.get(relativePath)
    if (cached !== undefined) return cached
    const direct = path.resolve(workbookDirectory, relativePath)
    if (await exists(direct)) {
      resolvedPathCache.set(relativePath, direct)
      return direct
    }
    const suffix = normalizeRelativePath(relativePath)
    const match = indexedBySuffix.find((item) => item.normalized.endsWith(`${path.sep}${suffix}`))
    const resolved = match?.filePath ?? ''
    resolvedPathCache.set(relativePath, resolved)
    return resolved
  }

  const descriptions = new Map<string, string>()
  for (const row of recordsFromHeaderRow(workbook, '材料简介', 3)) {
    const materialName = clean(row['标准材料'])
    const description = firstParagraph(clean(row['材料简介（100—200字）']))
    if (materialName && description) descriptions.set(normalizeName(materialName), description)
  }

  const images = new Map<string, MaterialImageSource[]>()
  const reviewRows = recordsFromHeaderRow(workbook, '逐图人工复核', 3)
  for (let index = 0; index < reviewRows.length; index += 1) {
    const row = reviewRows[index]
    if (clean(row['研究者判断']) !== '可用') continue
    const materialName = clean(row['标准材料'])
    const relativePath = clean(row['本地文件'])
    if (!materialName || !relativePath || isHttpUrl(relativePath)) continue
    const sourcePath = await resolveImagePath(relativePath)
    if (!sourcePath) {
      imageReadFailures.push({
        row: index + 4,
        material: materialName,
        path: relativePath,
        reason: '人工复核表中的可用图片未在工作簿目录树内找到',
      })
      continue
    }
    const key = normalizeName(materialName)
    const entries = images.get(key) ?? []
    entries.push({
      materialName,
      title: clean(row['图片标题/形态']),
      sourcePath,
      isMain: clean(row['是否做为主图']) === '做主图',
      rowNumber: index + 4,
    })
    images.set(key, entries)
  }

  for (const [key, entries] of images) {
    entries.sort((left, right) => Number(right.isMain) - Number(left.isMain) || left.rowNumber - right.rowNumber)
    images.set(key, entries)
  }
  return { descriptions, images }
}

function aliasesFor(materialName: string, aliases: Map<string, Set<string>>): Set<string> {
  const normalized = normalizeName(materialName)
  const result = new Set<string>([normalized])
  const direct = aliases.get(normalized)
  if (direct) direct.forEach((item) => result.add(item))

  for (const [key, group] of aliases) {
    if (key.length >= 2 && normalized.length >= 2 && (key.includes(normalized) || normalized.includes(key))) {
      group.forEach((item) => result.add(item))
    }
  }
  return result
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      )
      diagonal = above
    }
  }
  return previous[right.length]
}

function similarity(left: string, right: string): number {
  const maxLength = Math.max(left.length, right.length)
  return maxLength === 0 ? 1 : 1 - levenshtein(left, right) / maxLength
}

async function parseCases(workbook: XLSXModule.WorkBook, imageReadFailures: Array<Record<string, unknown>>): Promise<SourceCase[]> {
  const rows = sheetRows(workbook, '总', false).slice(1)
  const parsed: SourceCase[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const materials = row.slice(0, 12).map(clean).filter(Boolean)
    const productName = clean(row[12])
    if (!materials.length || !productName) continue

    const trailing = row.slice(13).map(clean).filter(Boolean)
    const localPaths = trailing.filter(isLocalImagePath)
    let localImagePath = ''
    let imageReadable = false
    for (const candidate of localPaths) {
      if (await exists(candidate)) {
        localImagePath = candidate
        imageReadable = true
        break
      }
    }
    if (!localImagePath && localPaths.length) {
      localImagePath = localPaths[0]
      imageReadFailures.push({ row: index + 2, productName, path: localImagePath, reason: '文件不存在或不可读取' })
    }

    const descriptionCandidates = trailing.filter((value) =>
      !isHttpUrl(value) && !isLocalImagePath(value) && !isCodeOnly(value),
    )
    const description = firstParagraph(descriptionCandidates[0] ?? '')

    parsed.push({
      rowNumber: index + 2,
      materials,
      productName,
      description,
      localImagePath,
      imageReadable,
    })
  }
  return parsed
}

function findCases(materialName: string, sourceCases: SourceCase[], aliasMap: Map<string, Set<string>>) {
  const aliases = aliasesFor(materialName, aliasMap)
  const selected = new Map<number, { source: SourceCase; sourceMaterial: string; matchType: MatchType; score: number }>()

  const add = (source: SourceCase, sourceMaterial: string, matchType: MatchType, score: number) => {
    const previous = selected.get(source.rowNumber)
    const rank = { exact: 3, contains: 2, fuzzy: 1 }
    if (!previous || rank[matchType] > rank[previous.matchType] || score > previous.score) {
      selected.set(source.rowNumber, { source, sourceMaterial, matchType, score })
    }
  }

  for (const source of sourceCases) {
    for (const sourceMaterial of source.materials) {
      const normalized = normalizeName(sourceMaterial)
      if (aliases.has(normalized)) add(source, sourceMaterial, 'exact', 1)
    }
  }

  if (selected.size < CASE_LIMIT) {
    for (const source of sourceCases) {
      for (const sourceMaterial of source.materials) {
        const normalized = normalizeName(sourceMaterial)
        if (!normalized) continue
        const matched = [...aliases].some((alias) =>
          alias.length >= 2 && normalized.length >= 2 && (alias.includes(normalized) || normalized.includes(alias)),
        )
        if (matched) add(source, sourceMaterial, 'contains', 0.9)
      }
    }
  }

  if (selected.size < MIN_CASE_TARGET) {
    for (const source of sourceCases) {
      for (const sourceMaterial of source.materials) {
        const normalized = normalizeName(sourceMaterial)
        if (normalized.length < 3) continue
        let best = 0
        for (const alias of aliases) {
          if (alias.length >= 3) best = Math.max(best, similarity(alias, normalized))
        }
        if (best >= 0.82) add(source, sourceMaterial, 'fuzzy', best)
      }
    }
  }

  return [...selected.values()]
    .sort((left, right) => {
      const rank = { exact: 3, contains: 2, fuzzy: 1 }
      return rank[right.matchType] - rank[left.matchType]
        || Number(right.source.imageReadable) - Number(left.source.imageReadable)
        || right.score - left.score
        || left.source.rowNumber - right.source.rowNumber
    })
    .slice(0, CASE_LIMIT)
}

function safeImageName(sourcePath: string): string {
  const extension = path.extname(sourcePath).toLowerCase() || '.jpg'
  const stem = path.basename(sourcePath, path.extname(sourcePath))
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'case'
  const hash = createHash('sha1').update(sourcePath).digest('hex').slice(0, 10)
  return `${stem}-${hash}${extension}`
}

async function main() {
  const reportText = await readFile(REPORT_PATH, 'utf8')
  const axisPath = await locateWorkbook('final_material_axis_summary.xlsx', reportText)
  const casesPath = await locateWorkbook('文本图片和提及材料.xlsx', reportText)
  const materialImageReviewPath = await locateReviewWorkbook(
    'material_image_manual_review_v2.xlsx',
    'MATERIAL_IMAGE_REVIEW_XLSX',
    reportText,
  )
  const materialNameReviewPath = await locateReviewWorkbook(
    'material_reselection_manual.xlsx',
    'MATERIAL_NAME_REVIEW_XLSX',
    reportText,
  )
  const axisWorkbook = XLSX.readFile(axisPath)
  const casesWorkbook = XLSX.readFile(casesPath)
  const materialImageReviewWorkbook = XLSX.readFile(materialImageReviewPath)
  const materialNameReviewWorkbook = XLSX.readFile(materialNameReviewPath)

  await mkdir(OUTPUT_DATA_DIR, { recursive: true })
  await mkdir(OUTPUT_CASE_IMAGE_DIR, { recursive: true })
  await mkdir(OUTPUT_MATERIAL_IMAGE_DIR, { recursive: true })
  const placeholderSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#e8edf2"/>
  <path d="M200 284l72-74 52 46 58-76 78 104H200z" fill="#c5d0da"/>
  <circle cx="240" cy="146" r="28" fill="#c5d0da"/>
  <text x="320" y="354" text-anchor="middle" fill="#617184" font-family="Arial, sans-serif" font-size="24">暂无可用图片</text>
</svg>`
  await writeFile(path.join(OUTPUT_CASE_IMAGE_DIR, 'placeholder.svg'), placeholderSvg, 'utf8')
  await writeFile(path.join(OUTPUT_MATERIAL_IMAGE_DIR, 'placeholder.svg'), placeholderSvg, 'utf8')

  const axisDefinitions = records(axisWorkbook, 'axis_definition')
  const imageReadFailures: Array<Record<string, unknown>> = []
  const imageCopyFailures: Array<Record<string, unknown>> = []
  const materialImageReadFailures: Array<Record<string, unknown>> = []
  const materialImageCopyFailures: Array<Record<string, unknown>> = []
  const sourceCases = await parseCases(casesWorkbook, imageReadFailures)
  const nameReview = parseNameChanges(materialNameReviewWorkbook)
  const materialReview = await parseMaterialReview(
    materialImageReviewWorkbook,
    materialImageReviewPath,
    materialImageReadFailures,
  )
  const aliasSheetAvailable = casesWorkbook.SheetNames.includes('Sheet5')
  const aliasMap = parseAliases(casesWorkbook)
  const copiedCaseImages = new Map<string, string>()
  const copiedMaterialImages = new Map<string, string>()
  const matchStats = { exact: 0, contains: 0, fuzzy: 0, unmatched: 0 }
  const clippedIntervals: Array<Record<string, unknown>> = []

  const copyCaseImage = async (sourcePath: string, productName: string): Promise<string> => {
    if (!sourcePath || !(await exists(sourcePath))) return PLACEHOLDER_WEB_PATH
    const cached = copiedCaseImages.get(sourcePath)
    if (cached) return cached
    const filename = safeImageName(sourcePath)
    const destination = path.join(OUTPUT_CASE_IMAGE_DIR, filename)
    try {
      await copyFile(sourcePath, destination)
      const webPath = `/assets/cases/${filename}`
      copiedCaseImages.set(sourcePath, webPath)
      return webPath
    } catch (error) {
      imageCopyFailures.push({ productName, sourcePath, reason: error instanceof Error ? error.message : String(error) })
      return PLACEHOLDER_WEB_PATH
    }
  }

  const copyMaterialImage = async (source: MaterialImageSource): Promise<string> => {
    const cached = copiedMaterialImages.get(source.sourcePath)
    if (cached) return cached
    const filename = safeImageName(source.sourcePath)
    const destination = path.join(OUTPUT_MATERIAL_IMAGE_DIR, filename)
    try {
      await copyFile(source.sourcePath, destination)
      const webPath = `/assets/materials/${filename}`
      copiedMaterialImages.set(source.sourcePath, webPath)
      return webPath
    } catch (error) {
      materialImageCopyFailures.push({
        material: source.materialName,
        title: source.title,
        sourcePath: source.sourcePath,
        reason: error instanceof Error ? error.message : String(error),
      })
      return ''
    }
  }

  const parameters = []
  const materialsPerParameter: Record<string, number> = {}
  const unmatchedMaterials = new Set<string>()
  const materialsWithCases = new Set<string>()
  const materialsWithReviewedImages = new Set<string>()
  const materialsWithDescriptions = new Set<string>()
  const materialsWithoutReviewedImages = new Set<string>()
  const materialsWithoutDescriptions = new Set<string>()

  for (const axisRow of axisDefinitions) {
    const name = clean(axisRow.parameter)
    const meta = parameterMeta[name]
    if (!meta) throw new Error(`参数“${name}”缺少简介与图形映射，请先补充 parameterMeta。`)
    const axisMin = asNumber(axisRow.rounded_axis_start)
    const axisMax = asNumber(axisRow.rounded_axis_end)
    const unit = clean(axisRow.unit)
    const materialRows = records(axisWorkbook, meta.sheet)

    const materials: OutputMaterial[] = []
    for (const row of materialRows) {
      const sourceMaterialName = clean(row.standard_material)
      const materialName = nameReview.byCurrentName.get(normalizeName(sourceMaterialName)) ?? sourceMaterialName
      const min = asNumber(row.value_min)
      const max = asNumber(row.value_max)
      if (min < axisMin || max > axisMax) {
        clippedIntervals.push({ parameter: name, material: materialName, originalMin: min, originalMax: max, axisMin, axisMax })
      }

      const matches = findCases(sourceMaterialName, sourceCases, aliasMap)
      if (!matches.length) {
        unmatchedMaterials.add(materialName)
        matchStats.unmatched += 1
      } else {
        materialsWithCases.add(materialName)
      }

      const outputCases: OutputCase[] = []
      for (const match of matches) {
        const image = await copyCaseImage(match.source.imageReadable ? match.source.localImagePath : '', match.source.productName)
        matchStats[match.matchType] += 1
        outputCases.push({
          productName: match.source.productName,
          description: match.source.description,
          image,
          sourceMaterial: match.sourceMaterial,
          matchType: match.matchType,
        })
      }

      const reviewKey = normalizeName(materialName)
      const materialImageSources = materialReview.images.get(reviewKey)
        ?? materialReview.images.get(normalizeName(sourceMaterialName))
        ?? []
      const materialImages: string[] = []
      for (const source of materialImageSources) {
        const webPath = await copyMaterialImage(source)
        if (webPath && !materialImages.includes(webPath)) materialImages.push(webPath)
      }
      if (materialImages.length) materialsWithReviewedImages.add(materialName)
      else materialsWithoutReviewedImages.add(materialName)

      const description = materialReview.descriptions.get(reviewKey)
        ?? materialReview.descriptions.get(normalizeName(sourceMaterialName))
        ?? '材料简介'
      if (description !== '材料简介') materialsWithDescriptions.add(materialName)
      else materialsWithoutDescriptions.add(materialName)

      const image = materialImages[0] ?? MATERIAL_PLACEHOLDER_WEB_PATH
      materials.push({
        name: materialName,
        category: clean(row.material_category),
        min,
        max,
        image,
        images: materialImages.length ? materialImages : [MATERIAL_PLACEHOLDER_WEB_PATH],
        description,
        cognitiveText: `${materialName}在“${name}”尺度中的参数区间为 ${min}–${max} ${unit}。`,
        cases: outputCases,
      })
    }

    materialsPerParameter[name] = materials.length
    parameters.push({
      id: meta.id,
      name,
      unit,
      axisMin,
      axisMax,
      definition: meta.definition,
      designMeaning: meta.designMeaning,
      iconType: meta.iconType,
      materials,
    })
  }

  const totalMaterials = parameters.reduce((sum, parameter) => sum + parameter.materials.length, 0)
  const reviewedMaterialImageSources = [...materialReview.images.values()].flat()
  const materialsMapping = { parameters }
  const dataReport = {
    generatedAt: new Date().toISOString(),
    parsedParameterCount: parameters.length,
    materialsPerParameter,
    parsedMaterialTotal: totalMaterials,
    uniqueMaterialCount: new Set(parameters.flatMap((parameter) => parameter.materials.map((material) => material.name))).size,
    matchedMaterialCount: materialsWithCases.size,
    unmatchedMaterials: [...unmatchedMaterials].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    imageReadFailures,
    imageCopyFailures,
    materialImageReadFailures,
    materialImageCopyFailures,
    copiedImageCount: copiedCaseImages.size + copiedMaterialImages.size,
    copiedCaseImageCount: copiedCaseImages.size,
    copiedMaterialImageCount: copiedMaterialImages.size,
    reviewedUsableMaterialImageCount: reviewedMaterialImageSources.length,
    reviewedMainImageCount: reviewedMaterialImageSources.filter((item) => item.isMain).length,
    materialsWithReviewedImages: [...materialsWithReviewedImages].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    materialsWithoutReviewedImages: [...materialsWithoutReviewedImages].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    materialDescriptionCount: materialsWithDescriptions.size,
    materialsWithoutDescriptions: [...materialsWithoutDescriptions].sort((a, b) => a.localeCompare(b, 'zh-CN')),
    materialNameChanges: nameReview.changes,
    sourceFiles: {
      materialAxisWorkbook: axisPath,
      applicationCasesWorkbook: casesPath,
      materialImageReviewWorkbook: materialImageReviewPath,
      materialNameReviewWorkbook: materialNameReviewPath,
    },
    sheets: {
      axisDefinition: 'axis_definition',
      parameterMaterials: Object.fromEntries(Object.entries(parameterMeta).map(([name, meta]) => [name, meta.sheet])),
      applicationCases: '总',
      materialAliases: aliasSheetAvailable ? 'Sheet5' : null,
      materialImages: '逐图人工复核',
      materialDescriptions: '材料简介',
      materialNameChanges: '名称变动',
    },
    fieldMappings: {
      axisDefinition: {
        parameter: 'parameter', unit: 'unit', axisMin: 'rounded_axis_start', axisMax: 'rounded_axis_end',
      },
      parameterMaterials: {
        name: 'standard_material', category: 'material_category', min: 'value_min', max: 'value_max',
      },
      applicationCases: {
        mentionedMaterials: 'A–L', productName: 'M', description: 'N 起按首个非代码、非 URL、非本地图片路径文本动态识别', localImage: 'N–S 中首个可读取的本地图片路径', remoteUrl: '忽略',
      },
      materialImages: {
        name: '标准材料', title: '图片标题/形态', localImage: '本地文件', usable: '研究者判断=可用', mainImage: '是否做为主图=做主图',
      },
      materialDescriptions: {
        name: '标准材料', description: '材料简介（100—200字）',
      },
      materialNameChanges: {
        currentName: 'current_standard_material（当前标准名）', action: 'manual_name_action（人工）', finalName: 'manual_final_material_name（人工）',
      },
      verifiedCaseAliases: Object.fromEntries(
        VERIFIED_CASE_ALIAS_GROUPS.map(([sourceName, ...aliases]) => [sourceName, aliases]),
      ),
    },
    caseLimitPerMaterial: CASE_LIMIT,
    caseMatchTypeStatistics: matchStats,
    clippedIntervals,
    issues: [
      ...(!aliasSheetAvailable ? ['当前 Node Excel 解析器仅识别到案例工作簿的“总”sheet；已确认的跨表材料同义名由转换脚本显式补充。'] : []),
      ...(imageReadFailures.length ? [`${imageReadFailures.length} 条本地图片路径不存在或不可读取，相关案例使用占位图。`] : []),
      ...(imageCopyFailures.length ? [`${imageCopyFailures.length} 张图片复制失败，相关案例使用占位图。`] : []),
      ...(materialImageReadFailures.length ? [`${materialImageReadFailures.length} 张已标记可用的材料图片未找到，未加入材料图集。`] : []),
      ...(materialImageCopyFailures.length ? [`${materialImageCopyFailures.length} 张材料图片复制失败，未加入材料图集。`] : []),
      ...(materialsWithoutReviewedImages.size ? [`${materialsWithoutReviewedImages.size} 种当前基准材料没有人工复核材料图，使用占位图。`] : []),
      ...(materialsWithoutDescriptions.size ? [`${materialsWithoutDescriptions.size} 种当前基准材料没有人工复核简介，保留“材料简介”占位文字。`] : []),
      ...(unmatchedMaterials.size ? [`${unmatchedMaterials.size} 种基准材料未匹配到应用案例。`] : []),
      ...(clippedIntervals.length ? [`${clippedIntervals.length} 个材料区间超出主轴显示范围，前端按主轴边界裁切显示。`] : []),
    ],
  }

  const publicDataReport = {
    generatedAt: dataReport.generatedAt,
    parsedParameterCount: dataReport.parsedParameterCount,
    parsedMaterialTotal: dataReport.parsedMaterialTotal,
    uniqueMaterialCount: dataReport.uniqueMaterialCount,
    matchedMaterialCount: dataReport.matchedMaterialCount,
    copiedImageCount: dataReport.copiedImageCount,
    copiedCaseImageCount: dataReport.copiedCaseImageCount,
    copiedMaterialImageCount: dataReport.copiedMaterialImageCount,
    reviewedMainImageCount: dataReport.reviewedMainImageCount,
    materialDescriptionCount: dataReport.materialDescriptionCount,
    imageReadFailureCount: dataReport.imageReadFailures.length,
    imageCopyFailureCount: dataReport.imageCopyFailures.length,
    materialImageReadFailureCount: dataReport.materialImageReadFailures.length,
    materialImageCopyFailureCount: dataReport.materialImageCopyFailures.length,
    clippedIntervalCount: dataReport.clippedIntervals.length,
    unmatchedMaterials: dataReport.unmatchedMaterials,
  }

  await writeFile(path.join(OUTPUT_DATA_DIR, 'materials_mapping.json'), `${JSON.stringify(materialsMapping, null, 2)}\n`, 'utf8')
  await writeFile(path.join(OUTPUT_DATA_DIR, 'data_report.json'), `${JSON.stringify(dataReport, null, 2)}\n`, 'utf8')
  await writeFile(path.join(OUTPUT_DATA_DIR, 'public_data_report.json'), `${JSON.stringify(publicDataReport, null, 2)}\n`, 'utf8')

  console.log(JSON.stringify({
    parameters: parameters.length,
    materialRows: totalMaterials,
    uniqueMaterials: dataReport.uniqueMaterialCount,
    matchedMaterials: materialsWithCases.size,
    copiedCaseImages: copiedCaseImages.size,
    copiedMaterialImages: copiedMaterialImages.size,
    materialDescriptions: materialsWithDescriptions.size,
    renamedMaterials: nameReview.changes.length,
    unmatchedMaterials: unmatchedMaterials.size,
    clippedIntervals: clippedIntervals.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
