import React from 'react'
import Pill from './ui/Pill'
import { aiLevelInfo } from '../utils/aiLevel'

/** AI difficulty as a pill with 1–4 dots (Easy … Very Hard). Renders nothing for an unknown level. */
const LevelPill = ({ level, className = '' }) => {
  const info = aiLevelInfo(level)
  if (!info) return null
  return <Pill tone={info.tone} pips={info.pips} className={className}>{info.label}</Pill>
}

export default LevelPill
