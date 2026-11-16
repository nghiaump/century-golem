import React from 'react'
import Gem from '../ui/Gem'

// "Century · Golem Edition" set in Cinzel between two crystals — our own wordmark, not the publisher's logo.
const Wordmark = ({ size = 'lg', className = '' }) => {
  const big = size === 'lg'
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <div className="flex items-center gap-3">
        <Gem color="blue" size={big ? 28 : 18} label={false} />
        <span className={`font-display font-bold text-bronze-100 text-engrave ${big ? 'text-4xl sm:text-5xl' : 'text-2xl'}`}>Century</span>
        <Gem color="pink" size={big ? 28 : 18} label={false} />
      </div>
      <span className={`font-display uppercase text-bronze-300 ${big ? 'mt-1 text-sm tracking-[0.35em]' : 'text-xs tracking-[0.3em]'}`}>Golem Edition</span>
    </div>
  )
}

export default Wordmark
