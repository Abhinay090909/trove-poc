import express from "express";
import { ZodError } from "zod";
import { conversationSchema } from "./schemas.js";
import { ModelOutputError } from "./gemini-service.js";

function publicError(error) {
  const errorText = `${error?.code || ""} ${error?.status || ""} ${error?.message || ""}`;

  if (
    error?.code === "GEMINI_NOT_CONFIGURED" ||
    /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(errorText)
  ) {
    return {
      status: 503,
      code: "KORI_NOT_CONNECTED",
      message: "Kori isn't connected yet. Add a valid Gemini API key on the server, then try again.",
    };
  }

  if (error?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(errorText)) {
    return {
      status: 429,
      code: "KORI_BUSY",
      message: "Kori needs a short pause. Please try again in a moment.",
    };
  }

  if (error instanceof ZodError || error instanceof ModelOutputError) {
    return {
      status: 502,
      code: "INVALID_MODEL_RESPONSE",
      message: "Kori had trouble organizing that reflection. Please try again.",
    };
  }

  return {
    status: 502,
    code: "REFLECTION_FAILED",
    message: "Kori had trouble thinking about that. Please try again.",
  };
}

export function createApp({ reflectionService, logger = console }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "64kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({
      ok: true,
      aiConfigured: reflectionService.configured,
      provider: reflectionService.provider || "Google Gemini",
      model: reflectionService.model,
    });
  });

  app.post("/api/reflect", async (request, response) => {
    const parsed = conversationSchema.safeParse(request.body?.conversation);
    if (!parsed.success) {
      return response.status(400).json({
        code: "INVALID_CONVERSATION",
        message: "Please share a little about what happened first.",
      });
    }

    try {
      const result = await reflectionService.reflect(parsed.data);
      return response.json(result);
    } catch (error) {
      const safe = publicError(error);
      logger.error("Reflection request failed", {
        name: error?.name,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      return response.status(safe.status).json({ code: safe.code, message: safe.message });
    }
  });

  app.post("/api/create-memory", async (request, response) => {
    const parsed = conversationSchema.safeParse(request.body?.conversation);
    if (!parsed.success) {
      return response.status(400).json({
        code: "INVALID_CONVERSATION",
        message: "Please share a little about what happened first.",
      });
    }

    try {
      const memory = await reflectionService.createMemory(parsed.data);
      return response.json({
        status: "ready",
        message: "There's more here than you might think. ✨",
        memory,
      });
    } catch (error) {
      const safe = publicError(error);
      logger.error("Memory creation failed", {
        name: error?.name,
        status: error?.status,
        code: error?.code,
        message: error?.message,
      });
      return response.status(safe.status).json({ code: safe.code, message: safe.message });
    }
  });

  app.use((error, _request, response, _next) => {
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({
        code: "INVALID_JSON",
        message: "That request could not be read. Please try again.",
      });
    }
    logger.error("Unexpected server error", { name: error?.name, message: error?.message });
    return response.status(500).json({
      code: "SERVER_ERROR",
      message: "Something went wrong. Please try again.",
    });
  });

  return app;
}
