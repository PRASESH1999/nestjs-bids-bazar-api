/**
 * The parts of a KYC submission a reviewer can flag as wrong.
 *
 * A rejection reason is prose: useful to read, impossible to act on
 * programmatically. Without this list the applicant was left re-reading a
 * sentence and guessing which upload to redo — and, because resubmission used
 * to demand every document again, guessing wrong cost them nothing anyway.
 * Now that files are retained unless replaced, "which ones are wrong" is the
 * question the form has to answer, so the reviewer names them.
 *
 * Shared with the frontend by value, not by type: these strings are what the
 * form maps to its own inputs, so adding one here means adding a label there.
 */
export const KYC_REJECTABLE_FIELDS = [
  'fullName',
  'documentType',
  'documentId',
  'citizenshipFront',
  'citizenshipBack',
  'passport',
  'nidFront',
  'permanentAddress',
  'temporaryAddress',
  'emergencyContactPhone',
  'bankDetails',
] as const;

export type KycRejectableField = (typeof KYC_REJECTABLE_FIELDS)[number];
