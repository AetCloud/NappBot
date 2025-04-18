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

  if (!token || !clientId) {
    console.error(
      "❌ Missing TOKEN or CLIENT_ID environment variables for deployment."
    );
    process.exit(1);
  }

  const rest = new REST({ version: "10" }).setToken(token);

  const loadedCommands = loadCommands(path.join(__dirname, "commands"));
  const commandData = loadedCommands.map((cmd) => cmd.data.toJSON());

  if (commandData.length === 0) {
    console.warn("⚠️ No valid command files found to deploy.");

    return;
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
  } catch (error) {
    console.error("❌ Deployment process failed:", error);
    process.exit(1);
  }
};

deployCommands();
