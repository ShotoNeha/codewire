import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { title, body, tags } = await req.json()

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
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
    })

    const answer = message.content[0].type === 'text' ? message.content[0].text : ''
    return NextResponse.json({ answer })
  } catch (error) {
    console.error('AI answer error:', error)
    return NextResponse.json(
      { error: 'AI answer failed' },
      { status: 500 }
    )
  }
}
