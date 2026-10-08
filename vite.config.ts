import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// public/ holds the whole pre-React site -- every .html page, its css and
// js, and the images. Vite copies that directory into dist/ untouched, so
// /dashboard.html, /main.css and /logo-mark.png keep resolving at exactly
// the URLs they always had while the React rebuild happens page by page.
// A big-bang cutover would mean re-proving auth, the dashboard, projects
// and admin all at once, on a site that currently works.
export default defineConfig({
  plugins: [react(), tailwindcss()],
})
