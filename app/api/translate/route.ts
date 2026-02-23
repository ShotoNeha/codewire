import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { title, description } = await req.json()

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
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content: `以下の英語のテック記事タイトルを日本語に翻訳し、エンジニア向けの実務的な要約（2〜3文）も生成してください。

タイトル: ${title}
${description ? `説明: ${description}` : ''}

以下のJSON形式のみで回答してください（他のテキスト不要）:
{"title": "日本語タイトル", "summary": "日本語要約（2〜3文）"}`,
          },
        ],
      }),
    })

    const data = await response.json()
    const raw = data?.content?.[0]?.text || ''
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(jsonStr)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: 'Translation failed' },
      { status: 500 }
    )
  }
}
