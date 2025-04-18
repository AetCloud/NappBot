require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const loadCommands = (dir) => {
  let commands = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      commands = commands.concat(loadCommands(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      try {
        const command = require(fullPath);
        if (command.data && command.execute) {
          commands.push(command);
          console.log(`✅ Loaded command file for deployment: ${entry.name}`);
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

const deployCommands = async () => {
  const token = process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token) {
    console.error("❌ FATAL: Missing TOKEN environment variable for deployment.");
    process.exit(1);
  }
  if (!clientId) {
    console.error("❌ FATAL: Missing CLIENT_ID environment variable for deployment.");
    process.exit(1);
  }

  console.log("ℹ️ Environment variables TOKEN and CLIENT_ID seem present.");
  const rest = new REST({ version: "10" }).setToken(token);

  const commandsDir = path.join(__dirname, "commands");
   if (!fs.existsSync(commandsDir)) {
       console.error(`❌ Commands directory not found at: ${commandsDir}`);
       process.exit(1);
   }

  const loadedCommands = loadCommands(commandsDir);
  const commandData = loadedCommands.map((cmd) => cmd.data.toJSON());

  if (commandData.length === 0) {
    console.warn("⚠️ No valid command files found to deploy. Exiting cleanly.");
    process.exit(0);
  } else {
    console.log(
      `ℹ️ Found ${commandData.length} command definitions to deploy.`
    );
  }

  try {
    console.log(`🚀 Deploying ${commandData.length} global commands...`);

    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commandData,
    });

    console.log(`🎉 Successfully deployed ${data.length} global commands.`);
    console.log("✅ Deployment script finished successfully. Forcing exit.");
    process.exit(0);

  } catch (error) {
    console.error("❌ Deployment process failed:", error.message || error);
    if(error.rawError) {
        console.error("--- Discord API Error Details ---");
        console.error(JSON.stringify(error.rawError, null, 2));
        console.error("-------------------------------");
    }
    console.error("❗ Forcing exit due to deployment error.");
    process.exit(1);
  }
};

deployCommands();

console.log("deployCommands() function called. Script execution should end via process.exit().");