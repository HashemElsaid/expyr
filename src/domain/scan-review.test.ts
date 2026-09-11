import { describe, expect, it } from 'vitest';

import { needsTypeConfirmation, titleAfterCorrection } from '@/domain/scan-review';

describe('when to ask what the document is', () => {
  it('does not interrupt a scan that was sure', () => {
    expect(needsTypeConfirmation('high')).toBe(false);
  });

  it('asks when the service was hedging', () => {
    expect(needsTypeConfirmation('medium')).toBe(true);
    expect(needsTypeConfirmation('low')).toBe(true);
  });

  /*
   * A service that has never heard of the question. Asking about every scan it
   * returns would punish the person for our deploy order.
   */
  it('asks nothing of a service too old to answer', () => {
    expect(needsTypeConfirmation(undefined)).toBe(false);
  });
});

describe('the title after a category is corrected', () => {
  /* The scan that started all of this, on a passport. */
  it('drops a title that names the category we got wrong', () => {
    expect(
      titleAfterCorrection('Residence Visa for AEHED SAID SHERIF', 'Residence Visa', 'Passport')
    ).toBe('Passport');
  });

  it('does not care how the model capitalised it', () => {
    expect(titleAfterCorrection('Residence visa, Dubai', 'Residence Visa', 'Passport')).toBe(
      'Passport'
    );
  });

  /*
   * The other half, and the reason this is not just "always retitle". A scan
   * that found the make and model of the car knows something the category
   * label never will.
   */
  it('keeps a title that says more than the category does', () => {
    expect(titleAfterCorrection('Toyota Corolla registration', 'Car Insurance', 'Car Registration'))
      .toBe('Toyota Corolla registration');
  });

  it('names the chosen category when there is no title at all', () => {
    expect(titleAfterCorrection('', 'Passport', 'Emirates ID')).toBe('Emirates ID');
    expect(titleAfterCorrection('   ', 'Passport', 'Emirates ID')).toBe('Emirates ID');
  });

  it('trims what it keeps', () => {
    expect(titleAfterCorrection('  Marina Heights tenancy  ', 'Trade License', 'Tenancy')).toBe(
      'Marina Heights tenancy'
    );
  });
});
