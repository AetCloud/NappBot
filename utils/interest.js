const { database } = require("./database");

// Global variable to hold the timeout ID for cancellation
let interestTimeoutId = null;

function getInterestRate(balance, isActive) {
  let baseRate;

  if (balance < 10000) baseRate = 0.1; // 10% for < 10k
  else if (balance < 50000) baseRate = 0.07; // 7% for < 50k
  else if (balance < 100000) baseRate = 0.05; // 5% for < 100k
  else if (balance < 500000) baseRate = 0.03; // 3% for < 500k
  else if (balance < 1000000) baseRate = 0.02; // 2% for < 1M
  else baseRate = 0.01; // 1% for 1M+

  // Apply activity bonus
  if (isActive) baseRate += 0.01;

  // Ensure rate is not negative (though unlikely with current logic)
  return Math.max(0, baseRate);
}

async function getActiveUsers() {
  try {
    // Check users active within the last 24 hours
    const [rows] = await database.execute(
      "SELECT user_id FROM users WHERE active_last >= NOW() - INTERVAL 24 HOUR"
    );
    return new Set(rows.map((row) => row.user_id));
  } catch (error) {
    console.error("❌ MySQL Error (getActiveUsers):", error);
    return new Set(); // Return empty set on error
  }
}

async function wasInterestAppliedRecently(checkIntervalMinutes = 59) {
  // Checks if interest was applied within the last ~59 minutes
  try {
    const [rows] = await database.execute(
      "SELECT MAX(last_interest) AS last_applied FROM users"
    );
    const lastApplied = rows[0]?.last_applied;
    if (!lastApplied) return false; // No interest applied ever

    const lastTime = new Date(lastApplied).getTime();
    const checkTimeAgo = Date.now() - checkIntervalMinutes * 60 * 1000;

    // Return true if last application was within the check interval
    return lastTime > checkTimeAgo;
  } catch (error) {
    console.error("❌ MySQL Error (wasInterestAppliedRecently):", error);
    return false; // Assume not applied recently on error
  }
}

async function applyInterestAndReschedule() {
  console.log("⏰ Interest application cycle started.");
  try {
    // Safety check: Only apply if not applied very recently (e.g., within last 59 mins)
    if (await wasInterestAppliedRecently(59)) {
      console.log(
        "⏳ Interest already applied recently. Skipping application cycle."
      );
    } else {
      console.log("🔄 Applying scheduled interest...");
      const activeUsers = await getActiveUsers();
      const [users] = await database.execute(
        "SELECT user_id, bank_balance FROM users WHERE bank_balance > 0"
      );

      let affectedUsers = 0;
      const promises = users.map(async ({ user_id, bank_balance }) => {
        // Ensure bank_balance is a positive number
        const currentBalance = Number(bank_balance);
        if (isNaN(currentBalance) || currentBalance <= 0) {
          return; // Skip if balance is invalid or zero
        }

        const isActive = activeUsers.has(user_id);
        const interestRate = getInterestRate(currentBalance, isActive);
        const interest = Math.floor(currentBalance * interestRate);

        if (interest > 0) {
          try {
            // Update balance and the last_interest timestamp atomically
            await database.execute(
              "UPDATE users SET bank_balance = bank_balance + ?, last_interest = NOW() WHERE user_id = ?",
              [interest, user_id]
            );
            affectedUsers++;
            // Optional: Reduce logging noise unless debugging
            // console.log(`💰 Applied ${interest} coins to ${user_id} (Active: ${isActive})`);
          } catch (updateError) {
            console.error(
              `❌ Failed to update interest for user ${user_id}:`,
              updateError
            );
          }
        }
      });

      await Promise.all(promises); // Wait for all updates to process

      console.log(
        `✅ Interest application finished. Affected users: ${affectedUsers}.`
      );
    }
  } catch (error) {
    console.error("❌ Error during applyInterest function:", error);
  } finally {
    // ALWAYS reschedule, even if the current run skipped or failed
    scheduleNextInterestApplication();
    console.log("🗓️ Next interest application scheduled.");
  }
}

function scheduleNextInterestApplication() {
  // Clear any existing timeout to prevent duplicates if called manually
  if (interestTimeoutId) {
    clearTimeout(interestTimeoutId);
    interestTimeoutId = null;
  }

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0); // Set to the beginning of the next hour

  const delay = nextHour.getTime() - now.getTime(); // Milliseconds until the next hour starts

  console.log(
    `🕰️ Scheduling next interest check in ${Math.round(
      delay / 60000
    )} minutes (at ${nextHour.toLocaleTimeString()}).`
  );

  // Set the timeout to run the combined function
  interestTimeoutId = setTimeout(applyInterestAndReschedule, delay);
}

// Function to clear the timeout during shutdown
function clearInterestTimers() {
  if (interestTimeoutId) {
    clearTimeout(interestTimeoutId);
    interestTimeoutId = null;
    console.log("🛑 Cleared scheduled interest timer.");
  }
}

module.exports = {
  // Expose only the functions needed externally
  scheduleNextInterestApplication, // To start the process from ready.js
  clearInterestTimers, // To stop the process on shutdown
  applyInterest: applyInterestAndReschedule, // Keep applyInterest if commands need to trigger it manually (optional)
};
