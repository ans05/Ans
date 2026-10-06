import localFont from "next/font/local";

/** Inter (variable), self-hosted from the fontsource package so builds never hit the network. */
export const inter = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});
