/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lpf: {
          bg:      '#080808',
          surface: '#111111',
          card:    '#171717',
          border:  '#262626',
          'border-light': '#333333',
          text:    '#f0f0f0',
          muted:   '#888888',
          subtle:  '#444444',
        },
      },
      boxShadow: {
        glow:       '0 0 20px rgba(255,255,255,0.07)',
        'glow-lg':  '0 0 40px rgba(255,255,255,0.12)',
        'glow-sm':  '0 0 8px  rgba(255,255,255,0.05)',
        'glow-green':  '0 0 16px rgba(34,197,94,0.45)',
        'glow-red':    '0 0 16px rgba(239,68,68,0.45)',
        'glow-blue':   '0 0 16px rgba(59,130,246,0.45)',
        'glow-orange': '0 0 16px rgba(249,115,22,0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 2.5s cubic-bezier(0.4,0,0.6,1) infinite',
        'float':      'float 5s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'flow':       'flow 1.2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        flow: {
          '0%':   { strokeDashoffset: '24' },
          '100%': { strokeDashoffset: '0' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px  rgba(255,255,255,0.08)' },
          '50%':      { boxShadow: '0 0 24px rgba(255,255,255,0.22)' },
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
    },
  },
  plugins: [],
}
