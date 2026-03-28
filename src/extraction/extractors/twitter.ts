import type { ContentExtractor, ExtractedContent } from '../../types/index.js'
import { ExtractionError } from '../../utils/errors.js'

const FXTWITTER_API = 'https://api.fxtwitter.com/status'
const TWEET_ID_PATTERN = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/

interface FxTweetMedia {
  type: string
  altText?: string
}

interface FxTweet {
  id: string
  text: string
  author: { name: string; screen_name: string }
  created_at: string
  replies?: number
  retweets?: number
  likes?: number
  views?: number
  media?: { photos?: FxTweetMedia[]; videos?: FxTweetMedia[] }
  thread?: FxTweet[]
}

interface FxTwitterResponse {
  code: number
  message: string
  tweet?: FxTweet
}

export const twitterExtractor: ContentExtractor = {
  name: 'twitter',
  priority: 100,

  canHandle(url: URL): boolean {
    return url.hostname === 'twitter.com' || url.hostname === 'x.com'
  },

  async extract(url: URL): Promise<ExtractedContent> {
    const match = url.toString().match(TWEET_ID_PATTERN)
    if (!match?.[1]) {
      throw new ExtractionError('Could not parse tweet ID from URL', url.toString(), 'twitter')
    }

    const tweetId = match[1]
    const apiUrl = `${FXTWITTER_API}/${tweetId}`

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Atlas/1.0' },
    })

    if (!response.ok) {
      throw new ExtractionError(
        `fxtwitter API returned ${response.status}`,
        url.toString(),
        'twitter',
      )
    }

    const data = (await response.json()) as FxTwitterResponse

    if (data.code !== 200 || !data.tweet) {
      throw new ExtractionError(
        `fxtwitter API error: ${data.message}`,
        url.toString(),
        'twitter',
      )
    }

    const tweet = data.tweet
    const author = `@${tweet.author.screen_name}`
    const title = `${tweet.author.name} (${author}): ${tweet.text.slice(0, 80)}...`

    const body = buildThreadBody(tweet)

    return {
      url: url.toString(),
      title: title.slice(0, 200),
      body,
      metadata: {
        author,
        platform: 'twitter',
        tweetId,
        tweetCount: String(tweet.thread ? tweet.thread.length + 1 : 1),
      },
      extractedAt: new Date().toISOString(),
      extractorName: 'twitter',
    }
  },
}

function buildThreadBody(tweet: FxTweet): string {
  const lines: string[] = []
  const author = `@${tweet.author.screen_name}`

  if (tweet.thread && tweet.thread.length > 0) {
    lines.push(`**Thread by ${author} (${tweet.thread.length + 1} tweets)**\n`)
    lines.push(`1. ${tweet.text}`)
    tweet.thread.forEach((t, i) => {
      lines.push(`${i + 2}. ${t.text}`)
    })
  } else {
    lines.push(`**Tweet by ${author}**\n`)
    lines.push(tweet.text)
  }

  return lines.join('\n')
}
