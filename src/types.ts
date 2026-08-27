export type MatchType = 'exact' | 'contains' | 'fuzzy' | 'unmatched'

export type MaterialCase = {
  productName: string
  description: string
  image: string
  sourceMaterial: string
  matchType: MatchType
}

export type Material = {
  name: string
  category: string
  min: number
  max: number
  image: string
  description?: string
  cognitiveText: string
  cases: MaterialCase[]
}

export type Parameter = {
  id: string
  name: string
  unit: string
  axisMin: number
  axisMax: number
  definition: string
  designMeaning: string
  iconType: string
  materials: Material[]
}

export type MaterialsMapping = {
  parameters: Parameter[]
}

export type SearchResult = {
  value: number | null
  highlightedNames: string[]
  selectedName: string | null
  message: string
  outOfRange: boolean
}
