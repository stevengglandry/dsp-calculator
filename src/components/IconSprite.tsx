import { iconAtlasUrl } from '../data/normalize'
import type { IconDefinition } from '../planner/types'

interface IconSpriteProps {
  icon?: IconDefinition
  label: string
  size?: number
}

export function IconSprite({ icon, label, size = 32 }: IconSpriteProps) {
  if (!icon) {
    return (
      <span className="icon-fallback" aria-hidden="true" style={{ width: size, height: size }}>
        {label.slice(0, 1).toUpperCase()}
      </span>
    )
  }

  const scale = size / 64

  return (
    <span className="icon-frame" aria-label={label} style={{ width: size, height: size }}>
      <span
        className="icon-sprite"
        style={{
          backgroundImage: `url("${iconAtlasUrl}")`,
          backgroundPosition: `-${icon.x}px -${icon.y}px`,
          transform: `scale(${scale})`,
        }}
      />
    </span>
  )
}
