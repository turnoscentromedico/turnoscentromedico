import { defineConfig } from "vitest/config";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { parse } from "dotenv";

const envPath = existsSync(".env.test.local") ? ".env.test.local" : ".env.test";
const testEnv = existsSync(envPath)
  ? parse(readFileSync(envPath, "utf-8"))
  : {};

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    globals: true,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
    env: testEnv,
  },
});
