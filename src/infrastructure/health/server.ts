import Fastify, { type FastifyInstance } from "fastify";

import { product } from "../../config/product.js";
import type { Env } from "../../config/env.js";
import type { DatabaseClient } from "../database/client.js";
import type { MetricsService } from "../metrics/registry.js";
import type { ReadinessState } from "./readiness.js";

export interface HealthServerDependencies {
  readonly env: Env;
  readonly database: DatabaseClient;
  readonly metrics: MetricsService;
  readonly readiness: ReadinessState;
}

export function createHealthServer(deps: HealthServerDependencies): FastifyInstance {
  const server = Fastify({
    logger: false
  });

  server.get("/health/live", (): Record<string, string> => ({
    status: "ok",
    product: product.name,
    version: product.version
  }));

  server.get("/health/ready", async (_, reply): Promise<Record<string, unknown>> => {
    let databaseOk = false;

    try {
      await deps.database.pool.query("select 1");
      databaseOk = true;
      deps.readiness.markDatabaseReady(true);
    } catch {
      deps.readiness.markDatabaseReady(false);
    }

    const snapshot = deps.readiness.snapshot();
    const ready = databaseOk && snapshot.discordReady && snapshot.migrationsCurrent;

    return reply.code(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks: {
        database: databaseOk,
        discord: snapshot.discordReady,
        migrations: snapshot.migrationsCurrent
      }
    });
  });

  server.get("/metrics", async (request, reply): Promise<void> => {
    if (deps.env.METRICS_TOKEN) {
      const authorization = request.headers.authorization;
      if (authorization !== `Bearer ${deps.env.METRICS_TOKEN}`) {
        await reply.code(401).send({ error: "Unauthorized" });
        return;
      }
    }

    reply.header("content-type", deps.metrics.registry.contentType);
    await reply.send(await deps.metrics.registry.metrics());
  });

  return server;
}
