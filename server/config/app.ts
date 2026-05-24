import express from "express";
import path from "path";
import apiRouter from "../routes/api.js";
import { createServer as createViteServer } from "vite";

const app = express();

// Standard JSON payload parser
app.use(express.json());

// Mount MVC routers first
app.use("/api", apiRouter);

// Serve static assets or mount Vite Dev Server middleware
export async function configureFrontend(appInstance: express.Express) {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting development mode with Vite hot-mount middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    appInstance.use(vite.middlewares);
  } else {
    console.log("Starting production mode. Serving static build assets...");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files
    appInstance.use(express.static(distPath));
    
    // Fallback everything to single page app index.html
    appInstance.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

export default app;
