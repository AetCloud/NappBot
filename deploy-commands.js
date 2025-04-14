const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const validateCommand = (command) => {
  if (!command.data) throw new Error("Missing data property");
  if (!command.execute) throw new Error("Missing execute function");
  if (typeof command.execute !== "function")
    throw new Error("Execute must be a function");
};

const loadCommands = (dir) => {
  return fs.readdirSync(dir).reduce((acc, entry) => {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      return acc.concat(loadCommands(fullPath));
    }
    return entry.endsWith(".js") ? acc.concat(fullPath) : acc;
  }, []);
};

const deployCommands = async () => {
  const token = process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token || !clientId) {
    throw new Error("Missing required environment variables");
  }

  const rest = new REST({ version: "10" }).setToken(token);
  const commandFiles = loadCommands(path.join(__dirname, "commands"));
  const commands = [];

  for (const file of commandFiles) {
    try {
      const command = require(file);
      validateCommand(command);
      commands.push(command.data.toJSON());
      console.log(`✅ Validated command: ${command.data.name}`);
    } catch (error) {
      console.error(`❌ Invalid command in ${file}:`, error.message);
    }
  }

  if (commands.length === 0) {
    throw new Error("No valid commands found for deployment");
  }

  try {
    console.log("♻️  Resetting global commands...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });

    console.log(`🚀 Deploying ${commands.length} commands...`);
    const data = await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });

    console.log(`🎉 Successfully deployed ${data.length} commands`);
    return data;
  } catch (error) {
    console.error("❌ Deployment failed:");
    throw error;
  }
};

module.exports = { deployCommands };
