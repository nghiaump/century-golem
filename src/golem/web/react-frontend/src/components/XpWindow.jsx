import React from 'react'

// Windows XP-style window (theme-xp.css): blue title bar, beige face, brutalist border + hard shadow.
// `onClose` renders a working close button; `status` renders an XP status bar under the body.
const XpWindow = ({ title, icon, onClose, status, className = '', bodyClassName = '', children }) => (
  <div className={`xp-window ${className}`} role="dialog" aria-label={title}>
    <div className="xp-titlebar">
      {icon && <img className="xp-titlebar-icon" src={icon} alt="" />}
      <span className="xp-titlebar-title">{title}</span>
      {onClose && (
        <button type="button" className="xp-title-btn" onClick={onClose} aria-label="Close" title="Back to menu">
          ✕
        </button>
      )}
    </div>
    <div className={`xp-body ${bodyClassName}`}>{children}</div>
    {status && <div className="xp-statusbar">{status}</div>}
  </div>
)

export default XpWindow
