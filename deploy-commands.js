const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const clientId = process.env.CLIENT_ID;
const token = process.env.TOKEN;

if (!clientId || !token) {
  console.error("❌ Missing CLIENT_ID or TOKEN in environment variables.");
  process.exit(1);
}

console.log(`🔑 CLIENT_ID: ${clientId}`);
console.log(`🔑 TOKEN: ${token ? "Provided" : "Not Provided"}`);
console.log(`🛠️ Deploying commands globally...`);

function getCommandFiles(dir) {
  let files = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(getCommandFiles(fullPath));
    } else if (entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  });
  return files;
}

const commandFiles = getCommandFiles(path.join(__dirname, "commands"));

console.log(`📂 Found ${commandFiles.length} command files.`);

const allCommands = [];

for (const file of commandFiles) {
  try {
    const command = require(file);
    if (command?.data?.toJSON) {
      allCommands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.warn(`⚠️ Skipping invalid command file: ${file}`);
    }
  } catch (error) {
    console.error(`❌ Error loading command file: ${file}`, error);
  }
}

const rest = new REST({ version: "10" }).setToken(token);

async function deployCommands() {
  try {
    if (allCommands.length === 0) {
      console.warn("⚠️ No commands found to register. Skipping deployment...");
      return;
    }

    console.log("🚨 Deleting old global commands...");
    console.time("DeleteOldCommands");
    await rest.put(Routes.applicationCommands(clientId), { body: [] })
      .catch(error => {
        console.error("❌ Error deleting old global commands:", error);
      });
    console.timeEnd("DeleteOldCommands");
    console.log("✅ Cleared old global commands!");

    console.log(`🔄 Registering ${allCommands.length} global commands...`);
    console.time("RegisterCommands");
    await rest.put(Routes.applicationCommands(clientId), {
      body: allCommands,
    })
      .then(result => {
        console.log("✅ Successfully registered global commands:", result);
      })
      .catch(error => {
        console.error("❌ Error registering global commands:", error);
      });
    console.timeEnd("RegisterCommands");
  } catch (error) {
    console.error("❌ Error deploying commands:", error);
  }
}

module.exports = { deployCommands };
