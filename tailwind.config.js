/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lpf: {
          bg:           '#efefef',   // page / canvas background
          surface:      '#ffffff',   // panels, sidebars
          card:         '#ffffff',   // node cards
          border:       '#e0e0e0',   // default border
          'border-light':'#c8c8c8',  // hover / focus border
          text:         '#1a1a1a',   // primary text
          muted:        '#5c5c5c',   // secondary text
          subtle:       '#aaaaaa',   // hint / placeholder
        },
      },
      boxShadow: {
        glow:       '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.05)',
        'glow-lg':  '0 2px 8px rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.08)',
        'glow-sm':  '0 1px 3px rgba(0,0,0,0.06)',
        'card':     '0 1px 3px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.05)',
        'card-hover':'0 2px 8px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.07)',
        'glow-green':  '0 0 12px rgba(34,197,94,0.35)',
        'glow-red':    '0 0 12px rgba(239,68,68,0.35)',
        'glow-blue':   '0 0 12px rgba(59,130,246,0.35)',
        'glow-orange': '0 0 12px rgba(249,115,22,0.35)',
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
          '0%, 100%': { boxShadow: '0 1px 4px rgba(0,0,0,0.07)' },
          '50%':      { boxShadow: '0 2px 16px rgba(0,0,0,0.18)' },
        },
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Source Han Sans CN"', '"思源黑体"', '"Source Han Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"微软雅黑"', 'sans-serif'],
        mono: ['"Noto Sans SC"', '"Source Han Sans CN"', '"思源黑体"', '"Source Han Sans SC"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"微软雅黑"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
