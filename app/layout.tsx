import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TripXplo AI - Your Travel Assistant',
  description: 'AI-powered travel assistant for finding packages and planning trips',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}