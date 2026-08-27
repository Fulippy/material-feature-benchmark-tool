type Props = {
  type: string
  size?: number
  animated?: boolean
}

export default function ParameterIcon({ type, size = 88, animated = false }: Props) {
  const className = `parameter-icon parameter-icon--${type}${animated ? ' is-animated' : ''}`

  if (type === 'density') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="同体积材料的重量差异图形">
        <path d="M18 33l20-12 20 12-20 12-20-12z" />
        <path d="M18 33v25l20 12V45L18 33zm40 0v25L38 70V45l20-12z" />
        <path className="icon-accent" d="M62 29h17M66 35h9M69 41h3" />
        <path className="icon-accent" d="M74 50v22m-9-4h18M68 72h12" />
      </svg>
    )
  }

  if (type === 'elastic-modulus') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="材料梁受力弯曲图形">
        <path d="M15 64h8m50 0h8M23 58v12m50-12v12" />
        <path className="icon-beam" d="M23 47c14 0 18 12 25 12s11-12 25-12" />
        <path className="icon-accent" d="M48 18v27m-7-8l7 8 7-8" />
      </svg>
    )
  }

  if (type === 'thermal-conductivity') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="热量沿材料传递图形">
        <rect x="16" y="34" width="64" height="28" rx="5" />
        <circle className="icon-hot" cx="27" cy="48" r="7" />
        <path className="icon-accent icon-flow" d="M38 48h27m-8-8l8 8-8 8" />
      </svg>
    )
  }

  if (type === 'tensile-strength') {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="材料条受左右拉伸图形">
        <path className="icon-beam" d="M33 40h30v16H33z" />
        <path className="icon-accent" d="M33 48H12m8-8l-8 8 8 8m43-8h21m-8-8l8 8-8 8" />
      </svg>
    )
  }

  return (
    <svg className={className} width={size} height={size} viewBox="0 0 96 96" role="img" aria-label="材料受热伸长图形">
      <rect className="icon-beam" x="18" y="39" width="48" height="18" rx="3" />
      <path className="icon-accent" d="M66 48h18m-7-7l7 7-7 7" />
      <path className="icon-hot" d="M28 31c-6-7 5-9 0-16m15 16c-6-7 5-9 0-16m15 16c-6-7 5-9 0-16" />
    </svg>
  )
}
