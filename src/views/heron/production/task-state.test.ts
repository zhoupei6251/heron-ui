import { describe, expect, it } from 'vitest';
import { isProductionActive } from './task-state';

describe('task status', () => {
  it('keeps cancelling active until actual termination', () => {
    expect(isProductionActive('cancelling')).toBe(true);
    expect(isProductionActive('cancelled')).toBe(false);
    expect(isProductionActive('failed')).toBe(false);
  });

  it('treats queued and running as active', () => {
    expect(isProductionActive('queued')).toBe(true);
    expect(isProductionActive('running')).toBe(true);
    expect(isProductionActive('succeeded')).toBe(false);
  });
});
