require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const querystring = require("querystring");
const crypto = require("crypto");
const { storeUserInstallation } = require("./utils/database");

const app = express();
app.disable("x-powered-by");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  })
);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version,
  });
});

const DISCORD_API = "https://discord.com/api";
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI =
  process.env.REDIRECT_URI ||
  "https://web-production-c3a9.up.railway.app/oauth/callback";

const hashToken = (token) => {
  if (!process.env.HMAC_SECRET) {
    throw new Error("HMAC_SECRET environment variable is not set");
  }
  return crypto
    .createHmac("sha256", process.env.HMAC_SECRET)
    .update(token)
    .digest("hex");
};

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Authorization code required");

    const tokenResponse = await axios.post(
      `${DISCORD_API}/oauth2/token`,
      querystring.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        scope: "identify guilds",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    const userResponse = await axios.get(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: userId, username } = userResponse.data;

    const storageSuccess = await storeUserInstallation(
      userId,
      hashToken(access_token),
      hashToken(refresh_token)
    );

    if (!storageSuccess) {
      throw new Error("Failed to store user installation data");
    }

    res.status(200).send(
      `✅ Welcome ${username}! You've successfully authorized NappBot.<br>
      You can safely close this window.`
    );
  } catch (error) {
    console.error("OAuth Error:", error.response?.data || error.message);
    const errorMessage =
      process.env.NODE_ENV === "production"
        ? "❌ Authentication failed. Please try again later."
        : `🔧 Error: ${error.message}`;

    res.status(500).send(errorMessage);
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`🌐 Server running on port ${port}`);
});

const shutdown = async () => {
  console.log("🛑 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
