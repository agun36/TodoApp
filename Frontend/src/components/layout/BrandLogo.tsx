import { Link } from 'react-router-dom'
import { routes } from '../../lib/routes'

interface BrandLogoProps {
  compact?: boolean
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <Link to={routes.dashboard} className={`brand${compact ? ' brand--compact' : ''}`}>
      <span className="brand__mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.9" />
          <rect x="13" y="3" width="8" height="5" rx="2" fill="currentColor" opacity="0.55" />
          <rect x="13" y="10" width="8" height="11" rx="2" fill="currentColor" opacity="0.75" />
          <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.35" />
        </svg>
      </span>
      {!compact && <span className="brand__name">TaskFlow</span>}
    </Link>
  )
}
