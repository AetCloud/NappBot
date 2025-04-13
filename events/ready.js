const { REST, Routes } = require("discord.js");
const { applyInterest } = require("../utils/interest");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);
    console.log(
      `📋 Number of commands: ${client.commands ? client.commands.size : 0}`
    )

    if (process.env.DISABLE_READY_COMMANDS === "true") {
      console.log(
        "⏭️ Skipping command registration (DISABLE_READY_COMMANDS is enabled)."
      );
      return;
    }

    console.log(`🔑 CLIENT_ID: ${process.env.CLIENT_ID}`);
    console.log(`🔑 TOKEN: ${process.env.TOKEN ? "Provided" : "Not Provided"}`);

    console.log("💰 Starting hourly bank interest system...");
    setInterval(applyInterest, 60 * 60 * 1000);
  },
};
