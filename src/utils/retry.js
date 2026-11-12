/**
 * Executes an async function with exponential backoff retry logic.
 *
 * @param {() => Promise<T>} fn - Async function to execute
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms before first retry (default: 1000)
 * @returns {Promise<T>} Result of the function call
 * @throws After all retries are exhausted, or at once for a final error (isFinalError)
 */
// Answers that a retry can't change (now): a refused token, a missing repository, a usage limit
// (retrying would only spend more of it). Codes set by the services.
const FINAL_CODES = new Set(['TOKEN_REJECTED', 'NOT_FOUND', 'RATE_LIMITED']);
export const isFinalError = (error) => FINAL_CODES.has(error?.code);

export async function withExponentialBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || isFinalError(error)) break;

      // Exponential backoff with jitter: delay = baseDelay * 2^attempt + random(0..baseDelay)
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
