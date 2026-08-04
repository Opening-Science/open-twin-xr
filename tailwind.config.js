/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Class-based rather than `media`, because the theme is a control in the UI:
  // a viewer comparing tissue colour wants to pick the background, not inherit
  // whatever the OS decided.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Every surface colour is a CSS variable so the existing `text-ink` /
        // `bg-panel` classes retheme themselves — see src/styles.css. The two
        // text colours keep `<alpha-value>` support because they are used with
        // opacity modifiers (`text-ink/70`); the surfaces bake their own alpha,
        // since a translucent panel over a dark page is not the same colour at
        // reduced opacity as one over a light page.
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        /** Frosted card background. */
        panel: 'var(--panel)',
        /** Floating control background — pills, the switcher, the sliders. */
        surface: 'var(--surface)',
        /** Hairline borders. */
        line: 'var(--line)',
        /** Inset track a segmented control sits in. */
        track: 'var(--track)',
        /** The selected segment lifted out of that track. */
        raised: 'var(--raised)',
        // Health score scale endpoints (see src/scene/healthColor.ts for the runtime scale)
        low: '#d9736a',
        mid: '#e6b566',
        high: '#5fae94',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        panel: '18px',
      },
    },
  },
  plugins: [],
}
