import { describe, expect, it } from 'vitest';
import { demoEntities, defaultBrandSettings } from '../data/demo';
import { generateAllVariants } from './contentEngine';
import { mergeAiVariants } from './generationService';

const fallback = generateAllVariants(
  ['linkedin', 'x'],
  'AION EHR is launching a smarter workflow.',
  [demoEntities[0]],
  defaultBrandSettings,
);

describe('mergeAiVariants', () => {
  it('keeps deterministic mention metadata while using AI copy', () => {
    const result = mergeAiVariants(
      [
        {
          platform: 'linkedin',
          title: '',
          body: 'A cleaner workflow is coming for modern clinical teams.',
          hashtags: ['HealthTech', '#AI'],
          format: 'LinkedIn launch post',
        },
      ],
      fallback,
    );

    expect(result[0].generatedBy).toBe('ai');
    expect(result[0].body).toContain('@AIONEHR');
    expect(result[0].mentionResolutions).toEqual(fallback[0].mentionResolutions);
    expect(result[0].hashtags).toEqual(['#HealthTech', '#AI']);
  });

  it('uses the built-in variant when the AI omits a requested platform', () => {
    const result = mergeAiVariants([], fallback);
    expect(result.every((variant) => variant.generatedBy === 'rules')).toBe(true);
  });
});
