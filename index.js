require("dotenv").config();
const { fs } = require('fs');
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { database } = require("./utils/database");
const { deployCommands } = require("./deploy-commands");
const { initializeWalltaker } = require("./utils/walltakerManager");
const { clearInterestTimers } = require("./utils/interest");
require("./server");

// Environment Validation
const validateEnvironment = () => {
  const requiredVars = ["TOKEN", "CLIENT_ID", "MYSQL_PUBLIC_URL"];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length) {
    console.error(`❌ Missing environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Event Loader
const loadEvents = () => {
  const eventFiles = fs
    .readdirSync("./events")
    .filter((file) => file.endsWith(".js"));

  eventFiles.forEach((file) => {
    const event = require(`./events/${file}`);
    const eventName = file.split(".")[0];

    try {
      const executor = (...args) => event.execute(...args, client);
      event.once
        ? client.once(event.name, executor)
        : client.on(event.name, executor);
      console.log(`✅ Loaded event: ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to load event ${eventName}:`, error);
    }
  });
};

// Database Initialization
const initializeDatabase = async () => {
  try {
    await database.query("SELECT 1");
    console.log("✅ Database connection verified");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

// Bot Startup Sequence
const startBot = async () => {
  validateEnvironment();
  loadEvents();

  try {
    await initializeDatabase();

    if (process.env.DEPLOY_COMMANDS === "true") {
      console.log("🚀 Starting command deployment...");
      await deployCommands();
    }

    await client.login(process.env.TOKEN);
    console.log(`🤖 Logged in as ${client.user.tag}`);

    // Initialize background services
    await initializeWalltaker(client);
  } catch (error) {
    console.error("❌ Bot initialization failed:", error);
    process.exit(1);
  }
};

// Process Lifecycle Management
const handleProcessEvents = () => {
  process.on("beforeExit", async () => {
    console.log("🛑 Cleaning up resources...");
    clearInterestTimers();
    try {
      await database.end();
      console.log("✅ Database connection closed");
    } catch (error) {
      console.error("❌ Failed to close database:", error);
    }
  });

  process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Promise Rejection:", error);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1);
  });
};

// Start Application
handleProcessEvents();
startBot();
