const { scheduleNextInterestApplication } = require("../utils/interest");
const { initializeWalltaker } = require("../utils/walltakerManager");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);

    console.log("🚀 Initializing interest schedule...");
    scheduleNextInterestApplication();
    console.log("✅ Interest schedule initialized.");

    console.log("🚀 Initializing Walltaker feed checker...");
    initializeWalltaker(client);
  },
};
