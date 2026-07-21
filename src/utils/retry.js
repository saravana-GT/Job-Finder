export async function retryWithBackoff(operation, retries = 3, delayMs = 300) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (attempt >= retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
