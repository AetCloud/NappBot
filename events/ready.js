const { scheduleNextInterestApplication } = require("../utils/interest");

module.exports = {
  name: "ready",
  once: true,
  async execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
    console.log(`🌐 Serving ${client.guilds.cache.size} guilds`);

    // Set bot presence/activity
    client.user.setActivity("with n4ppstar..", { type: "PLAYING" });

    // Start the interest application schedule
    // This will calculate the time until the next hour and schedule the first run.
    // Subsequent runs are scheduled automatically by applyInterestAndReschedule.
    console.log("🚀 Initializing interest schedule...");
    scheduleNextInterestApplication();
    console.log("✅ Interest schedule initialized.");

    // No need for the old interval logic or cleanup handlers here,
    // as utils/interest.js now manages its own timer and cleanup.
  },
};
