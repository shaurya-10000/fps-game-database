import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  
  // Mongo config - no default for production
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  
  // Optional with defaults
  MONGODB_MAX_POOL_SIZE: z.coerce.number().default(20),
  MONGODB_MAX_CONNECTING: z.coerce.number().default(10),
  MONGODB_WAIT_QUEUE_TIMEOUT_MS: z.coerce.number().default(5000),

  // Auth config
  AUTH_JWKS_URI: z.string().url("Must be a valid URL"),
  AUTH_ISSUER: z.string().min(1),
  AUTH_AUDIENCE: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const fallbackMongoUri = 
    source["NODE_ENV"] === "production" 
      ? undefined 
      : "mongodb://localhost:27017/fps_test";

  const parsed = envSchema.safeParse({
    ...source,
    MONGODB_URI: source["MONGODB_URI"] || fallbackMongoUri,
  });

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(parsed.error.format());
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}