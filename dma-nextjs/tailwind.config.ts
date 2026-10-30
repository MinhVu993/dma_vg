import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        dark: {
          bg: '#121214',
          text: '#F1F2F4',
          card: '#18181C',
          border: '#26262C',
          muted: '#8E929B',
        },
        bento: {
          bg: '#121214',
          card: '#18181C',
          border: '#26262C',
          hover: '#1E1E24',
          accent: '#F43F5E',
        },
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: [
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        bento:
          '0 0 0 1px rgba(255, 255, 255, 0.05), 0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'bento-glow': '0 0 25px -5px rgba(16, 185, 129, 0.15)',
      },
    },
  },
  plugins: [],
}

export default config
