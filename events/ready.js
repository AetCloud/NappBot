const { applyInterest } = require("../utils/interest");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);

    // Interest system setup
    const INTEREST_INTERVAL = process.env.INTEREST_INTERVAL || 60 * 60 * 1000;
    let interestInterval;

    const startInterestSystem = () => {
      console.log("💰 Starting bank interest system...");
      interestInterval = setInterval(async () => {
        try {
          console.log("🔄 Applying scheduled interest...");
          await applyInterest();
        } catch (error) {
          console.error("❌ Interest application failed:", error);
        }
      }, INTEREST_INTERVAL);
    };

    // Cleanup function
    const stopInterestSystem = () => {
      if (interestInterval) {
        clearInterval(interestInterval);
        console.log("⏹️ Stopped interest system");
      }
    };

    // Start the system
    startInterestSystem();

    // Handle shutdowns
    client.on("shardDisconnect", stopInterestSystem);
    client.on("shardReconnecting", stopInterestSystem);
    client.on("shardError", stopInterestSystem);
  },
};
