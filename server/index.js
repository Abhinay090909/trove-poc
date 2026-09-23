import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createReflectionService } from "./gemini-service.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDirectory, "..");
const port = Number(process.env.PORT) || 3001;

const reflectionService = createReflectionService({
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
});

const app = createApp({ reflectionService });

if (process.env.NODE_ENV === "production") {
  const distDirectory = path.join(projectRoot, "dist");
  app.use(express.static(distDirectory));
  app.get("/{*splat}", (_request, response) => {
    response.sendFile(path.join(distDirectory, "index.html"));
  });
}

app.listen(port, () => {
  const connection = reflectionService.configured ? "connected" : "missing GEMINI_API_KEY";
  console.log(`Trove API listening on http://localhost:${port} · Google Gemini ${connection}`);
});
