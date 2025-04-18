const { scheduleNextInterestApplication } = require("../utils/interest");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);

    console.log("🚀 Initializing interest schedule...");
    scheduleNextInterestApplication();
    console.log("✅ Interest schedule initialized.");
  },
};
