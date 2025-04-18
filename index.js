require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { database } = require("./utils/database");
const { initializeWalltaker } = require("./utils/walltakerManager");
const { clearInterestTimers } = require("./utils/interest");
require("./server");

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
          command.filePath = fullPath;
          client.commands.set(command.data.name, command);
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

const loadEvents = () => {
  const eventFiles = fs
    .readdirSync("./events")
    .filter((file) => file.endsWith(".js"));

  eventFiles.forEach((file) => {
    const event = require(`./events/${file}`);
    const eventName = event.name || file.split(".")[0];

    try {
      const executor = (...args) => event.execute(...args, client);
      event.once
        ? client.once(eventName, executor)
        : client.on(eventName, executor);
      console.log(`✅ Loaded event: ${eventName}`);
    } catch (error) {
      console.error(`❌ Failed to load event ${eventName}:`, error);
    }
  });
};

const initializeDatabase = async () => {
  try {
    await database.query("SELECT 1");
    console.log("✅ Database connection verified");
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
};

const startBot = async () => {
  validateEnvironment();
  loadCommandsRecursive(path.join(__dirname, "commands"));
  loadEvents();

  try {
    await initializeDatabase();
    await client.login(process.env.TOKEN);
  } catch (error) {
    console.error("❌ Bot initialization or login failed:", error);
    process.exit(1);
  }
};

const handleProcessEvents = () => {
  const cleanup = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Cleaning up resources...`);
    clearInterestTimers();
    if (database) {
      try {
        await database.end();
        console.log("✅ Database connection pool closed");
      } catch (error) {
        console.error("❌ Failed to close database pool:", error);
      }
    }
    if (client && client.isReady()) {
      client.destroy();
      console.log("🔌 Discord client connection closed.");
    }
    process.exit(signal === "uncaughtException" ? 1 : 0);
  };

  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("SIGTERM", () => cleanup("SIGTERM"));

  process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled Promise Rejection:", error);
  });

  process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
    cleanup("uncaughtException");
  });
};

handleProcessEvents();
startBot();
