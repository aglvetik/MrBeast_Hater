import { bootstrap } from "./bootstrap.js";

async function main(): Promise<void> {
  const runtime = await bootstrap();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down PingGuard...`);
    await runtime.stop();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  process.once("unhandledRejection", (reason) => {
    runtime.context.logger.error(
      {
        event: "unhandled_rejection",
        error: reason instanceof Error ? reason.name : "Unknown rejection"
      },
      "Unhandled rejection"
    );
  });

  process.once("uncaughtException", (error) => {
    runtime.context.logger.fatal(
      {
        event: "uncaught_exception",
        error: error.name
      },
      "Uncaught exception"
    );
  });

  await runtime.start();
}

void main();
