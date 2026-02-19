/**
 * Executes an async function with exponential backoff retry logic.
 *
 * @param {() => Promise<T>} fn - Async function to execute
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} baseDelay - Base delay in ms before first retry (default: 1000)
 * @returns {Promise<T>} Result of the function call
 * @throws After all retries are exhausted
 */
export async function withExponentialBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) break;

      // Exponential backoff with jitter: delay = baseDelay * 2^attempt + random(0..baseDelay)
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * baseDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
