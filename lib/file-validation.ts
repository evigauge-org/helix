// File upload limits aligned with Python backend
export const MAX_FILE_SIZE_MB = 50;
export const MAX_TOTAL_SIZE_MB = 200;
export const MAX_FILES = 10;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateFiles(
  existing: { size: number }[],
  incoming: File[],
): ValidationResult {
  // File count
  if (existing.length + incoming.length > MAX_FILES) {
    return { valid: false, error: `Maximum ${MAX_FILES} files per query` };
  }

  // Individual file size
  for (const f of incoming) {
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      return {
        valid: false,
        error: `"${f.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit`,
      };
    }
  }

  // Total size
  const existingTotal = existing.reduce((sum, f) => sum + f.size, 0);
  const incomingTotal = incoming.reduce((sum, f) => sum + f.size, 0);
  if ((existingTotal + incomingTotal) > MAX_TOTAL_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: `Total size exceeds ${MAX_TOTAL_SIZE_MB}MB limit`,
    };
  }

  return { valid: true };
}
