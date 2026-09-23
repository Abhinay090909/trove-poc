# Trove Reflection Engine POC

Trove is an AI-powered reflection and memory companion for students. This proof of concept implements the live AI Reflection Engine: a student can describe any real experience, answer Kori's contextual questions, review a grounded Experience Memory, choose which suggested skills fit, edit the details, and save the result locally.

The complete Trove product vision — longitudinal memory visualization and Opportunity Mode — is demonstrated separately in the high-fidelity Figma prototype.

## Architecture

- **React + Vite** mobile-first interface
- **Node.js + Express** server-side API
- **Google Gemini API** using schema-constrained structured outputs
- **Zod** server validation for conversations and model responses
- Browser **localStorage** for saved memories; no account or database
- The Gemini key is read only by the Express server and is never shipped in the frontend bundle

## Setup

Requires Node.js 20 or newer and a Gemini API key from Google AI Studio.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set:

   ```dotenv
   GEMINI_API_KEY=your-gemini-api-key-here
   GEMINI_MODEL=gemini-3.5-flash-lite
   ```

3. Start the development app:

   ```bash
   npm run dev
   ```

4. Open <http://localhost:5173>.

For a production-style run:

```bash
npm run build
npm start
```

Then open <http://localhost:3001>.

## Test

Run the API contract tests and production build:

```bash
npm test
npm run build
```

Example reflection:

> I helped two new coworkers during a really busy shift today.

Answer naturally. Kori should ask context-dependent questions, stop once the memory is useful, avoid inventing facts, and tie each suggested skill to evidence from the conversation. Confirm or remove skills, edit any memory field, save it, refresh, and use **View saved memory** to verify local persistence.
