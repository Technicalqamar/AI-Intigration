import Groq from 'groq-sdk';
import { ApiError } from '../utils/api-error.js';
import { aiPlanOutputSchema } from '../validators/ai.validator.js';

/**
 * Service to manage AI task planning interactions with Groq.
 */
class AiService {
  getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey) {
      throw ApiError.serviceUnavailable(
        'AI service is currently unavailable. Groq API key is not configured.'
      );
    }

    return new Groq({ apiKey });
  }

  /**
   * Generates a structured task breakdown plan for a given user description.
   *
   * @param {string} description - Task or goal description provided by user
   * @returns {Promise<{ summary: string, priority: 'low' | 'medium' | 'high', estimatedHours: number, steps: string[] }>}
   */
  async generateTaskPlan(description) {
    const client = this.getGroqClient();
    const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b';
    const timeoutMs = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '20000', 10);

    const systemPrompt = `You are an expert project planner and software engineering lead.
Given a user's task or project description, analyze the requirements and return a JSON object with a concrete action plan.

You MUST respond strictly with a valid JSON object matching this schema:
{
  "summary": "A concise summary of the overall goal or project (1-2 sentences)",
  "priority": "low" | "medium" | "high",
  "estimatedHours": number (positive decimal or integer representing total estimated work hours),
  "steps": [
    "Actionable step 1",
    "Actionable step 2",
    ...
  ]
}

Guidelines:
- Return ONLY the JSON object. Do not include markdown code blocks, conversational pleasantries, or preamble.
- "priority" MUST be one of: "low", "medium", or "high".
- "estimatedHours" MUST be a positive number greater than 0.
- "steps" MUST be an array containing between 3 and 10 clear, actionable steps.
- Reflect the difficulty and realistic effort required by the submitted description.`;

    let completion;
    try {
      completion = await client.chat.completions.create(
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: description },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        },
        { timeout: timeoutMs }
      );
    } catch (error) {
      if (
        error?.name === 'APIConnectionTimeoutError' ||
        error?.name === 'TimeoutError' ||
        error?.name === 'AbortError' ||
        error?.message?.toLowerCase().includes('timeout')
      ) {
        throw ApiError.gatewayTimeout(
          `AI request timed out after ${timeoutMs}ms. Please try again later.`
        );
      }

      if (error?.status === 429) {
        throw ApiError.tooManyRequests(
          'AI service rate limit reached with provider. Please try again shortly.'
        );
      }

      if (error?.status === 401 || error?.status === 403) {
        throw ApiError.badGateway(
          'Groq rejected the configured API key or model access.'
        );
      }

      if (error?.status === 404 || error?.status === 400) {
        throw ApiError.badGateway(
          `The configured Groq model ('${model}') is unavailable or invalid.`
        );
      }

      throw ApiError.badGateway('Failed to communicate with Groq.');
    }

    const rawContent = completion?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string' || rawContent.trim() === '') {
      throw ApiError.badGateway('Received an empty response from Groq.');
    }

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(rawContent.trim());
    } catch {
      throw ApiError.badGateway('Groq returned malformed JSON content.');
    }

    const validationResult = aiPlanOutputSchema.safeParse(parsedOutput);
    if (!validationResult.success) {
      const errorDetails = validationResult.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new ApiError(
        502,
        'AI response did not adhere to the required plan schema.',
        errorDetails
      );
    }

    return validationResult.data;
  }
}

export const aiService = new AiService();
export default aiService;
