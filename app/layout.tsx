import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CodeWire — エンジニア向けテックメディア',
  description: '海外テックニュースをAIで日本語翻訳・要約。Hacker News、Dev.to、TechCrunchなどを一覧で。エンジニア向けQ&Aも。',
  keywords: ['テックニュース', 'エンジニア', 'プログラミング', 'AI翻訳', 'Hacker News', 'Dev.to'],
  openGraph: {
    title: 'CodeWire — エンジニア向けテックメディア',
    description: '海外テックニュースをAIで日本語翻訳。エンジニア向けQ&A付き。',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;700;800&family=Noto+Sans+JP:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
