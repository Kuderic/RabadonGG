import { champSlug } from '../utils/champion'

export function RankBadge({ rank }) {
  const cls = rank <= 3 ? `rank-badge rank-${rank}` : 'rank-badge rank-other'
  return <span className={cls}>#{rank}</span>
}

export function ExternalLink({ champion }) {
  return (
    <a
      href={`https://lolalytics.com/lol/${champSlug(champion)}/build/`}
      target="_blank"
      rel="noopener noreferrer"
      className="lola-link bp-lola-link"
      title={`Open ${champion} on lolalytics.com`}
      onClick={e => e.stopPropagation()}
    >
      <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7 1h4v4M11 1L5.5 6.5M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </a>
  )
}
