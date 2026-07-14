type Platform =
  | 'facebook'
  | 'linkedin'
  | 'instagram'
  | 'x'
  | 'threads'
  | 'tiktok'
  | 'youtube';

interface GenerateRequest {
  platforms: Platform[];
  masterText: string;
  brand: {
    brandName: string;
    audience: string;
    voice: string;
    defaultCta: string;
    preferredHashtags: string;
  };
  mentions: Array<{
    displayName: string;
    type: string;
    platformTokens: Partial<Record<Platform, string>>;
  }>;
}

const allowedPlatforms = new Set<Platform>([
  'facebook',
  'linkedin',
  'instagram',
  'x',
  'threads',
  'tiktok',
  'youtube',
]);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function extractOutputText(payload: Record<string, unknown>): string | null {
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown[] }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (
        part &&
        typeof part === 'object' &&
        (part as { type?: string }).type === 'output_text' &&
        typeof (part as { text?: unknown }).text === 'string'
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(
        { error: 'OPENAI_API_KEY is not configured. Built-in generation remains available.' },
        503,
      );
    }

    let body: GenerateRequest;
    try {
      body = (await request.json()) as GenerateRequest;
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const platforms = Array.isArray(body.platforms)
      ? body.platforms.filter((platform): platform is Platform => allowedPlatforms.has(platform))
      : [];
    const masterText = typeof body.masterText === 'string' ? body.masterText.trim() : '';

    if (!masterText || masterText.length > 12_000 || platforms.length === 0) {
      return json({ error: 'A post and at least one valid platform are required.' }, 400);
    }

    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const mentionRules = (body.mentions ?? [])
      .map((mention) => {
        const tokens = platforms
          .map((platform) => `${platform}: ${mention.platformTokens?.[platform] ?? mention.displayName}`)
          .join(', ');
        return `${mention.displayName} (${mention.type}) => ${tokens}`;
      })
      .join('\n');

    const systemPrompt = `You are the content transformation engine for TagOnce. Convert one master post into native-feeling social posts. Preserve factual meaning. Do not invent partnerships, achievements, statistics, endorsements, or claims. Use the exact platform-specific mention tokens supplied. Never replace them with guessed handles. Adapt structure and length to each platform. Facebook can be conversational and longer. LinkedIn should be professional and readable with short paragraphs. Instagram should be caption-forward. X must be concise. Threads should be conversational. TikTok should include a hook and short script. YouTube should include a strong title and description. Hashtags must be relevant and restrained.`;

    const userPrompt = `MASTER POST:\n${masterText}\n\nBRAND:\nName: ${body.brand?.brandName ?? ''}\nAudience: ${body.brand?.audience ?? ''}\nVoice: ${body.brand?.voice ?? ''}\nCTA: ${body.brand?.defaultCta ?? ''}\nPreferred hashtags: ${body.brand?.preferredHashtags ?? ''}\n\nPLATFORMS:\n${platforms.join(', ')}\n\nEXACT MENTION TOKENS BY PLATFORM:\n${mentionRules || 'No mentions selected.'}`;

    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        variants: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              platform: { type: 'string', enum: platforms },
              title: { type: 'string' },
              body: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
              format: { type: 'string' },
            },
            required: ['platform', 'title', 'body', 'hashtags', 'format'],
          },
        },
      },
      required: ['variants'],
    };

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'tagonce_campaign_variants',
            strict: true,
            schema,
          },
        },
        max_output_tokens: 5000,
      }),
    });

    const payload = (await openAiResponse.json().catch(() => ({}))) as Record<string, unknown>;
    if (!openAiResponse.ok) {
      const error = payload.error as { message?: string } | undefined;
      return json({ error: error?.message || 'OpenAI generation failed.' }, openAiResponse.status);
    }

    const outputText = extractOutputText(payload);
    if (!outputText) {
      return json({ error: 'The model returned no structured content.' }, 502);
    }

    try {
      const generated = JSON.parse(outputText) as { variants?: unknown[] };
      return json({ variants: generated.variants ?? [], model });
    } catch {
      return json({ error: 'The model returned invalid structured content.' }, 502);
    }
  },
};
