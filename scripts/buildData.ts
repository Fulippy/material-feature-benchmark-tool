import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
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
  description: string
  cognitiveText: string
  cases: OutputCase[]
}

const PROJECT_ROOT = process.cwd()
const REPORT_PATH = path.join(PROJECT_ROOT, 'data_inspection_report.md')
const OUTPUT_DATA_DIR = path.join(PROJECT_ROOT, 'src', 'data')
const OUTPUT_IMAGE_DIR = path.join(PROJECT_ROOT, 'public', 'assets', 'cases')
const PLACEHOLDER_WEB_PATH = '/assets/cases/placeholder.svg'
const CASE_LIMIT = 20
const MIN_CASE_TARGET = 10

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

function parseAliases(workbook: XLSXModule.WorkBook): Map<string, Set<string>> {
  if (!workbook.Sheets.Sheet5) return new Map()
  const rows = sheetRows(workbook, 'Sheet5', false).slice(1)
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
  for (const group of groups) {
    const normalizedGroup = new Set(group.names.map(normalizeName).filter(Boolean))
    for (const name of group.names) {
      byMaterial.set(normalizeName(name), normalizedGroup)
    }
  }
  return byMaterial
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
  const axisWorkbook = XLSX.readFile(axisPath)
  const casesWorkbook = XLSX.readFile(casesPath)

  await mkdir(OUTPUT_DATA_DIR, { recursive: true })
  await mkdir(OUTPUT_IMAGE_DIR, { recursive: true })
  await writeFile(path.join(OUTPUT_IMAGE_DIR, 'placeholder.svg'), `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
  <rect width="640" height="420" fill="#e8edf2"/>
  <path d="M200 284l72-74 52 46 58-76 78 104H200z" fill="#c5d0da"/>
  <circle cx="240" cy="146" r="28" fill="#c5d0da"/>
  <text x="320" y="354" text-anchor="middle" fill="#617184" font-family="Arial, sans-serif" font-size="24">暂无可用图片</text>
</svg>`, 'utf8')

  const axisDefinitions = records(axisWorkbook, 'axis_definition')
  const imageReadFailures: Array<Record<string, unknown>> = []
  const imageCopyFailures: Array<Record<string, unknown>> = []
  const sourceCases = await parseCases(casesWorkbook, imageReadFailures)
  const aliasSheetAvailable = casesWorkbook.SheetNames.includes('Sheet5')
  const aliasMap = parseAliases(casesWorkbook)
  const copiedImages = new Map<string, string>()
  const matchStats = { exact: 0, contains: 0, fuzzy: 0, unmatched: 0 }
  const clippedIntervals: Array<Record<string, unknown>> = []

  const copyImage = async (sourcePath: string, productName: string): Promise<string> => {
    if (!sourcePath || !(await exists(sourcePath))) return PLACEHOLDER_WEB_PATH
    const cached = copiedImages.get(sourcePath)
    if (cached) return cached
    const filename = safeImageName(sourcePath)
    const destination = path.join(OUTPUT_IMAGE_DIR, filename)
    try {
      await copyFile(sourcePath, destination)
      const webPath = `/assets/cases/${filename}`
      copiedImages.set(sourcePath, webPath)
      return webPath
    } catch (error) {
      imageCopyFailures.push({ productName, sourcePath, reason: error instanceof Error ? error.message : String(error) })
      return PLACEHOLDER_WEB_PATH
    }
  }

  const parameters = []
  const materialsPerParameter: Record<string, number> = {}
  const unmatchedMaterials = new Set<string>()
  const materialsWithCases = new Set<string>()

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
      const materialName = clean(row.standard_material)
      const min = asNumber(row.value_min)
      const max = asNumber(row.value_max)
      if (min < axisMin || max > axisMax) {
        clippedIntervals.push({ parameter: name, material: materialName, originalMin: min, originalMax: max, axisMin, axisMax })
      }

      const matches = findCases(materialName, sourceCases, aliasMap)
      if (!matches.length) {
        unmatchedMaterials.add(materialName)
        matchStats.unmatched += 1
      } else {
        materialsWithCases.add(materialName)
      }

      const outputCases: OutputCase[] = []
      for (const match of matches) {
        const image = await copyImage(match.source.imageReadable ? match.source.localImagePath : '', match.source.productName)
        matchStats[match.matchType] += 1
        outputCases.push({
          productName: match.source.productName,
          description: match.source.description,
          image,
          sourceMaterial: match.sourceMaterial,
          matchType: match.matchType,
        })
      }

      const materialImage = outputCases.find((item) => item.image !== PLACEHOLDER_WEB_PATH)?.image ?? PLACEHOLDER_WEB_PATH
      materials.push({
        name: materialName,
        category: clean(row.material_category),
        min,
        max,
        image: materialImage,
        description: '材料简介',
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
    copiedImageCount: copiedImages.size,
    sourceFiles: {
      materialAxisWorkbook: axisPath,
      applicationCasesWorkbook: casesPath,
    },
    sheets: {
      axisDefinition: 'axis_definition',
      parameterMaterials: Object.fromEntries(Object.entries(parameterMeta).map(([name, meta]) => [name, meta.sheet])),
      applicationCases: '总',
      materialAliases: aliasSheetAvailable ? 'Sheet5' : null,
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
    },
    caseLimitPerMaterial: CASE_LIMIT,
    caseMatchTypeStatistics: matchStats,
    clippedIntervals,
    issues: [
      ...(!aliasSheetAvailable ? ['当前 Node Excel 解析器仅识别到案例工作簿的“总”sheet，未使用 Sheet5 别名表；匹配仍按总表原始材料名称执行。'] : []),
      ...(imageReadFailures.length ? [`${imageReadFailures.length} 条本地图片路径不存在或不可读取，相关案例使用占位图。`] : []),
      ...(imageCopyFailures.length ? [`${imageCopyFailures.length} 张图片复制失败，相关案例使用占位图。`] : []),
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
    imageReadFailureCount: dataReport.imageReadFailures.length,
    imageCopyFailureCount: dataReport.imageCopyFailures.length,
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
    copiedImages: copiedImages.size,
    unmatchedMaterials: unmatchedMaterials.size,
    clippedIntervals: clippedIntervals.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
