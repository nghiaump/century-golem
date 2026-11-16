import React from 'react'
import { getCardSpriteStyle, getCardImagePath } from '../../utils/cardNames'

/** A card's artwork (sprite sheet when enabled, else the single image). Size/shape via className. */
const CardImage = ({ name, alt = '', className = '' }) => {
  const sprite = getCardSpriteStyle(name)
  if (sprite) return <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className={className} style={sprite} />
  return (
    <img
      src={getCardImagePath(name)}
      alt={alt}
      className={`object-cover ${className}`}
      draggable="false"
      onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
    />
  )
}

export default CardImage
