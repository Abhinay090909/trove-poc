import { z } from "zod";

const nullableDetail = z.string().trim().max(1200).nullable();

export const capturedSchema = z
  .object({
    context: nullableDetail,
    responsibility: nullableDetail,
    challenge: nullableDetail,
    action: nullableDetail,
    result: nullableDetail,
    learning: nullableDetail,
    evidence: nullableDetail,
  })
  .strict();

export const skillSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    reason: z.string().trim().min(1).max(360),
  })
  .strict();

export const memorySchema = z
  .object({
    title: z.string().trim().min(1).max(140),
    context: nullableDetail,
    responsibility: nullableDetail,
    challenge: nullableDetail,
    action: nullableDetail,
    result: nullableDetail,
    learning: nullableDetail,
    evidence: nullableDetail,
    suggestedSkills: z.array(skillSchema).max(5),
  })
  .strict();

export const reflectionSchema = z
  .object({
    status: z.enum(["continue", "ready"]),
    message: z.string().trim().min(1).max(600),
    captured: capturedSchema,
    memory: memorySchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "ready" && value.memory === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memory"],
        message: "A ready reflection must include a memory.",
      });
    }
    if (value.status === "continue" && value.memory !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memory"],
        message: "A continuing reflection must not include a memory.",
      });
    }
  });

export const conversationSchema = z
  .array(
    z
      .object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000),
      })
      .strict(),
  )
  .min(1)
  .max(30)
  .refine((messages) => messages.some((message) => message.role === "user"), {
    message: "At least one student message is required.",
  });

const detailProperties = {
  context: { type: ["string", "null"] },
  responsibility: { type: ["string", "null"] },
  challenge: { type: ["string", "null"] },
  action: { type: ["string", "null"] },
  result: { type: ["string", "null"] },
  learning: { type: ["string", "null"] },
  evidence: { type: ["string", "null"] },
};

const requiredDetails = Object.keys(detailProperties);

export const memoryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", ...requiredDetails, "suggestedSkills"],
  properties: {
    title: { type: "string" },
    ...detailProperties,
    suggestedSkills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reason"],
        properties: {
          name: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

export const reflectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["status", "message", "captured", "memory"],
  properties: {
    status: { type: "string", enum: ["continue", "ready"] },
    message: { type: "string" },
    captured: {
      type: "object",
      additionalProperties: false,
      required: requiredDetails,
      properties: detailProperties,
    },
    memory: {
      anyOf: [{ type: "null" }, memoryJsonSchema],
    },
  },
};
