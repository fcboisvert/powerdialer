import type { RawOutcome, CallResult } from '@/types/dialer';

export function mapRawOutcomeToCallResult(outcome: RawOutcome): CallResult | null {
  switch (outcome) {
    case 'Répondeur':
      return 'Boite_Vocale';
    case 'Pas_Joignable':
      return 'Pas_Joignable';
    default:
      return null; // 'Répondu_Humain' is ignored (manual follow-up)
  }
}
