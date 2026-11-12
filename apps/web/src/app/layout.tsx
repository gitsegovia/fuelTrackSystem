import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppProviders } from '@/components/layout/AppProviders'
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Estación360',
  description: 'Sistema de gestión de estaciones de combustible',
}

// T-072 (experimental): color de marca en la barra del navegador en el teléfono.
export const viewport: Viewport = {
  themeColor: '#0B2238',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full bg-background">
        <ServiceWorkerRegistrar />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
