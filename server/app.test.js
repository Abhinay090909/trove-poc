import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "./app.js";

const memory = {
  title: "Busy shift — helping new coworkers",
  context: "A busy shift with two new coworkers.",
  responsibility: "Help the new coworkers understand the work.",
  challenge: "The shift was already busy.",
  action: "Explained the process while handling regular work.",
  result: null,
  learning: null,
  evidence: null,
  suggestedSkills: [
    {
      name: "Communication",
      reason: "The student explained the process to two new coworkers during a busy shift.",
    },
  ],
};

async function withServer(service, callback) {
  const server = createApp({ reflectionService: service, logger: { error() {} } }).listen(0);
  await once(server, "listening");
  try {
    const { port } = server.address();
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health reports the provider without exposing credentials", async () => {
  await withServer(
    {
      configured: true,
      provider: "Google Gemini",
      model: "test-model",
      reflect() {},
      createMemory() {},
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      assert.deepEqual(body, {
        ok: true,
        aiConfigured: true,
        provider: "Google Gemini",
        model: "test-model",
      });
      assert.equal(JSON.stringify(body).includes("apiKey"), false);
    },
  );
});

test("reflection endpoint passes the conversation to its AI service", async () => {
  let received;
  const result = {
    status: "continue",
    message: "What were they relying on you for?",
    captured: {
      context: "A busy shift with two new coworkers.",
      responsibility: null,
      challenge: "The shift was busy.",
      action: null,
      result: null,
      learning: null,
      evidence: null,
    },
    memory: null,
  };

  await withServer(
    {
      configured: true,
      model: "test-model",
      async reflect(conversation) {
        received = conversation;
        return result;
      },
      createMemory() {},
    },
    async (baseUrl) => {
      const conversation = [
        { role: "user", content: "I helped two new coworkers during a busy shift." },
      ];
      const response = await fetch(`${baseUrl}/api/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), result);
      assert.deepEqual(received, conversation);
    },
  );
});

test("create-memory returns the grounded service memory in ready state", async () => {
  await withServer(
    {
      configured: true,
      model: "test-model",
      reflect() {},
      async createMemory() {
        return memory;
      },
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/create-memory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: [{ role: "user", content: "A real experience" }] }),
      });
      const body = await response.json();
      assert.equal(response.status, 200);
      assert.equal(body.status, "ready");
      assert.deepEqual(body.memory, memory);
    },
  );
});

test("invalid input and missing configuration return browser-safe errors", async () => {
  await withServer(
    {
      configured: false,
      model: "test-model",
      async reflect() {
        const error = new Error("secret server detail");
        error.code = "GEMINI_NOT_CONFIGURED";
        throw error;
      },
      createMemory() {},
    },
    async (baseUrl) => {
      const invalid = await fetch(`${baseUrl}/api/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: [] }),
      });
      assert.equal(invalid.status, 400);

      const missingKey = await fetch(`${baseUrl}/api/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation: [{ role: "user", content: "Something happened" }] }),
      });
      const body = await missingKey.json();
      assert.equal(missingKey.status, 503);
      assert.equal(JSON.stringify(body).includes("secret server detail"), false);
    },
  );
});
