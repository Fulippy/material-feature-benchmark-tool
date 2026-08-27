export function publicAssetUrl(source: string) {
  if (!source) return `${import.meta.env.BASE_URL}assets/cases/placeholder.svg`
  if (/^(?:https?:|data:|blob:)/i.test(source)) return source
  return `${import.meta.env.BASE_URL}${source.replace(/^\.?\//, '')}`
}
