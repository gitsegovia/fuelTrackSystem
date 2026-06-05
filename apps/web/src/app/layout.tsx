import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { AppProviders } from '@/components/layout/AppProviders'
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'FuelTrack',
  description: 'Sistema de gestión de estaciones de combustible',
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
