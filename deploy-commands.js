require("dotenv").config();
const fs = require("fs");
const { REST, Routes } = require("discord.js");

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

if (!clientId || !token) {
  console.error("❌ Missing CLIENT_ID or TOKEN in environment variables.");
  process.exit(1);
}

function getCommandFiles(dir) {
  let files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      files = files.concat(getCommandFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  });
  return files;
}

const commandFiles = getCommandFiles("./commands");

const allCommands = [];

for (const file of commandFiles) {
  const command = require(file);
  if (command?.data?.toJSON) {
    allCommands.push(command.data.toJSON());
  } else {
    console.warn(`⚠️ Skipping invalid command file: ${file}`);
  }
}

const rest = new REST({ version: "10" }).setToken(token);

(async () => {
  try {
    console.log("🚨 Deleting old global commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    console.log("✅ Cleared old global commands!");

    if (allCommands.length === 0) {
      console.warn("⚠️ No commands found to register. Skipping deployment...");
      return;
    }

    console.log(`🔄 Registering ${allCommands.length} global commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: allCommands });

    console.log("✅ Successfully registered global commands.");
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
})();
