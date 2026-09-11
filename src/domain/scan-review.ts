/**
 * What to do about a scan the service was not sure of.
 *
 * Three people scanned a passport in one afternoon and got back an Emirates ID
 * once and a residence visa twice. The service now says how sure it is of the
 * category, separately from how sure it is of the date, and these are the two
 * decisions the add screen makes with that.
 *
 * A wrong category is not a cosmetic error. It picks the renewal guidance, the
 * default reminder lead times and the title, so it is wrong three times over
 * and stays wrong for as long as the document is tracked. It is the one thing
 * in this flow worth interrupting somebody for.
 */

export type Confidence = 'high' | 'medium' | 'low';

/**
 * Whether to ask before showing the form.
 *
 * An absent value means an older service that has never heard of the question.
 * Treated as high, so a build talking to one keeps working exactly as it did
 * rather than asking about every scan it makes.
 */
export function needsTypeConfirmation(typeConfidence: Confidence | undefined): boolean {
  return typeConfidence === 'medium' || typeConfidence === 'low';
}

/**
 * The title to keep after somebody corrects the category.
 *
 * The scan writes a title of its own, and a good one is worth keeping: "Toyota
 * Corolla registration" says more than "Car Registration" ever will. But the
 * title that started this was "Residence Visa for AEHED SAID SHERIF" on a
 * passport, and carrying that onto a corrected entry leaves the mistake in the
 * one place the person reads every time.
 *
 * So the rule is narrow: a title that names the category we got wrong is a
 * title we got wrong, and it is replaced. Anything else is theirs and is left
 * alone. Matched case-insensitively, because the model writes "Residence visa"
 * as often as "Residence Visa".
 */
export function titleAfterCorrection(
  title: string,
  guessedLabel: string,
  chosenLabel: string
): string {
  const trimmed = title.trim();
  if (!trimmed) return chosenLabel;

  const namesTheWrongThing = trimmed.toLowerCase().includes(guessedLabel.trim().toLowerCase());
  return namesTheWrongThing ? chosenLabel : trimmed;
}
