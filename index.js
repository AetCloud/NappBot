require("dotenv").config();
const fs = require("fs"); // Moved require statements to the top for clarity
const path = require("path"); // Added path require for command loading logic below
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

// Command Loader Function (assuming it adds filePath)
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
          // Add filePath for the /cmds command categorization
          command.filePath = fullPath;
          client.commands.set(command.data.name, command);
          console.log(`✅ Loaded command: ${command.data.name}`);
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
    const eventName = file.split(".")[0]; // Use event.name for clarity

    try {
      // Pass 'client' to the event execute function if needed
      const executor = (...args) => event.execute(...args, client);
      event.once
        ? client.once(event.name, executor)
        : client.on(event.name, executor);
      console.log(`✅ Loaded event: ${event.name}`); // Log using event.name
    } catch (error) {
      console.error(
        `❌ Failed to load event ${event.name || eventName}:`,
        error
      );
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
  loadCommandsRecursive(path.join(__dirname, "commands")); // Load commands
  loadEvents(); // Load events

  try {
    await initializeDatabase();

    if (process.env.DEPLOY_COMMANDS === "true") {
      console.log("🚀 Starting command deployment...");
      await deployCommands(client.commands); // Pass commands if needed by deploy script
    }

    await client.login(process.env.TOKEN);
    // Ready event now handles the log message upon successful login

    // Initialize background services
    // Ensure Walltaker initialization doesn't rely on client being fully ready if it needs cache access
    // It might be better to move this into the ready event if it depends on caches
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
    clearInterestTimers(); // Ensure this function exists and is correctly imported
    try {
      await database.end();
      console.log("✅ Database connection closed");
    } catch (error) {
      console.error("❌ Failed to close database:", error);
    }
    client.destroy(); // Gracefully disconnect the client
    console.log("🔌 Discord client connection closed.");
  });

  process.on("SIGINT", async () => {
    console.log("Received SIGINT. Shutting down gracefully...");
    await process.emit("beforeExit"); // Trigger cleanup
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Received SIGTERM. Shutting down gracefully...");
    await process.emit("beforeExit"); // Trigger cleanup
    process.exit(0);
  });

  process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Promise Rejection:", error);
    // Consider whether to exit or just log depending on severity
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    process.exit(1); // Exit on uncaught exceptions to prevent undefined state
  });
};

// Start Application
handleProcessEvents();
startBot();
