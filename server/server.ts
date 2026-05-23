import http from "http";
import app, { configureFrontend } from "./app.js";
import { initSockets } from "./sockets/index.js";
import { PORT } from "./config/config.js";
import { initializeWeeklyReportCron } from "./cron/weeklyReportScheduler.js";

async function run() {
  // Set up HTTP Server and Socket.IO
  const httpServer = http.createServer(app);
  const io = initSockets(httpServer);

  // Make SocketJS referenced globally on express req instances
  app.set("io", io);

  // Configure Vite dev or production static file serve
  await configureFrontend(app);

  // Initialize automated weekly report cron tasks
  initializeWeeklyReportCron();

  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌ Port ${PORT} is already in use. Kill the existing process and retry.`);
      process.exit(1);
    } else {
      throw err;
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 TeamPulseAI is running at http://0.0.0.0:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV || "development"}`);
    console.log(`   MongoDB     : ${process.env.MONGO_URI ? "enabled" : "skipped (JSON fallback)"}`);
  });
}

run().catch((error) => {
  console.error("Critical server boot error:", error);
});
