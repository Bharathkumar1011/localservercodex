import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
console.log("✅ Server starting wisafasfasfth env:", process.env.NODE_ENV);

// app.use(cors({ origin: "http://localhost:5173", credentials: true }));
// ✅ Allow both localhost (for dev) and your deployed Vercel frontend (for production)
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://vercel-frontebd-client-bir4lx3e3-bharath1011s-projects.vercel.app"  // <-- change this to your real Vercel URL
// ];

// app.use(cors({
//   origin: function (origin, callback) {
//     // Allow requests with no origin (like mobile apps or curl)
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       console.warn("❌ Blocked by CORS:", origin);
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true
// }));


// app.use(cors({
//   origin: (origin, callback) => {
//     callback(null, origin); // Echo back the request origin
//   },
//   credentials: true
// }));

app.use(cors({ origin: true, credentials: true }));


app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
})();
