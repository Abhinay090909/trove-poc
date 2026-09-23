import { GoogleGenAI } from "@google/genai";
import { KORI_SYSTEM_PROMPT, FORCE_MEMORY_PROMPT } from "./prompt.js";
import {
  memoryJsonSchema,
  memorySchema,
  reflectionJsonSchema,
  reflectionSchema,
} from "./schemas.js";

export class ModelOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ModelOutputError";
  }
}

function parseJson(text) {
  if (!text || typeof text !== "string") {
    throw new ModelOutputError("The model returned no text output.");
  }

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ModelOutputError("The model returned malformed JSON.");
  }
}

function toGeminiContents(conversation) {
  return conversation.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content }],
  }));
}

function isRetryable(error) {
  const errorText = `${error?.status || ""} ${error?.code || ""} ${error?.message || ""}`;
  return (
    [429, 500, 502, 503, 504].includes(error?.status) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|temporar(?:y|ily)/i.test(errorText)
  );
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function missingConfiguration(model) {
  const fail = async () => {
    const error = new Error("GEMINI_API_KEY is not configured.");
    error.code = "GEMINI_NOT_CONFIGURED";
    throw error;
  };

  return {
    configured: false,
    provider: "Google Gemini",
    model,
    reflect: fail,
    createMemory: fail,
  };
}

export function createReflectionService({
  apiKey,
  model = "gemini-3.5-flash-lite",
  client,
  maxRetries = 2,
  retryBaseDelayMs = 400,
} = {}) {
  if (!apiKey && !client) return missingConfiguration(model);

  const gemini = client || new GoogleGenAI({ apiKey });

  async function request({ conversation, instructions, schema }) {
    let response;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        response = await gemini.models.generateContent({
          model,
          contents: toGeminiContents(conversation),
          config: {
            systemInstruction: instructions,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            maxOutputTokens: 1600,
            temperature: 0.35,
          },
        });
        break;
      } catch (error) {
        if (attempt === maxRetries || !isRetryable(error)) throw error;
        await delay(retryBaseDelayMs * 2 ** attempt);
      }
    }

    const finishReason = response?.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== "STOP") {
      throw new ModelOutputError(`The model response ended with reason ${finishReason}.`);
    }

    return parseJson(response?.text);
  }

  return {
    configured: true,
    provider: "Google Gemini",
    model,
    async reflect(conversation) {
      const raw = await request({
        conversation,
        instructions: KORI_SYSTEM_PROMPT,
        schema: reflectionJsonSchema,
      });
      return reflectionSchema.parse(raw);
    },
    async createMemory(conversation) {
      const raw = await request({
        conversation,
        instructions: `${KORI_SYSTEM_PROMPT}${FORCE_MEMORY_PROMPT}`,
        schema: memoryJsonSchema,
      });
      return memorySchema.parse(raw);
    },
  };
}
