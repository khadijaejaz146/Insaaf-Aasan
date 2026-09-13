require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const complaintRoutes = require("./routes/complaint");
const aiService = require("./services/aiService");

const app = express();
const PORT = process.env.PORT || 3001;
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://insaaf-aasan.vercel.app",
];
const allowedOrigins = (process.env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    const normalizedOrigin = origin && origin.replace(/\/+$/, "");
    if (!origin || allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    return callback(new Error("Origin not allowed by CORS policy."));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  maxAge: 86400,
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({
      error: "Too many requests. Please wait a few minutes and try again.",
    });
  },
});

// Middleware
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));

// Routes
app.use("/api", apiLimiter, complaintRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Insaaf Aasan API", version: "2.0.0" });
});

// Return safe JSON errors for rejected browser origins and malformed JSON.
app.use((err, req, res, next) => {
  if (err.message === "Origin not allowed by CORS policy.") {
    return res.status(403).json({ error: "This origin is not allowed to use the API." });
  }
  if (err instanceof SyntaxError && Object.hasOwn(err, "body")) {
    return res.status(400).json({ error: "Request body must be valid JSON." });
  }
  return next(err);
});

// Start server
app.listen(PORT, () => {
  console.log(`[Insaaf Aasan] Server running on http://localhost:${PORT}`);
  console.log(`[Insaaf Aasan] AI Provider: ${aiService.activeProviderName}`);
});
