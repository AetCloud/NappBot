const { REST, Routes, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

// --- Helper: Load Commands ---
// (Slightly modified to return the commands array directly and log loading)
const loadCommands = (dir) => {
  let commands = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      commands = commands.concat(loadCommands(fullPath)); // Recursively load from subdirectories
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      try {
        const command = require(fullPath);
        // Basic validation
        if (command.data && command.execute) {
          commands.push(command); // Store the whole command object temporarily
          console.log(`✅ Loaded command file: ${entry.name}`);
        } else {
          console.warn(
            `⚠️ Command file ${entry.name} is missing data or execute property.`
          );
        }
      } catch (error) {
        console.error(`❌ Failed to load command from ${entry.name}:`, error);
      }
    }
  }
  return commands;
};

// --- Main Deployment Function ---
const deployCommands = async (client) => {
  // Accept client as argument
  const token = process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    console.error(
      "❌ Missing TOKEN or CLIENT_ID environment variables for deployment."
    );
    return; // Exit if essential variables are missing
  }
  if (!client || !client.isReady()) {
    console.error(
      "❌ Discord client is not provided or not ready for deployment."
    );
    // Optionally, you could proceed with only global deployment if client isn't needed/available
    // but clearing guild commands requires the client.
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token);

  // --- Load Command Definitions ---
  const loadedCommands = loadCommands(path.join(__dirname, "commands"));
  const commandData = loadedCommands.map((cmd) => cmd.data.toJSON()); // Get JSON data for API

  if (commandData.length === 0) {
    console.warn("⚠️ No valid command files found to deploy.");
    // Decide if you still want to clear commands or just exit
  } else {
    console.log(
      `ℹ️ Found ${commandData.length} command definitions to deploy.`
    );
  }

  try {
    // --- Clear and Deploy Global Commands ---
    console.log("♻️ Clearing global commands...");
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: [] } // Clear global commands
    );
    console.log("✅ Global commands cleared.");

    console.log(`🚀 Deploying ${commandData.length} global commands...`);
    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commandData } // Deploy current commands
    );
    console.log(`🎉 Successfully deployed ${data.length} global commands.`);
  } catch (error) {
    console.error("❌ Deployment process failed:", error);
  }
};

module.exports = { deployCommands };
