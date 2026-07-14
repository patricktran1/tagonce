import { platformMeta } from '../data/demo';
import { generateAllVariants } from './contentEngine';
import type {
  BrandSettings,
  GenerationSource,
  MentionEntity,
  Platform,
  PlatformVariant,
} from '../types';

interface AiVariantPayload {
  platform: Platform;
  title: string;
  body: string;
  hashtags: string[];
  format: string;
}

interface AiGenerationResponse {
  variants: AiVariantPayload[];
  model?: string;
}

export interface GenerationResult {
  variants: PlatformVariant[];
  source: GenerationSource;
  notice?: string;
}

function trimToLimit(text: string, limit?: number) {
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

function ensureMentionTokens(body: string, fallback: PlatformVariant) {
  const missing = fallback.mentionResolutions.filter(
    (resolution) =>
      resolution.renderedText &&
      !body.toLowerCase().includes(resolution.renderedText.toLowerCase()),
  );

  if (missing.length === 0) return body;
  return `${body.trim()}\n\nWith ${missing.map((item) => item.renderedText).join(', ')}.`;
}

export function mergeAiVariants(
  aiVariants: AiVariantPayload[],
  fallbackVariants: PlatformVariant[],
): PlatformVariant[] {
  return fallbackVariants.map((fallback) => {
    const ai = aiVariants.find((variant) => variant.platform === fallback.platform);
    if (!ai?.body?.trim()) return { ...fallback, generatedBy: 'rules' };

    const bodyWithMentions = ensureMentionTokens(ai.body.trim(), fallback);
    const body = trimToLimit(bodyWithMentions, platformMeta[fallback.platform].limit);
    const hashtags = Array.isArray(ai.hashtags)
      ? ai.hashtags
          .map((tag) => tag.trim())
          .filter(Boolean)
          .map((tag) => (tag.startsWith('#') ? tag : `#${tag.replace(/^#+/, '')}`))
      : fallback.hashtags;

    return {
      ...fallback,
      body,
      title: ai.title?.trim() || fallback.title,
      hashtags: hashtags.length ? hashtags : fallback.hashtags,
      format: ai.format?.trim() || fallback.format,
      characterCount: body.length,
      generatedBy: 'ai',
    };
  });
}

export async function generateCampaignVariants(
  platforms: Platform[],
  masterText: string,
  entities: MentionEntity[],
  brand: BrandSettings,
): Promise<GenerationResult> {
  const fallbackVariants = generateAllVariants(platforms, masterText, entities, brand).map(
    (variant) => ({ ...variant, generatedBy: 'rules' as const }),
  );

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platforms,
        masterText,
        brand,
        mentions: entities.map((entity) => ({
          displayName: entity.displayName,
          type: entity.type,
          platformTokens: Object.fromEntries(
            platforms.map((platform) => [
              platform,
              entity.mappings[platform]?.handle ?? entity.displayName,
            ]),
          ),
        })),
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || `Generation request failed (${response.status})`);
    }

    const payload = (await response.json()) as AiGenerationResponse;
    return {
      variants: mergeAiVariants(payload.variants ?? [], fallbackVariants),
      source: 'ai',
      notice: payload.model ? `Generated with ${payload.model}` : 'Generated with AI',
    };
  } catch (error) {
    return {
      variants: fallbackVariants,
      source: 'rules',
      notice:
        error instanceof Error
          ? `AI unavailable, so TagOnce used its built-in formatting engine. ${error.message}`
          : 'AI unavailable, so TagOnce used its built-in formatting engine.',
    };
  }
}
