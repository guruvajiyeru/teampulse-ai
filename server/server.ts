import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";

import app, { configureFrontend } from "./app.js";
import { initSockets } from "./sockets/index.js";
import { initializeWeeklyReportCron } from "./cron/weeklyReportScheduler.js";

dotenv.config();
const PORT = Number(process.env.PORT) || 3000;

async function run() {
  const httpServer = http.createServer(app);

  const io = initSockets(httpServer);

  app.set("io", io);

  await configureFrontend(app);

  initializeWeeklyReportCron();

  console.log("MONGO_URI:", process.env.MONGO_URI);

  await mongoose
    .connect(process.env.MONGO_URI as string)
    .then(() => {
      console.log("✅ MongoDB Connected");
    })
    .catch((err) => {
      console.log("❌ MongoDB Connection Error:", err);
    });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 TeamPulseAI is running at http://0.0.0.0:${PORT}`);
    console.log(`Environment : ${process.env.NODE_ENV || "development"}`);
  });
}

run().catch((error) => {
  console.error("Critical server boot error:", error);
});