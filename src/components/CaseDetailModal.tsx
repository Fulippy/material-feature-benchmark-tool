import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MaterialCase } from '../types'
import { publicAssetUrl } from '../utils/assets'

type TranslationAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

type BrowserTranslatorSession = {
  translate: (text: string) => Promise<string>
  destroy?: () => void
}

type BrowserTranslatorApi = {
  availability: (options: { sourceLanguage: string; targetLanguage: string }) => Promise<TranslationAvailability>
  create: (options: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (monitor: EventTarget) => void
  }) => Promise<BrowserTranslatorSession>
}

type Props = {
  items: MaterialCase[]
  initialIndex: number
  onClose: () => void
}

const matchLabel = {
  exact: '完全匹配',
  contains: '包含匹配',
  fuzzy: '近似匹配',
  unmatched: '未匹配',
}

const commonTranslations: Record<string, string> = {
  'table': '桌子',
  'desk': '书桌',
  'chair': '椅子',
  'stool': '凳子',
  'bench': '长凳',
  'lamp': '灯具',
  'lighting': '照明产品',
  'safety helmet': '安全头盔',
  'bicycle helmet': '自行车头盔',
  'seating furniture': '座椅家具',
  'home furniture': '家居家具',
  'household': '家居用品',
  'interior design element': '室内设计构件',
  'kitchen knife set': '厨房刀具套装',
  'acoustic cork panel': '软木吸声板',
  'water sports and equipment': '水上运动及相关装备',
  'camera equipment': '摄影器材',
  'luggage': '旅行箱',
  'suitcase': '旅行箱',
  'umbrella': '雨伞',
  'stove': '炉具',
  'hose reel': '软管卷盘',
}

function cacheKey(item: MaterialCase) {
  let hash = 5381
  const value = `${item.productName}\u241f${item.description}`
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) + hash) ^ value.charCodeAt(index)
  return `material-case-translation:${hash >>> 0}`
}

function localFallback(text: string) {
  const normalized = text.trim().toLowerCase()
  if (commonTranslations[normalized]) return commonTranslations[normalized]
  const words = text.trim().split(/\s+/).filter(Boolean)
  const likelyProductName = text.length <= 56
    && words.length <= 6
    && words.every((word) => /^[A-Z0-9&][\w’'&+\-/]*$/.test(word))
  if (likelyProductName) return `产品名称或型号：${text.trim()}`
  return ''
}

export default function CaseDetailModal({ items, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const item = items[index]
  const hasMultiple = items.length > 1
  const originalDescription = item.description || '原始数据未提供产品简介。'
  const fallback = useMemo(() => localFallback(originalDescription), [originalDescription])
  const [translation, setTranslation] = useState(fallback)
  const [, setTranslationStatus] = useState(fallback ? '已根据原文类型整理' : '正在准备中文翻译…')
  const [image, setImage] = useState(() => publicAssetUrl(item.image))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && hasMultiple) setIndex((current) => (current - 1 + items.length) % items.length)
      if (event.key === 'ArrowRight' && hasMultiple) setIndex((current) => (current + 1) % items.length)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasMultiple, items.length, onClose])

  useEffect(() => {
    setImage(publicAssetUrl(item.image))
  }, [item.image])

  useEffect(() => {
    setTranslation(fallback)
    setTranslationStatus(fallback ? '已根据原文类型整理' : '正在准备中文翻译…')
    if (fallback || /[\u3400-\u9fff]/.test(originalDescription)) {
      if (!fallback) {
        setTranslation(originalDescription)
        setTranslationStatus('原文已是中文')
      }
      return
    }

    const key = cacheKey(item)
    const cached = window.localStorage.getItem(key)
    if (cached) {
      setTranslation(cached)
      setTranslationStatus('中文翻译已从本机缓存读取')
      return
    }

    let cancelled = false
    let session: BrowserTranslatorSession | undefined
    const translate = async () => {
      const translatorApi = (globalThis as typeof globalThis & { Translator?: BrowserTranslatorApi }).Translator
      if (!translatorApi) {
        setTranslation('当前浏览器暂不支持本地自动翻译。请保留英文原文，或在支持 Translator API 的最新版 Microsoft Edge 中查看。')
        setTranslationStatus('本地翻译不可用')
        return
      }

      try {
        const options = { sourceLanguage: 'en', targetLanguage: 'zh-Hans' }
        const availability = await translatorApi.availability(options)
        if (availability === 'unavailable') throw new Error('translation unavailable')
        if (availability === 'downloadable' || availability === 'downloading') {
          setTranslationStatus('正在下载浏览器本地翻译模型…')
        }
        session = await translatorApi.create({
          ...options,
          monitor(monitor) {
            monitor.addEventListener('downloadprogress', (event) => {
              const progress = Number((event as Event & { loaded?: number }).loaded ?? 0)
              if (!cancelled && progress > 0) setTranslationStatus(`正在准备中文翻译… ${Math.round(progress * 100)}%`)
            })
          },
        })
        const result = await session.translate(originalDescription)
        if (cancelled) return
        setTranslation(result)
        setTranslationStatus('由浏览器在本机自动翻译')
        window.localStorage.setItem(key, result)
      } catch {
        if (!cancelled) {
          setTranslation('中文自动翻译暂时不可用。英文案例介绍已完整保留，可稍后重新打开案例重试。')
          setTranslationStatus('翻译失败')
        }
      }
    }
    void translate()
    return () => {
      cancelled = true
      session?.destroy?.()
    }
  }, [fallback, item, originalDescription])

  return createPortal(
    <div
      className="case-detail-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-detail-title"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="case-detail-dialog">
        <button type="button" className="case-detail-dialog__close" onClick={onClose} autoFocus aria-label="关闭案例详情">×</button>
        <div className="case-detail-dialog__visual">
          {hasMultiple && (
            <button
              type="button"
              className="case-detail-dialog__arrow case-detail-dialog__arrow--previous"
              onClick={() => setIndex((current) => (current - 1 + items.length) % items.length)}
              aria-label="查看上一个同材料应用案例"
            >
              ‹
            </button>
          )}
          <img
            src={image}
            alt={`${item.productName} 应用案例大图`}
            onError={() => setImage(publicAssetUrl('/assets/cases/placeholder.svg'))}
          />
          {hasMultiple && (
            <button
              type="button"
              className="case-detail-dialog__arrow case-detail-dialog__arrow--next"
              onClick={() => setIndex((current) => (current + 1) % items.length)}
              aria-label="查看下一个同材料应用案例"
            >
              ›
            </button>
          )}
          <span>APPLICATION CASE</span>
          <small>{index + 1} / {items.length}</small>
        </div>
        <div className="case-detail-dialog__content">
          <p className="eyebrow">APPLICATION CONTEXT</p>
          <h2 id="case-detail-title">{item.productName}</h2>
          <div className="case-detail-dialog__meta">
            <span>提及材料 · {item.sourceMaterial}</span>
            <span>{matchLabel[item.matchType]}</span>
          </div>
          <section className="case-detail-dialog__translation">
            <div>
              <p className="case-detail-dialog__label">案例介绍翻译</p>
            </div>
            <h3>案例介绍</h3>
            <p lang="zh-CN">{translation || '正在生成中文翻译…'}</p>
          </section>
          <section>
            <p className="case-detail-dialog__label">ORIGINAL DESCRIPTION</p>
            <h3>案例原文介绍</h3>
            <p lang="en">{originalDescription}</p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  )
}
