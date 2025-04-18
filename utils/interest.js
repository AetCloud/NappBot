const { database } = require("./database");

let interestTimeoutId = null;

function getInterestRate(balance, isActive) {
  let baseRate;

  if (balance < 10000) baseRate = 0.1;
  else if (balance < 50000) baseRate = 0.07;
  else if (balance < 100000) baseRate = 0.05;
  else if (balance < 500000) baseRate = 0.03;
  else if (balance < 1000000) baseRate = 0.02;
  else baseRate = 0.01;

  if (isActive) baseRate += 0.01;

  return Math.max(0, baseRate);
}

async function getActiveUsers() {
  try {
    const [rows] = await database.execute(
      "SELECT user_id FROM users WHERE active_last >= NOW() - INTERVAL 24 HOUR"
    );
    return new Set(rows.map((row) => row.user_id));
  } catch (error) {
    console.error("❌ MySQL Error (getActiveUsers):", error);
    return new Set();
  }
}

async function wasInterestAppliedRecently(checkIntervalMinutes = 59) {
  try {
    const [rows] = await database.execute(
      "SELECT MAX(last_interest) AS last_applied FROM users"
    );
    const lastApplied = rows[0]?.last_applied;
    if (!lastApplied) return false;

    const lastTime = new Date(lastApplied).getTime();
    const checkTimeAgo = Date.now() - checkIntervalMinutes * 60 * 1000;

    return lastTime > checkTimeAgo;
  } catch (error) {
    console.error("❌ MySQL Error (wasInterestAppliedRecently):", error);
    return false;
  }
}

async function applyInterestAndReschedule() {
  console.log("⏰ Interest application cycle started.");
  try {
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
        const currentBalance = Number(bank_balance);
        if (isNaN(currentBalance) || currentBalance <= 0) {
          return;
        }

        const isActive = activeUsers.has(user_id);
        const interestRate = getInterestRate(currentBalance, isActive);
        const interest = Math.floor(currentBalance * interestRate);

        if (interest > 0) {
          try {
            await database.execute(
              "UPDATE users SET bank_balance = bank_balance + ?, last_interest = NOW() WHERE user_id = ?",
              [interest, user_id]
            );
            affectedUsers++;
          } catch (updateError) {
            console.error(
              `❌ Failed to update interest for user ${user_id}:`,
              updateError
            );
          }
        }
      });

      await Promise.all(promises);

      console.log(
        `✅ Interest application finished. Affected users: ${affectedUsers}.`
      );
    }
  } catch (error) {
    console.error("❌ Error during applyInterest function:", error);
  } finally {
    scheduleNextInterestApplication();
    console.log("🗓️ Next interest application scheduled.");
  }
}

function scheduleNextInterestApplication() {
  if (interestTimeoutId) {
    clearTimeout(interestTimeoutId);
    interestTimeoutId = null;
  }

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(now.getHours() + 1, 0, 0, 0);

  const delay = nextHour.getTime() - now.getTime();

  console.log(
    `🕰️ Scheduling next interest check in ${Math.round(
      delay / 60000
    )} minutes (at ${nextHour.toLocaleTimeString()}).`
  );

  interestTimeoutId = setTimeout(applyInterestAndReschedule, delay);
}

function clearInterestTimers() {
  if (interestTimeoutId) {
    clearTimeout(interestTimeoutId);
    interestTimeoutId = null;
    console.log("🛑 Cleared scheduled interest timer.");
  }
}

module.exports = {
  scheduleNextInterestApplication,
  clearInterestTimers,
  applyInterest: applyInterestAndReschedule,
};
