import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import apiRouter from "./routes/api.js";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", apiRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "TeamPulseAI API", timestamp: new Date().toISOString() });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

export async function configureFrontend(appInstance: express.Express) {
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    appInstance.use(express.static(distPath));
    appInstance.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

export default app;
