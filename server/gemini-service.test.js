import assert from "node:assert/strict";
import test from "node:test";
import { createReflectionService } from "./gemini-service.js";

const captured = {
  context: "A busy shift.",
  responsibility: null,
  challenge: "Two coworkers were new.",
  action: null,
  result: null,
  learning: null,
  evidence: null,
};

test("Gemini service sends role-correct history and requests schema-constrained JSON", async () => {
  let request;
  const client = {
    models: {
      async generateContent(input) {
        request = input;
        return {
          text: JSON.stringify({
            status: "continue",
            message: "What were they relying on you for?",
            captured,
            memory: null,
          }),
          candidates: [{ finishReason: "STOP" }],
        };
      },
    },
  };

  const service = createReflectionService({ client, model: "gemini-test" });
  const result = await service.reflect([
    { role: "user", content: "I helped two new coworkers." },
    { role: "assistant", content: "What made the day challenging?" },
    { role: "user", content: "The shift was already busy." },
  ]);

  assert.equal(service.provider, "Google Gemini");
  assert.equal(request.model, "gemini-test");
  assert.deepEqual(
    request.contents.map(({ role }) => role),
    ["user", "model", "user"],
  );
  assert.equal(request.config.responseMimeType, "application/json");
  assert.equal(request.config.responseJsonSchema.properties.status.type, "string");
  assert.match(request.config.systemInstruction, /Never invent/i);
  assert.equal(result.status, "continue");
});

test("Gemini service exposes a safe unconfigured state without a key", async () => {
  const service = createReflectionService({ model: "gemini-test" });
  assert.equal(service.configured, false);
  await assert.rejects(
    service.reflect([{ role: "user", content: "Something happened." }]),
    (error) => error.code === "GEMINI_NOT_CONFIGURED",
  );
});

test("Gemini service retries temporary provider failures", async () => {
  let attempts = 0;
  const client = {
    models: {
      async generateContent() {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("This model is currently experiencing high demand.");
          error.status = 503;
          throw error;
        }
        return {
          text: JSON.stringify({
            status: "continue",
            message: "What did you do next?",
            captured,
            memory: null,
          }),
          candidates: [{ finishReason: "STOP" }],
        };
      },
    },
  };

  const service = createReflectionService({
    client,
    model: "gemini-test",
    retryBaseDelayMs: 0,
  });
  const result = await service.reflect([
    { role: "user", content: "I helped two new coworkers." },
  ]);

  assert.equal(attempts, 3);
  assert.equal(result.status, "continue");
});
