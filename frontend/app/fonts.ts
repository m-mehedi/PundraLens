import localFont from "next/font/local"

/**
 * Purno — the Bangla typeface of Bangladesh.
 *
 * The app's UI runs on Inter, which carries no Bangla glyphs, so every
 * Bengali notice used to fall back to whatever the operating system
 * happened to have. Purno gives the Bangla content — titles, summaries,
 * the notice body — a deliberate voice of its own.
 */
export const purno = localFont({
  src: [
    {
      path: "./fonts/Purno-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Purno-Italic.ttf",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/Purno-Bold.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Purno-BoldItalic.ttf",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-purno",
  display: "swap",
})
