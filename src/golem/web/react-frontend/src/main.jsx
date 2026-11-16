import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import router from './router'
import { AuthProvider } from './contexts/AuthContext'
import './index.css'
import './theme-xp.css'

// Dev only (vite dev + ?gallery): every UI primitive on one page for screenshots. The branch is
// statically false in production builds, so the gallery is not bundled.
const showGallery = import.meta.env.DEV && new URLSearchParams(window.location.search).has('gallery')
const UiGallery = showGallery ? lazy(() => import('./dev/UiGallery')) : null

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* framer-motion follows the OS "reduce motion" setting */}
    <MotionConfig reducedMotion="user">
      {UiGallery ? (
        <Suspense fallback={null}><UiGallery /></Suspense>
      ) : (
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      )}
    </MotionConfig>
  </React.StrictMode>,
)

