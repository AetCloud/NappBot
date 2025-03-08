const { applyInterest } = require("../utils/interest");
const fs = require("fs");
const path = require("path");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);
    console.log(
      `📋 Number of commands: ${client.commands ? client.commands.size : 0}`
    );

    if (!client.commands || client.commands.size === 0) {
      console.warn("⚠️ No commands found. Skipping registration.");
      return;
    }

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

    async function monitorWalltakerChanges() {
      await postWalltakerImages();
    }

    setInterval(monitorWalltakerChanges, 30 * 1000);
  },
};
