import type { FastifyInstance } from "fastify";
import type { AppContext } from "../context.js";

const BUILD_VERSION = "0.2.0";

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get("/api/v1/health", async () => {
    let dbOk = true;
    try {
      await ctx.pool.query("SELECT 1");
    } catch {
      dbOk = false;
    }

    const modelHealth = await ctx.ollama.checkHealth();

    return {
      service: "ok",
      buildVersion: BUILD_VERSION,
      database: dbOk ? "ok" : "error",
      ollama: modelHealth.reachable ? (modelHealth.installedTag ? "ok" : "model_missing") : "unreachable",
      modelHealth,
    };
  });
}
