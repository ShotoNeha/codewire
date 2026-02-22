'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ================================================================
// TYPES
// ================================================================
interface Article {
  id: string
  source: 'hn' | 'devto' | 'rss'
  title: string
  url: string
  hnUrl?: string
  score: number
  comments: number
  time: number | string
  by?: string
  tags: string[]
  description?: string
  sourceName?: string
  sourceBadge?: string
}

interface Question {
  id: string
  title: string
  body: string
  tags: string[]
  votes: number
  by: string
  time: number
  answers: Answer[]
  aiAnswer: string | null
}

interface Answer {
  id: string
  text: string
  votes: number
  best: boolean
  by: string
  time: number
}

// ================================================================
// UTILS
// ================================================================
const esc = (s: string | undefined | null) =>
  (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function timeAgo(t: number | string | undefined): string {
  if (!t) return ''
  const d = typeof t === 'number' ? new Date(t * 1000) : new Date(t)
  if (isNaN(d.getTime())) return ''
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}秒前`
  if (s < 3600) return `${Math.floor(s / 60)}分前`
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`
  return `${Math.floor(s / 86400)}日前`
}

const TAG_MAP: Record<string, string[]> = {
  'javascript': ['javascript', 'js', 'node', 'npm', 'v8', 'bun'],
  'python': ['python', 'pip', 'django', 'flask', 'pytorch'],
  'ai/ml': ['ai', 'llm', 'gpt', 'claude', 'gemini', 'machine learning', 'openai', 'anthropic'],
  'rust': ['rust', 'cargo'],
  'typescript': ['typescript'],
  'react': ['react', 'nextjs', 'next.js', 'jsx'],
  'go': ['golang', 'go '],
  'docker': ['docker', 'container', 'kubernetes', 'k8s'],
  'security': ['security', 'vulnerability', 'exploit', 'cve'],
  'cloud': ['aws', 'azure', 'gcp', 'serverless'],
  'open source': ['open source', 'opensource', 'github'],
  'web': ['web', 'browser', 'css', 'html', 'frontend', 'backend'],
}

function extractTags(title: string): string[] {
  const l = (title || '').toLowerCase()
  return Object.entries(TAG_MAP)
    .filter(([, kws]) => kws.some((k) => l.includes(k)))
    .map(([t]) => t)
    .slice(0, 3)
}

const PAGE_SIZE = 15

