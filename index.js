require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { database } = require("./utils/database");
const { deployCommands } = require("./deploy-commands"); // Import deployCommands
const { initializeWalltaker } = require("./utils/walltakerManager");
const { clearInterestTimers } = require("./utils/interest"); // Ensure this import is correct
require("./server"); // Assuming this starts your Express server

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
    GatewayIntentBits.Guilds, // Essential for getting guild list on startup
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers, // Might be needed depending on command usage
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Command Loader Function (ensure this adds filePath if /cmds relies on it)
const loadCommandsRecursive = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommandsRecursive(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      try {
        const command = require(fullPath);
        if (command.data && command.execute) {
          // Add filePath for the /cmds command categorization (if needed)
          command.filePath = fullPath;
          client.commands.set(command.data.name, command); // console.log(`✅ Loaded command: ${command.data.name}`); // Logged in deploy-commands now
        } else {
          console.warn(
            `⚠️ Command file ${entry.name} is missing data or execute.`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to load command ${entry.name}:`, error);
      }
    }
  }
};

// Event Loader
const loadEvents = () => {
  const eventFiles = fs
    .readdirSync("./events")
    .filter((file) => file.endsWith(".js"));

  eventFiles.forEach((file) => {
    const event = require(`./events/${file}`);
    const eventName = event.name || file.split(".")[0]; // Use event.name if available

    try {
      const executor = (...args) => event.execute(...args, client); // Pass client
      event.once
        ? client.once(eventName, executor)
        : client.on(eventName, executor);
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
    process.exit(1); // Exit if DB connection fails
  }
};

// Bot Startup Sequence
const startBot = async () => {
  validateEnvironment();
  loadCommandsRecursive(path.join(__dirname, "commands")); // Load commands into client.commands first
  loadEvents(); // Load events

  try {
    await initializeDatabase(); // Login to Discord

    await client.login(process.env.TOKEN); // --- Deployment Trigger ---

    client.once("ready", async () => {
      console.log(`✅ Logged in as ${client.user.tag}`); // Run deployment only AFTER client is logged in and ready
      if (process.env.DEPLOY_COMMANDS === "true") {
        console.log("🚀 Triggering command deployment..."); // Pass the logged-in client to deployCommands
        await deployCommands(client);
        console.log("✅ Command deployment process finished."); // Optional: Exit after deployment if this is meant to be run only for deployment // process.exit(0);
      }
      await initializeWalltaker(client);
    }); // -------------------------- // Initialize background services (Consider moving to 'ready' event if they depend on full cache) // await initializeWalltaker(client); // Walltaker init moved to ready event
  } catch (error) {
    console.error("❌ Bot initialization or login failed:", error);
    process.exit(1);
  }
};

// Process Lifecycle Management (Graceful Shutdown)
const handleProcessEvents = () => {
  const cleanup = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Cleaning up resources...`);
    clearInterestTimers(); // Clear interest timers
    if (database) {
      // Check if database pool exists
      try {
        await database.end();
        console.log("✅ Database connection pool closed");
      } catch (error) {
        console.error("❌ Failed to close database pool:", error);
      }
    }
    if (client && client.isReady()) {
      // Check if client exists and is logged in
      client.destroy(); // Gracefully disconnect the client
      console.log("🔌 Discord client connection closed.");
    } // Exit after cleanup
    process.exit(signal === "uncaughtException" ? 1 : 0);
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));

  process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Promise Rejection:", error); // Decide if you want to exit or just log
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    cleanup("uncaughtException"); // Trigger cleanup and exit
  });
};

// Start Application
handleProcessEvents();
startBot();
