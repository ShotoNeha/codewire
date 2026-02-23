import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { title, body, tags } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [
          {
            role: 'user',
            content: `あなたは経験豊富なソフトウェアエンジニアです。以下の質問に日本語で実践的に回答してください。

質問: ${title}
${body ? `詳細: ${body}` : ''}
${tags?.length ? `タグ: ${tags.join(', ')}` : ''}

具体的なコード例や参考情報を交えながら、400字程度で回答してください。`,
          },
        ],
      }),
    })

    const data = await response.json()
    const answer = data?.content?.[0]?.text || ''
    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI answer error:', error)
    return NextResponse.json(
      { error: 'AI answer failed' },
      { status: 500 }
    )
  }
}
