import { describe, expect, it } from 'vitest';
import { defaultBrandSettings, demoEntities } from '../data/demo';
import { generateVariant, resolveMention } from './contentEngine';

describe('mention resolver', () => {
  it('resolves a verified platform mapping', () => {
    const result = resolveMention(demoEntities[0], 'linkedin');
    expect(result.status).toBe('resolved');
    expect(result.renderedText).toBe('@AIONEHR');
  });

  it('flags a missing platform mapping', () => {
    const result = resolveMention(demoEntities[2], 'facebook');
    expect(result.status).toBe('missing');
  });
});

describe('content generation', () => {
  it('keeps X variants within the platform limit', () => {
    const variant = generateVariant(
      'x',
      'AION EHR is launching a unified publishing workflow that removes repetitive formatting and account tagging from every campaign. '.repeat(5),
      [demoEntities[0]],
      defaultBrandSettings,
    );
    expect(variant.body.length).toBeLessThanOrEqual(280);
  });
});
