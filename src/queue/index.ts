import { config } from "../utils/config";

function parseRedisUrl(url: string) {
  const useTls = url.startsWith("rediss://");
  const normalised = useTls ? url.replace("rediss://", "https://") : url.replace("redis://", "http://");
  const parsed = new URL(normalised);

  return {
    host: parsed.hostname || "localhost",
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    username: parsed.username && parsed.username !== "default" ? parsed.username : undefined,
    db: parsed.pathname ? parseInt(parsed.pathname.slice(1), 10) || 0 : 0,
    maxRetriesPerRequest: null as null,
    enableTLSForSentinelMode: false,
    ...(useTls ? { tls: {} } : {}),
  };
}

export const redisOptions = parseRedisUrl(config.REDIS_URL);
