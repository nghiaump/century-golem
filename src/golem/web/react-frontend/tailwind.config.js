// Màu lấy từ CSS variable dạng "r g b" (src/styles/tokens.css) để dùng được độ mờ kiểu bg-rock-800/80.
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`
const tokenScale = (name, steps) => Object.fromEntries(steps.map((n) => [n, token(`${name}-${n}`)]))

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      // Custom breakpoints for game UI
      screens: {
        'xs': '375px',      // Small phones
        'sm': '640px',      // Large phones / landscape
        'md': '768px',      // Tablets
        'lg': '1024px',     // Small laptops
        'xl': '1280px',     // Desktop
        '2xl': '1536px',    // Large desktop
        // Orientation-specific breakpoints
        'portrait': { 'raw': '(orientation: portrait)' },
        'landscape': { 'raw': '(orientation: landscape)' },
        // Touch device detection
        'touch': { 'raw': '(hover: none) and (pointer: coarse)' },
        'no-touch': { 'raw': '(hover: hover) and (pointer: fine)' },
      },
      // Card sizes for responsive design
      width: {
        'card-xs': '120px',
        'card-sm': '140px',
        'card-md': '160px',
        'card-lg': '200px',
        'card-xl': '240px',
      },
      height: {
        'card-xs': '180px',
        'card-sm': '210px',
        'card-md': '240px',
        'card-lg': '300px',
        'card-xl': '360px',
      },
      minWidth: {
        'card-xs': '120px',
        'card-sm': '140px',
        'card-md': '160px',
        'card-lg': '200px',
      },
      maxWidth: {
        'card-xs': '140px',
        'card-sm': '160px',
        'card-md': '200px',
        'card-lg': '240px',
        'card-xl': '280px',
      },
      // Custom spacing for game layout
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        '18': '4.5rem',
        '22': '5.5rem',
      },
      // Z-index: MỘT thang duy nhất cho cả app (không dùng z-[9999] tuỳ tiện)
      zIndex: {
        'board': '10',
        'hud': '20',
        'drawer': '30',
        'banner': '40',
        'overlay': '50',
        'popover': '60',
        'modal': '70',
        'toast': '80',
        'system': '90',
      },
      // Font OFL tự phục vụ (src/styles/fonts.css). display = Cinzel: CHỈ chữ tiếng Anh tĩnh (không có dấu tiếng Việt).
      // Cỡ chữ dùng thang mặc định của Tailwind (xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30) — không dưới 12px.
      fontFamily: {
        display: ['Cinzel', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Noto Sans"', 'sans-serif'],
      },
      // Màu "Stone & Crystal" — giá trị ở src/styles/tokens.css (kênh RGB để dùng được /alpha)
      colors: {
        rock: tokenScale('rock', [950, 900, 800, 700, 600, 400, 200]),
        bronze: tokenScale('bronze', [700, 500, 300, 100]),
        parch: tokenScale('parch', [100, 200, 400]),
        ink: { DEFAULT: token('ink'), muted: token('ink-muted') },
        fg: { DEFAULT: token('fg'), muted: token('fg-muted') },
        ember: token('ember'),
        moss: token('moss'),
        teal: { DEFAULT: token('teal') },
        gem: {
          yellow: token('gem-yellow'), 'yellow-light': token('gem-yellow-light'), 'yellow-dark': token('gem-yellow-dark'),
          green: token('gem-green'), 'green-light': token('gem-green-light'), 'green-dark': token('gem-green-dark'),
          blue: token('gem-blue'), 'blue-light': token('gem-blue-light'), 'blue-dark': token('gem-blue-dark'),
          pink: token('gem-pink'), 'pink-light': token('gem-pink-light'), 'pink-dark': token('gem-pink-dark'),
        },
      },
      borderRadius: {
        'stone-sm': 'var(--r-sm)',
        'stone': 'var(--r-md)',
        'stone-lg': 'var(--r-lg)',
      },
      boxShadow: {
        'bevel': 'var(--bevel)',
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'turn': 'var(--glow-turn)',
      },
      // Animation durations
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      // Custom animations
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-subtle': 'bounce-subtle 2s infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
      },
      keyframes: {
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      // Container queries support
      containers: {
        'card': '10rem',
        'panel': '20rem',
      },
    },
  },
  plugins: [],
}
