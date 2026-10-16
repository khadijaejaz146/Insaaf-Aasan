require("dotenv").config();
const express = require("express");
const cors = require("cors");
const complaintRoutes = require("./routes/complaint");
const aiService = require("./services/aiService");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Routes
app.use("/api", complaintRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "Insaaf Aasan API", version: "2.0.0" });
});

// Start server
app.listen(PORT, () => {
  console.log(`[Insaaf Aasan] Server running on http://localhost:${PORT}`);
  console.log(`[Insaaf Aasan] AI Provider: ${aiService.activeProviderName}`);
});
