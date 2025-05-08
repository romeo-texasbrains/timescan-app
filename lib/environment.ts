import { z } from "zod";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Find .env.local file in root directory and load it manually
const envPath = path.resolve(process.cwd(), '.env.local');

// Schema for environment variables
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

// Export a function to explicitly load environment variables
export function loadEnvVariables() {
  try {
    // First check if environment variables are already set (e.g., in Netlify)
    // This allows the function to work in both local dev and production
    const existingEnv = {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };

    // If all required variables are already set, use them directly
    if (existingEnv.NEXT_PUBLIC_SUPABASE_URL &&
        existingEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        existingEnv.SUPABASE_SERVICE_ROLE_KEY) {

      console.log("Environment variables already set in process.env");

      // Validate the existing environment variables
      const env = envSchema.parse(existingEnv);
      return { success: true, env };
    }

    // If not all variables are set, try to load from .env.local (for local development)
    console.log("Attempting to load environment variables from .env.local");

    // Check if .env.local exists
    if (fs.existsSync(envPath)) {
      // Read and parse the .env file
      const envConfig = dotenv.config({ path: envPath });

      if (envConfig.error) {
        throw envConfig.error;
      }

      // Ensure all required variables are set
      const env = envSchema.parse({
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      });

      return { success: true, env };
    } else {
      console.error(`ERROR: .env.local file not found at ${envPath} and environment variables not set`);
      return { success: false, error: "ENV_VARIABLES_NOT_FOUND" };
    }
  } catch (error) {
    console.error("Failed to load environment variables:", error);
    return { success: false, error };
  }
}

// Get environment variables with validation
export function getValidatedEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error("Invalid environment variables:", error);
    throw new Error("Invalid environment configuration");
  }
}