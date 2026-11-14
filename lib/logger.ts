/**
 * ============================================================================
 * FILE: lib/logger.ts
 * ============================================================================
 * FEATURE OVERVIEW:
 * Structured Application & GenAI Telemetry Logger.
 *
 * USE CASES:
 * 1. Logging every function call across server and client modules at INFO level
 *    along with sanitized input parameters.
 * 2. Logging all Google GenAI (@google/genai) SDK invocations with model name,
 *    prompt, config, and response output while automatically stripping heavy
 *    inlineData / base64 payloads so logs remain readable and clean.
 * 3. Logging Context.dev SDK calls with structured searchBy, filterBy, sortBy,
 *    cursor parameters, and response metadata.
 * ============================================================================
 */

/**
 * Recursively strips `inlineData` (such as base64 images or audio buffers)
 * from any logged object to keep logs concise and safe.
 *
 * @param value - Any value or payload object to sanitize
 * @returns A deep-cloned copy with inlineData replaced by a summary placeholder
 */
export function stripInlineData(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripInlineData(item));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'inlineData') {
        result[key] = '[STRIPPED_INLINE_DATA]';
      } else {
        result[key] = stripInlineData(val);
      }
    }
    return result;
  }
  return value;
}

/**
 * Logs a function call as INFO with its function name and sanitized parameters.
 *
 * @param functionName - Name of the function being invoked
 * @param params - Key-value map of arguments passed to the function
 */
export function logFunctionCall(
  functionName: string,
  params: Record<string, unknown> = {}
): void {
  const sanitizedParams = stripInlineData(params);
  console.info(
    `[INFO] [FN_CALL] ${functionName}`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      function: functionName,
      params: sanitizedParams,
    })
  );
}

/**
 * Logs a Google GenAI SDK call as INFO including the model used, prompt/contents,
 * configuration, and the resulting output, with inlineData stripped.
 *
 * @param details - Object containing model, prompt, config, and output
 */
export function logGenAICall(details: {
  model: string;
  prompt: unknown;
  config?: unknown;
  output?: unknown;
  error?: unknown;
}): void {
  const sanitizedPrompt = stripInlineData(details.prompt);
  const sanitizedConfig = stripInlineData(details.config);
  const sanitizedOutput = stripInlineData(details.output);

  console.info(
    `[INFO] [GENAI_CALL] model=${details.model}`,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      model: details.model,
      prompt: sanitizedPrompt,
      config: sanitizedConfig,
      output: sanitizedOutput,
      ...(details.error ? { error: String(details.error) } : {}),
    })
  );
}