const FALLBACK_REPOS = [
  { name: 'anthropics/claude-code', desc: 'Agentic coding tool', stars: '42k+', lang: 'TypeScript', lc: '#3178c6' },
  { name: 'vercel/next.js', desc: 'The React Framework for the Web', stars: '120k', lang: 'JavaScript', lc: '#f7df1e' },
  { name: 'microsoft/typescript', desc: 'TypeScript is JavaScript with syntax for types', stars: '98k', lang: 'TypeScript', lc: '#3178c6' },
  { name: 'rust-lang/rust', desc: 'Empowering everyone to build reliable and efficient software', stars: '96k', lang: 'Rust', lc: '#dea584' },
  { name: 'deepseek-ai/DeepSeek-V3', desc: 'DeepSeek-V3 technical report', stars: '88k', lang: 'Python', lc: '#3572a5' },
]

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 'q1',
    title: 'ReactとVue、2025年に新しくプロジェクトを始めるならどちらを選ぶべきですか？',
    body: 'B2BのSaaSを個人で作ろうとしています。エコシステムや求人、学習コスト、将来性などの観点で意見を聞かせてください。',
    tags: ['javascript', 'react', 'vue'],
    votes: 12,
    by: 'taro_dev',
    time: Date.now() - 3600000 * 2,
    answers: [
      { id: 'a1', text: '2025年時点ではReactの求人数がVueの約3倍。SaaSであればReact + Next.jsが無難です。', votes: 8, best: true, by: 'senior_eng', time: Date.now() - 3600000 },
    ],
    aiAnswer: null,
  },
  {
    id: 'q2',
    title: 'Go言語でHTTPサーバーを書くとき標準ライブラリだけで十分ですか？',
    body: 'net/httpだけで実装するのとGinやEchoを使う場合の違いを教えてください。',
    tags: ['go', 'web', 'backend'],
    votes: 7,
    by: 'go_beginner',
    time: Date.now() - 86400000,
    answers: [],
    aiAnswer: null,
  },
]

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function Home() {
  const [page, setPage] = useState<'feed' | 'qa' | 'bookmarks'>('feed')
  const [articles, setArticles] = useState<Article[]>([])
  const [displayCount, setDisplayCount] = useState(0)
  const [filter, setFilter] = useState('all')
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const [bookmarks, setBookmarks] = useState<Article[]>([])
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS)
  const [qaFilter, setQaFilter] = useState('all')
  const [repos, setRepos] = useState(FALLBACK_REPOS)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type: string; show: boolean }>({ msg: '', type: '', show: false })
  const [translations, setTranslations] = useState<Record<string, { title: string; summary: string; visible: boolean }>>({})
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set())
  const [aiAnswers, setAiAnswers] = useState<Record<string, string>>({})
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set())
  const [ticker, setTicker] = useState<Article[]>([])

  // Form refs
  const qTitleRef = useRef<HTMLInputElement>(null)
  const qBodyRef = useRef<HTMLTextAreaElement>(null)
  const qTagsRef = useRef<HTMLInputElement>(null)

  // ── Toast ──────────────────────────────────────────────
  const showToast = useCallback((msg: string, type = 'info') => {
    setToast({ msg, type, show: true })
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2500)
  }, [])

  // ── Bookmarks ──────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem('codewire_bookmarks')
      if (stored) setBookmarks(JSON.parse(stored))
    } catch {}
    try {
      const stored = localStorage.getItem('codewire_qa')
      if (stored) setQuestions(JSON.parse(stored))
    } catch {}
  }, [])

  const saveBookmarks = useCallback((bms: Article[]) => {
    try { localStorage.setItem('codewire_bookmarks', JSON.stringify(bms)) } catch {}
  }, [])

  const toggleBookmark = useCallback((article: Article) => {
    setBookmarks((prev) => {
      const idx = prev.findIndex((b) => b.id === article.id)
      const next = idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, article]
      saveBookmarks(next)
      showToast(idx >= 0 ? 'ブックマークを削除しました' : '☆ ブックマークに追加しました', idx >= 0 ? 'info' : 'success')
      return next
    })
  }, [saveBookmarks, showToast])

  // ── Fetchers ───────────────────────────────────────────
  const fetchHN = async (): Promise<Article[]> => {
    const res = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')
    const ids: number[] = await res.json()
    const results = await Promise.allSettled(
      ids.slice(0, 30).map((id) =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then((r) => r.json())
      )
    )
    return results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled' && r.value?.title)
      .map((r) => r.value)
      .map((item) => ({
        id: 'hn_' + item.id,
        source: 'hn' as const,
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        hnUrl: `https://news.ycombinator.com/item?id=${item.id}`,
        score: item.score || 0,
        comments: item.descendants || 0,
        time: item.time,
        by: item.by,
        tags: extractTags(item.title),
      }))
  }

  const fetchDevTo = async (): Promise<Article[]> => {
    const res = await fetch('https://dev.to/api/articles?top=7&per_page=20')
    const list = await res.json()
    return list.map((a: any) => ({
      id: 'devto_' + a.id,
      source: 'devto' as const,
      title: a.title,
      url: a.url,
      score: a.positive_reactions_count || 0,
      comments: a.comments_count || 0,
      time: a.published_at,
      by: a.user?.username,
      tags: a.tag_list || [],
      description: a.description,
    }))
  }

  const RSS_SOURCES = [
    { name: 'TechCrunch', badge: 'TC', url: 'https://techcrunch.com/feed/' },
    { name: 'Ars Technica', badge: 'ARS', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'The Verge', badge: 'VERGE', url: 'https://www.theverge.com/rss/index.xml' },
  ]

  const fetchRSS = async (src: typeof RSS_SOURCES[0]): Promise<Article[]> => {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(src.url)}`
    const res = await fetch(proxy)
    const data = await res.json()
    const doc = new DOMParser().parseFromString(data.contents, 'text/xml')
    return Array.from(doc.querySelectorAll('item, entry'))
      .slice(0, 8)
      .map((item, i) => {
        const title = item.querySelector('title')?.textContent?.replace(/<[^>]*>/g, '').trim() || ''
        const link = (
          item.querySelector('link')?.textContent ||
          item.querySelector('link')?.getAttribute('href') ||
          '#'
        ).trim()
        const date = item.querySelector('pubDate, published, updated')?.textContent || ''
        const desc = (item.querySelector('description, summary')?.textContent || '')
          .replace(/<[^>]*>/g, '').trim().slice(0, 140)
        return {
          id: `rss_${src.badge}_${i}_${Date.now()}`,
          source: 'rss' as const,
          sourceName: src.name,
          sourceBadge: src.badge,
          title, url: link, time: date,
          tags: extractTags(title),
          description: desc,
          score: 0, comments: 0, by: src.name,
        }
      })
  }

  const loadAll = useCallback(async () => {
    setLoading(true)
    setProgress(5)

    const [hnR, dtR, rssR, ghR] = await Promise.allSettled([
      fetchHN(),
      fetchDevTo(),
      Promise.allSettled(RSS_SOURCES.map(fetchRSS)),
      fetch(`https://api.allorigins.win/get?url=${encodeURIComponent('https://github.com/trending')}`)
        .then((r) => r.json())
        .then((d) => {
          const doc = new DOMParser().parseFromString(d.contents, 'text/html')
          const rows = Array.from(doc.querySelectorAll('article.Box-row')).slice(0, 5)
          if (!rows.length) throw new Error('no repos')
          return rows.map((r) => ({
            name: r.querySelector('h2 a')?.getAttribute('href')?.replace(/^\//, '') || '',
            desc: r.querySelector('p')?.textContent?.trim() || '',
            stars: r.querySelector('[href$="/stargazers"]')?.textContent?.trim() || '',
            lang: r.querySelector('[itemprop="programmingLanguage"]')?.textContent?.trim() || '',
            lc: (r.querySelector('.repo-language-color') as HTMLElement)?.style?.background || '#63b3ed',
          })).filter((r) => r.name)
        }),
    ])

    setProgress(75)

    const hn = hnR.status === 'fulfilled' ? hnR.value : []
    const dt = dtR.status === 'fulfilled' ? dtR.value : []
    const rss = rssR.status === 'fulfilled'
      ? rssR.value.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      : []

    const merged = [
      ...hn.sort((a, b) => b.score - a.score),
      ...dt.sort((a, b) => b.score - a.score),
      ...rss,
    ]

    setArticles(merged)
    setTicker(hn.slice(0, 20))
    setDisplayCount(PAGE_SIZE)
    if (ghR.status === 'fulfilled') setRepos(ghR.value as typeof FALLBACK_REPOS)

    setProgress(100)
    setTimeout(() => setProgress(0), 600)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Translation ────────────────────────────────────────
  const translate = useCallback(async (article: Article) => {
    const id = article.id
    if (translations[id]) {
      setTranslations((prev) => ({
        ...prev,
        [id]: { ...prev[id], visible: !prev[id].visible },
      }))
      return
    }
    setTranslations((prev) => ({ ...prev, [id]: { title: '翻訳中...', summary: '', visible: true } }))
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: article.title, description: article.description }),
      })
      const data = await res.json()
      setTranslations((prev) => ({ ...prev, [id]: { ...data, visible: true } }))
    } catch {
      setTranslations((prev) => ({
        ...prev,
        [id]: { title: 'APIキーを設定すると翻訳されます', summary: '', visible: true },
      }))
    }
  }, [translations])

  // ── Q&A ───────────────────────────────────────────────
  const saveQA = useCallback((qs: Question[]) => {
    try { localStorage.setItem('codewire_qa', JSON.stringify(qs)) } catch {}
  }, [])

  const postQuestion = useCallback(() => {
    const title = qTitleRef.current?.value.trim() || ''
    if (!title) { showToast('タイトルを入力してください', 'info'); return }
    const body = qBodyRef.current?.value.trim() || ''
    const tagsRaw = qTagsRef.current?.value.trim() || ''
    const tags = tagsRaw.split(/[\s,#]+/).filter(Boolean).map((t) => t.replace('#', ''))
    const q: Question = { id: 'q_' + Date.now(), title, body, tags, votes: 0, by: 'あなた', time: Date.now(), answers: [], aiAnswer: null }
    const next = [q, ...questions]
    setQuestions(next); saveQA(next)
    if (qTitleRef.current) qTitleRef.current.value = ''
    if (qBodyRef.current) qBodyRef.current.value = ''
    if (qTagsRef.current) qTagsRef.current.value = ''
    showToast('質問を投稿しました！', 'success')
  }, [questions, saveQA, showToast])

  const voteQuestion = useCallback((id: string, delta: number) => {
    setQuestions((prev) => {
      const next = prev.map((q) => q.id === id ? { ...q, votes: q.votes + delta } : q)
      saveQA(next); return next
    })
  }, [saveQA])

  const askAI = useCallback(async (q: Question) => {
    setAiLoading((prev) => new Set(prev).add(q.id))
    try {
      const res = await fetch('/api/ask-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: q.title, body: q.body, tags: q.tags }),
      })
      const data = await res.json()
      const answer = data.answer || 'APIキーを設定するとAIが回答します。'
      setAiAnswers((prev) => ({ ...prev, [q.id]: answer }))
      setQuestions((prev) => {
        const next = prev.map((item) => item.id === q.id ? { ...item, aiAnswer: answer } : item)
        saveQA(next); return next
      })
    } catch {
      setAiAnswers((prev) => ({ ...prev, [q.id]: 'APIキーを設定するとAIが回答します。' }))
    }
    setAiLoading((prev) => { const s = new Set(prev); s.delete(q.id); return s })
  }, [saveQA])

  const submitAnswer = useCallback((qId: string, text: string) => {
    if (!text.trim()) return
    setQuestions((prev) => {
      const next = prev.map((q) =>
        q.id === qId
          ? { ...q, answers: [...q.answers, { id: 'a_' + Date.now(), text, votes: 0, best: false, by: 'あなた', time: Date.now() }] }
          : q
      )
      saveQA(next); return next
    })
    showToast('回答を投稿しました！', 'success')
  }, [saveQA, showToast])

  // ── Filtered articles ──────────────────────────────────
  const filtered = articles
    .filter((a) => filter === 'all' || a.source === filter)
    .filter((a) => {
      if (activeTags.size === 0) return true
      const tl = (a.title || '').toLowerCase()
      return [...activeTags].some((t) => (a.tags || []).some((at) => at.includes(t) || t.includes(at)) || tl.includes(t))
    })

  const displayed = filtered.slice(0, displayCount)
  const hasMore = displayCount < filtered.length

  // ── QA filtered ────────────────────────────────────────
  const filteredQs = questions
    .filter((q) => qaFilter === 'unanswered' ? q.answers.length === 0 : true)
    .sort((a, b) => qaFilter === 'hot' ? b.votes - a.votes : b.time - a.time)

  // ── Render ─────────────────────────────────────────────
  const LANG_COLORS: Record<string, string> = {
    TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572a5',
    Go: '#00add8', Rust: '#dea584', 'C++': '#f34b7d',
  }

  return (
    <>
      {/* PROGRESS */}
      <div id="progressLine" style={{ width: progress + '%' }} />

      {/* TOAST */}
      <div className={`toast ${toast.type} ${toast.show ? 'show' : ''}`}>{toast.msg}</div>

      {/* HEADER */}
      <header>
        <div className="header-inner">
          <div className="logo" onClick={() => setPage('feed')}>
            <div className="logo-mark">C</div>
            <div className="logo-text">Code<span>Wire</span></div>
          </div>
          <nav className="header-nav">
            <button className={`nav-btn ${page === 'feed' ? 'active' : ''}`} onClick={() => setPage('feed')}>FEED</button>
            <button className={`nav-btn ${page === 'qa' ? 'active' : ''}`} onClick={() => setPage('qa')}>Q&amp;A</button>
            <button className={`nav-btn ${page === 'bookmarks' ? 'active' : ''}`} onClick={() => setPage('bookmarks')}>BOOKMARKS</button>
          </nav>
          <div className="header-actions">
            <div className="live-badge"><div className="live-dot" />LIVE</div>
            <div className="bm-count-badge" onClick={() => setPage('bookmarks')}>☆ {bookmarks.length}</div>
          </div>
        </div>
      </header>

      {/* TICKER */}
      <div className="ticker-wrap">
        <span className="ticker-label">HOT</span>
        <div className="ticker-scroll">
          <div className="ticker-inner">
            {[...ticker, ...ticker].map((a, i) => (
              <span key={i} className="ticker-item" onClick={() => window.open(a.url, '_blank')}>
                {a.title} <span style={{ color: 'var(--bg4)', margin: '0 6px' }}>·</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ============ FEED PAGE ============ */}
      <div className={`page-view ${page === 'feed' ? 'active' : ''}`}>
        <div className="layout">
          <div>
            <div className="sec-head">
              <div className="sec-title">LATEST ARTICLES</div>
              <button className="icon-btn" onClick={loadAll} style={loading ? { animation: 'spin 0.8s linear infinite' } : {}}>↺ REFRESH</button>
            </div>
            <div className="filter-bar">
              {['all', 'hn', 'devto', 'rss'].map((f) => (
                <button key={f} className={`filter-btn ${filter === f ? 'active' : ''}`} onClick={() => { setFilter(f); setDisplayCount(PAGE_SIZE) }}>
                  {f === 'all' ? 'ALL' : f === 'hn' ? 'HACKER NEWS' : f === 'devto' ? 'DEV.TO' : 'TECH MEDIA'}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="articles-list">
                {[1,2,3,4,5].map((i) => (
                  <div key={i} className="skeleton-card">
                    <div className="sk h12 w30" /><div className="sk h16 w80" /><div className="sk h12 w60" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="articles-list">
                {displayed.map((a, idx) => {
                  const tr = translations[a.id]
                  const isSaved = bookmarks.some((b) => b.id === a.id)
                  const badgeCls = { hn: 'badge-hn', devto: 'badge-devto', rss: 'badge-rss' }[a.source]
                  const badgeLabel = { hn: 'HN', devto: 'DEV.TO', rss: a.sourceBadge || 'RSS' }[a.source]
                  return (
                    <div key={a.id} className={`article-card src-${a.source}`} style={{ animationDelay: `${Math.min(idx, 20) * 0.03}s` }}>
                      <div className="card-top">
                        <span className={`src-badge ${badgeCls}`}>{badgeLabel}</span>
                        <span className="card-time">{timeAgo(a.time)}</span>
                        <div className="card-tags">{a.tags.slice(0, 3).map((t) => <span key={t} className="ctag">#{t}</span>)}</div>
                      </div>
                      <div className="card-title" onClick={() => window.open(a.url, '_blank')}>{a.title}</div>
                      {tr?.visible && (
                        <>
                          <div className="card-ja visible">{tr.title}</div>
                          {tr.summary && <div className="card-summary visible">{tr.summary}</div>}
                        </>
                      )}
                      <div className="card-bottom">
                        {a.source === 'hn' && <>
                          <span className="cstat">▲ <span className="cstat-val">{a.score}</span></span>
                          <span className="cstat">💬 <span className="cstat-val">{a.comments}</span></span>
                          {a.by && <span className="cstat">by <span className="cstat-val">{a.by}</span></span>}
                        </>}
                        {a.source === 'devto' && <>
                          <span className="cstat">❤ <span className="cstat-val">{a.score}</span></span>
                          <span className="cstat">💬 <span className="cstat-val">{a.comments}</span></span>
                        </>}
                        {a.source === 'rss' && <span className="cstat">📰 <span className="cstat-val">{a.sourceName}</span></span>}
                        <div className="card-actions">
                          <button
                            className={`btn-translate ${tr ? 'done' : ''}`}
                            onClick={() => translate(a)}
                          >
                            {tr ? (tr.visible ? '✓ 非表示' : '✓ 表示') : '🌐 日本語'}
                          </button>
                          <button className={`btn-bookmark ${isSaved ? 'saved' : ''}`} onClick={() => toggleBookmark(a)}>☆</button>
                          <a className="btn-open" href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>OPEN ↗</a>
                          {a.hnUrl && <a className="btn-open" href={a.hnUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>HN ↗</a>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {hasMore && !loading && (
              <button className="load-more-btn" onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}>
                [ LOAD MORE ]
              </button>
            )}
          </div>

          {/* SIDEBAR */}
          <div className="sidebar">
            <div className="widget">
              <div className="widget-head">FEED STATS</div>
              <div className="stats-grid">
                <div className="stat-cell"><div className="stat-num">{articles.length}</div><div className="stat-lbl">TOTAL</div></div>
                <div className="stat-cell"><div className="stat-num">3</div><div className="stat-lbl">SOURCES</div></div>
                <div className="stat-cell"><div className="stat-num">{articles.filter((a) => a.source === 'hn').length}</div><div className="stat-lbl">HN</div></div>
                <div className="stat-cell"><div className="stat-num">{articles.filter((a) => a.source === 'devto').length}</div><div className="stat-lbl">DEV.TO</div></div>
              </div>
            </div>

            <div className="widget">
              <div className="widget-head">GITHUB TRENDING</div>
              {repos.map((r) => (
                <div key={r.name} className="repo-row" onClick={() => window.open(`https://github.com/${r.name}`, '_blank')}>
                  <div className="repo-name-line">⬡ <a href={`https://github.com/${r.name}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{r.name}</a></div>
                  <div className="repo-desc-line">{r.desc}</div>
                  <div className="repo-stats-line">
                    {r.lang && <span className="r-stat"><span className="lang-dot" style={{ background: LANG_COLORS[r.lang] || r.lc }} />{r.lang}</span>}
                    {r.stars && <span className="r-stat">⭐ {r.stars}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="widget">
              <div className="widget-head">FILTER BY TAG</div>
              <div className="tags-wrap">
                {Object.keys(TAG_MAP).map((tag) => (
                  <span key={tag} className={`tag-pill ${activeTags.has(tag) ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTags((prev) => {
                        const s = new Set(prev)
                        s.has(tag) ? s.delete(tag) : s.add(tag)
                        return s
                      })
                      setDisplayCount(PAGE_SIZE)
                    }}
                  >{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ Q&A PAGE ============ */}
      <div className={`page-view ${page === 'qa' ? 'active' : ''}`}>
        <div className="qa-layout">
          <div>
            <div className="qa-post-form">
              <div className="qa-form-title">NEW QUESTION</div>
              <input ref={qTitleRef} className="qa-input" type="text" placeholder="質問のタイトルを入力してください" />
              <textarea ref={qBodyRef} className="qa-input" rows={3} placeholder="質問の詳細（環境・バージョン・試したことなど）" />
              <input ref={qTagsRef} className="qa-tags-input" type="text" placeholder="#javascript  #react" />
              <button className="qa-submit-btn" onClick={postQuestion}>SUBMIT QUESTION →</button>
            </div>

            <div className="qa-filter-bar">
              {[['all', 'ALL'], ['unanswered', 'UNANSWERED'], ['hot', 'HOT']].map(([f, label]) => (
                <button key={f} className={`filter-btn ${qaFilter === f ? 'active' : ''}`} onClick={() => setQaFilter(f)}>{label}</button>
              ))}
            </div>

            <div>
              {filteredQs.map((q, idx) => {
                const isOpen = openQuestions.has(q.id)
                const ai = aiAnswers[q.id] || q.aiAnswer || ''
                const isAiLoading = aiLoading.has(q.id)
                const answerInputRef = (el: HTMLTextAreaElement | null) => {
                  if (el) el.dataset.qid = q.id
                }
                return (
                  <div key={q.id} className={`q-card ${isOpen ? 'open' : ''}`} style={{ animationDelay: `${idx * 0.04}s` }}>
                    <div className="q-head" onClick={() => setOpenQuestions((prev) => {
                      const s = new Set(prev); s.has(q.id) ? s.delete(q.id) : s.add(q.id); return s
                    })}>
                      <div className="q-votes">
                        <button className="vote-btn" onClick={(e) => { e.stopPropagation(); voteQuestion(q.id, 1) }}>▲</button>
                        <div className={`vote-num ${q.votes > 0 ? 'has-votes' : ''}`}>{q.votes}</div>
                        <div className="vote-lbl">VOTES</div>
                        <button className="vote-btn" onClick={(e) => { e.stopPropagation(); voteQuestion(q.id, -1) }}>▼</button>
                      </div>
                      <div className="q-body">
                        <div className="q-title">{q.title}</div>
                        <div className="q-meta">
                          {q.tags.map((t) => <span key={t} className="q-tag">#{t}</span>)}
                          <span className="q-info">{q.by} · {timeAgo(q.time)}</span>
                          <span className="q-ans-count">{q.answers.length} ANSWERS</span>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="q-ai-area open">
                        {q.body && <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 12, padding: '10px 14px', background: 'var(--bg)', borderRadius: 4 }}>{q.body}</p>}

                        {ai && (
                          <div className="ai-answer-box">
                            <div className="ai-answer-head"><div className="ai-dot" />CLAUDE AI ANSWER</div>
                            <div className="ai-answer-text">{ai}</div>
                          </div>
                        )}
                        <button
                          style={{ marginBottom: 12, background: 'rgba(183,148,244,0.08)', border: '1px solid rgba(183,148,244,0.2)', color: 'var(--purple)', fontFamily: 'JetBrains Mono,monospace', fontSize: 10, padding: '6px 14px', borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => askAI(q)}
                          disabled={isAiLoading}
                        >
                          🤖 {isAiLoading ? '⟳ AI回答生成中...' : ai ? 'AI回答を再生成' : 'AIに回答してもらう'}
                        </button>

                        <div className="human-answers">
                          {q.answers.map((a) => (
                            <div key={a.id} className="h-answer">
                              <div className="h-answer-meta">
                                <span>{a.by}</span><span>{timeAgo(a.time)}</span><span>▲ {a.votes}</span>
                                {a.best && <span className="best-badge">✓ BEST</span>}
                              </div>
                              <div className="h-answer-text">{a.text}</div>
                            </div>
                          ))}
                        </div>

                        <div className="answer-form">
                          <textarea
                            className="answer-textarea"
                            id={`ans-${q.id}`}
                            ref={answerInputRef}
                            placeholder="回答を入力してください..."
                          />
                          <button className="answer-submit-btn" onClick={() => {
                            const ta = document.getElementById(`ans-${q.id}`) as HTMLTextAreaElement
                            if (ta) { submitAnswer(q.id, ta.value); ta.value = '' }
                          }}>POST ANSWER →</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="qa-sidebar">
            <div className="qa-sidebar-widget">
              <div className="widget-head">Q&amp;A STATS</div>
              <div className="stats-grid">
                <div className="stat-cell"><div className="stat-num">{questions.length}</div><div className="stat-lbl">QUESTIONS</div></div>
                <div className="stat-cell"><div className="stat-num">{questions.reduce((s, q) => s + q.answers.length, 0)}</div><div className="stat-lbl">ANSWERS</div></div>
              </div>
            </div>
            <div className="qa-sidebar-widget">
              <div className="widget-head">POPULAR TAGS</div>
              <div className="tags-wrap">
                {['javascript', 'python', 'ai', 'react', 'typescript', 'docker', 'go', 'rust'].map((t) => (
                  <span key={t} className="tag-pill">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOOKMARKS PAGE ============ */}
      <div className={`page-view ${page === 'bookmarks' ? 'active' : ''}`}>
        <div className="bookmarks-layout">
          <div className="sec-head" style={{ marginBottom: 14 }}>
            <div className="sec-title">SAVED ARTICLES</div>
            <button className="icon-btn" onClick={() => { setBookmarks([]); saveBookmarks([]); showToast('クリアしました', 'info') }}>✕ CLEAR ALL</button>
          </div>
          {bookmarks.length === 0 ? (
            <div className="bm-empty"><span>☆</span>// No bookmarks yet<br />記事カードの ☆ ボタンで保存できます</div>
          ) : (
            <div className="articles-list">
              {bookmarks.map((a, idx) => {
                const tr = translations[a.id]
                const badgeCls = { hn: 'badge-hn', devto: 'badge-devto', rss: 'badge-rss' }[a.source]
                const badgeLabel = { hn: 'HN', devto: 'DEV.TO', rss: a.sourceBadge || 'RSS' }[a.source]
                return (
                  <div key={a.id} className={`article-card src-${a.source}`} style={{ animationDelay: `${idx * 0.03}s` }}>
                    <div className="card-top">
                      <span className={`src-badge ${badgeCls}`}>{badgeLabel}</span>
                      <span className="card-time">{timeAgo(a.time)}</span>
                      <div className="card-tags">{a.tags.slice(0, 3).map((t) => <span key={t} className="ctag">#{t}</span>)}</div>
                    </div>
                    <div className="card-title" onClick={() => window.open(a.url, '_blank')}>{a.title}</div>
                    {tr?.visible && <div className="card-ja visible">{tr.title}</div>}
                    <div className="card-bottom">
                      <div className="card-actions">
                        <button className={`btn-translate ${tr ? 'done' : ''}`} onClick={() => translate(a)}>
                          {tr ? (tr.visible ? '✓ 非表示' : '✓ 表示') : '🌐 日本語'}
                        </button>
                        <button className="btn-bookmark saved" onClick={() => toggleBookmark(a)}>☆</button>
                        <a className="btn-open" href={a.url} target="_blank" rel="noreferrer">OPEN ↗</a>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
