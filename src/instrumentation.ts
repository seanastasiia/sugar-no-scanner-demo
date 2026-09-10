export async function register() {
  if (process.env.NEXT_PHASE !== "phase-production-build" && process.env.NEXT_RUNTIME === "nodejs" && process.env.SHELF_RESEARCH_QUEUE_ENABLED === "true") {
    const { startShelfQueueWorker } = await import("./server/shelf-queue");
    startShelfQueueWorker();
  }
}
