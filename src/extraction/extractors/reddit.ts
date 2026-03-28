import type { ContentExtractor, ExtractedContent } from '../../types/index.js'
import { ExtractionError } from '../../utils/errors.js'

const MAX_COMMENTS = 10
const REDDIT_PATTERN = /reddit\.com\/r\/[\w]+\/comments\//

interface RedditPost {
  title: string
  selftext: string
  author: string
  subreddit: string
  score: number
  url: string
  num_comments: number
}

interface RedditComment {
  body: string
  author: string
  score: number
  replies?: { data?: { children?: RedditChild[] } }
}

interface RedditChild {
  kind: string
  data: RedditPost | RedditComment
}

interface RedditListing {
  data: { children: RedditChild[] }
}

export const redditExtractor: ContentExtractor = {
  name: 'reddit',
  priority: 100,

  canHandle(url: URL): boolean {
    return url.hostname === 'www.reddit.com' || url.hostname === 'reddit.com' || url.hostname === 'old.reddit.com'
  },

  async extract(url: URL): Promise<ExtractedContent> {
    if (!REDDIT_PATTERN.test(url.toString())) {
      throw new ExtractionError(
        'URL does not look like a Reddit post',
        url.toString(),
        'reddit',
      )
    }

    // Normalize to www.reddit.com and append .json
    const normalized = url.toString()
      .replace('old.reddit.com', 'www.reddit.com')
      .replace(/\?.*$/, '')
      .replace(/\/$/, '')
    const jsonUrl = `${normalized}.json`

    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Atlas/1.0 (personal knowledge tool)',
      },
    })

    if (!response.ok) {
      throw new ExtractionError(
        `Reddit returned ${response.status}`,
        url.toString(),
        'reddit',
      )
    }

    const data = (await response.json()) as RedditListing[]

    if (!Array.isArray(data) || data.length < 1) {
      throw new ExtractionError('Unexpected Reddit response format', url.toString(), 'reddit')
    }

    const postData = data[0]?.data?.children?.[0]?.data as RedditPost | undefined
    if (!postData) {
      throw new ExtractionError('Could not parse Reddit post data', url.toString(), 'reddit')
    }

    const title = postData.title
    const subreddit = postData.subreddit
    const author = `u/${postData.author}`

    const lines: string[] = []
    lines.push(`**r/${subreddit}** — posted by ${author}`)
    lines.push('')

    if (postData.selftext?.trim()) {
      lines.push(postData.selftext.trim())
      lines.push('')
    }

    // Add top comments
    const commentsListing = data[1]?.data?.children ?? []
    const topComments = commentsListing
      .filter((c) => c.kind === 't1')
      .slice(0, MAX_COMMENTS)
      .map((c) => c.data as RedditComment)

    if (topComments.length > 0) {
      lines.push('**Top Comments:**')
      topComments.forEach((comment, i) => {
        if (comment.body && comment.body !== '[deleted]') {
          lines.push(`${i + 1}. u/${comment.author}: ${comment.body.slice(0, 500)}`)
        }
      })
    }

    const body = lines.join('\n').slice(0, 50_000)

    return {
      url: url.toString(),
      title: title.slice(0, 200),
      body,
      metadata: {
        author,
        platform: 'reddit',
        subreddit,
        commentCount: String(postData.num_comments),
      },
      extractedAt: new Date().toISOString(),
      extractorName: 'reddit',
    }
  },
}
