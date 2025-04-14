const mysql = require("mysql2/promise");
const { URL } = require("node:url");

const dbUrl = process.env.MYSQL_PUBLIC_URL;
if (!dbUrl) {
  console.error("❌ MYSQL_PUBLIC_URL is not set in environment variables!");
  process.exit(1);
}

let databasePool;
const checkedTables = new Set(); // Keep track of tables checked in this session

try {
  const dbUri = new URL(dbUrl);
  const dbName = dbUri.pathname.replace("/", "").trim();

  if (!dbName) {
    throw new Error("Invalid MySQL Database Name");
  }

  databasePool = mysql.createPool({
    host: dbUri.hostname,
    port: dbUri.port || "3306",
    user: dbUri.username || "root",
    password: dbUri.password || "",
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    charset: "utf8mb4_general_ci",
  });

  console.log("✅ MySQL Connection Pool Created");

  async function testDatabaseConnection() {
    try {
      const conn = await databasePool.getConnection();
      console.log("✅ MySQL Connection Successful");
      conn.release();
    } catch (err) {
      console.error("❌ MySQL Connection Test Failed:", err.message || err);
      process.exit(1);
    }
  }

  testDatabaseConnection();
} catch (error) {
  console.error("❌ Failed to initialize MySQL:", error.message || error);
  process.exit(1);
}

// --- Table Definitions ---
const TABLE_DEFS = {
  mewbot_config: `
        CREATE TABLE IF NOT EXISTS mewbot_config (
            guild_id VARCHAR(30) PRIMARY KEY NOT NULL,
            watch_mode ENUM('all', 'specific') NOT NULL DEFAULT 'specific',
            watch_channel_id VARCHAR(30) NULL DEFAULT NULL,
            output_channel_id VARCHAR(30) NULL DEFAULT NULL,
            mewbot_user_id VARCHAR(30) NULL DEFAULT NULL,
            enabled BOOLEAN NOT NULL DEFAULT FALSE
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
  user_preferences: `
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id VARCHAR(30) PRIMARY KEY NOT NULL,
            preference ENUM('male', 'female', 'random') NULL DEFAULT NULL
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
  users: `
        CREATE TABLE IF NOT EXISTS users (
            user_id VARCHAR(30) PRIMARY KEY NOT NULL,
            balance BIGINT UNSIGNED NOT NULL DEFAULT 5000,
            bank_balance BIGINT UNSIGNED NOT NULL DEFAULT 0,
            streak INT NOT NULL DEFAULT 0,
            last_work TIMESTAMP NULL DEFAULT NULL,
            last_interest TIMESTAMP NULL DEFAULT NULL,
            active_last TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
  user_installations: `
        CREATE TABLE IF NOT EXISTS user_installations (
            user_id VARCHAR(50) PRIMARY KEY NOT NULL,
            access_token_hash VARCHAR(128) NOT NULL,
            refresh_token_hash VARCHAR(128) NOT NULL,
            installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
};

// --- Helper Functions ---

// Generic query executor
async function executeQuery(query, params = []) {
  if (!databasePool) {
    console.error("❌ Database pool not initialized!");
    return null;
  }
  try {
    const [rows] = await databasePool.execute(query, params);
    return rows;
  } catch (error) {
    console.error(
      `❌ MySQL Error: ${error.code || "Unknown"} - ${
        error.sqlMessage || error.message
      } | Query: ${query.substring(0, 100)}...`
    );
    // Consider throwing the error for critical operations or returning null/empty array
    return null;
  }
}

// Ensures a table exists, runs CREATE TABLE IF NOT EXISTS only once per session
async function ensureTableExists(tableName) {
  if (checkedTables.has(tableName)) {
    return; // Already checked this session
  }
  const query = TABLE_DEFS[tableName];
  if (!query) {
    console.error(`❌ No table definition found for ${tableName}`);
    return;
  }
  try {
    await executeQuery(query);
    checkedTables.add(tableName); // Mark as checked
    // console.log(`✅ Ensured table exists: ${tableName}`); // Optional: for debugging
  } catch (error) {
    console.error(`❌ Failed to ensure table exists: ${tableName}`, error);
    // Decide if you need to stop the bot or handle this failure
  }
}

// --- User Preferences ---
async function getUserPreference(userId) {
  await ensureTableExists("user_preferences");
  const rows = await executeQuery(
    "SELECT preference FROM user_preferences WHERE user_id = ?",
    [userId.trim()]
  );
  return rows?.length ? rows[0].preference : null;
}

async function setUserPreference(userId, preference) {
  if (!["male", "female", "random"].includes(preference)) return false;
  await ensureTableExists("user_preferences");
  return !!(await executeQuery(
    "INSERT INTO user_preferences (user_id, preference) VALUES (?, ?) ON DUPLICATE KEY UPDATE preference = ?",
    [userId.trim(), preference, preference]
  ));
}

// --- User Data (Economy, Streaks, Activity) ---
async function ensureUserRowExists(userId) {
  await ensureTableExists("users"); // Make sure 'users' table is checked
  const rows = await executeQuery(
    "SELECT user_id FROM users WHERE user_id = ?",
    [userId]
  );
  if (!rows || rows.length === 0) {
    await executeQuery(
      "INSERT INTO users (user_id, balance, bank_balance, streak, last_work, last_interest, active_last) VALUES (?, ?, ?, 0, NULL, NULL, NOW())",
      [userId, 5000, 0] // Default values
    );
    // console.log(`Created new user entry for ${userId}`); // Optional debug log
  }
}

async function getUserLastWork(userId) {
  await ensureUserRowExists(userId);
  const rows = await executeQuery(
    "SELECT last_work FROM users WHERE user_id = ?",
    [userId]
  );
  return rows?.length ? rows[0].last_work : null;
}

async function updateUserLastWork(userId) {
  await ensureUserRowExists(userId);
  await executeQuery(
    "UPDATE users SET last_work = NOW(), active_last = NOW() WHERE user_id = ?",
    [userId]
  );
}

async function getUserBalance(userId) {
  await ensureUserRowExists(userId);
  const rows = await executeQuery(
    "SELECT balance, bank_balance, streak FROM users WHERE user_id = ?",
    [userId]
  );
  return rows[0]; // Should exist after ensureUserRowExists
}

async function updateUserBalance(userId, walletChange = 0, bankChange = 0) {
  if (!userId) {
    console.error("❌ updateUserBalance Error: userId is undefined or null.");
    return false;
  }
  await ensureUserRowExists(userId);
  return !!(await executeQuery(
    `UPDATE users
     SET balance = balance + ?, bank_balance = bank_balance + ?, active_last = NOW()
     WHERE user_id = ?`,
    [walletChange, bankChange, userId]
  ));
}

async function getUserStreak(userId) {
  await ensureUserRowExists(userId);
  const rows = await executeQuery(
    "SELECT streak FROM users WHERE user_id = ?",
    [userId]
  );
  return rows?.[0]?.streak ?? 0; // Default to 0 if somehow still no row/streak
}

async function updateStreak(userId, result) {
  if (!userId || !["win", "loss"].includes(result)) {
    console.error(
      `❌ updateStreak Error: Invalid userId or result - ${userId}, ${result}`
    );
    return false;
  }
  await ensureUserRowExists(userId);

  const currentStreak = await getUserStreak(userId); // Use the function to get current streak

  let newStreak;
  if (result === "win") {
    newStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
  } else {
    // result === "loss"
    newStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
  }

  return !!(await executeQuery(
    "UPDATE users SET streak = ?, active_last = NOW() WHERE user_id = ?",
    [newStreak, userId]
  ));
}

async function markUserActive(userId) {
  await ensureUserRowExists(userId);
  await executeQuery("UPDATE users SET active_last = NOW() WHERE user_id = ?", [
    userId,
  ]);
}

// --- User Installation (OAuth) ---
async function storeUserInstallation(
  userId,
  accessTokenHash,
  refreshTokenHash
) {
  await ensureTableExists("user_installations");
  try {
    await executeQuery(
      `INSERT INTO user_installations (user_id, access_token_hash, refresh_token_hash)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE access_token_hash = VALUES(access_token_hash), refresh_token_hash = VALUES(refresh_token_hash), installed_at = NOW()`,
      [userId, accessTokenHash, refreshTokenHash]
    );
    return true;
  } catch (error) {
    console.error(`❌ Failed to store installation for user ${userId}:`, error);
    return false;
  }
}

// --- Mewbot Config Functions ---

async function getMewbotConfig(guildId) {
  if (!guildId) return null;
  await ensureTableExists("mewbot_config");
  const rows = await executeQuery(
    "SELECT watch_mode, watch_channel_id, output_channel_id, mewbot_user_id, enabled FROM mewbot_config WHERE guild_id = ?",
    [guildId]
  );
  // Return default structure if no row exists for the guild
  return rows?.length
    ? rows[0]
    : {
        enabled: false,
        watch_mode: "specific",
        watch_channel_id: null,
        output_channel_id: null,
        mewbot_user_id: null,
      };
}

async function setMewbotWatchConfig(
  guildId,
  mode,
  channelId = null,
  mewbotUserId = null
) {
  if (!guildId || !["all", "specific"].includes(mode)) return false;
  await ensureTableExists("mewbot_config");
  const watchChannel = mode === "specific" && channelId ? channelId : null;
  const mewbotIdToSet = mewbotUserId ? mewbotUserId : null;

  return !!(await executeQuery(
    `INSERT INTO mewbot_config (guild_id, watch_mode, watch_channel_id, mewbot_user_id, enabled)
     VALUES (?, ?, ?, ?, TRUE)
     ON DUPLICATE KEY UPDATE watch_mode = VALUES(watch_mode), watch_channel_id = VALUES(watch_channel_id), mewbot_user_id = COALESCE(?, mewbot_user_id), enabled = TRUE`,
    [guildId, mode, watchChannel, mewbotIdToSet, mewbotIdToSet] // Pass mewbotIdToSet twice for COALESCE
  ));
}

async function setMewbotOutputChannel(guildId, channelId) {
  if (!guildId) return false;
  await ensureTableExists("mewbot_config");
  const outputChannel = channelId ? channelId : null;
  return !!(await executeQuery(
    `INSERT INTO mewbot_config (guild_id, output_channel_id, enabled)
     VALUES (?, ?, TRUE)
     ON DUPLICATE KEY UPDATE output_channel_id = VALUES(output_channel_id), enabled = TRUE`,
    [guildId, outputChannel]
  ));
}

async function setMewbotUserId(guildId, mewbotUserId) {
  if (!guildId || !mewbotUserId) return false;
  await ensureTableExists("mewbot_config");
  return !!(await executeQuery(
    `INSERT INTO mewbot_config (guild_id, mewbot_user_id, enabled)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE mewbot_user_id = VALUES(mewbot_user_id), enabled = TRUE`,
    [guildId, mewbotUserId]
  ));
}

async function disableMewbotHelper(guildId) {
  if (!guildId) return false;
  await ensureTableExists("mewbot_config"); // Ensure table exists before trying to update
  // Check if a row exists before updating, or just let the UPDATE potentially affect 0 rows
  const result = await executeQuery(
    "UPDATE mewbot_config SET enabled = FALSE WHERE guild_id = ?",
    [guildId]
  );
  // Check if the update was successful or if the row existed
  return result && result.affectedRows > 0; // More robust check
}

// --- Exports ---
if (!databasePool) {
  console.error("❌ MySQL connection pool failed to initialize. Exiting.");
  process.exit(1);
}

module.exports = {
  database: databasePool, // Export the pool directly if needed
  executeQuery, // Export the helper if useful elsewhere
  ensureTableExists, // Export if needed for explicit checks elsewhere
  // User Preferences
  getUserPreference,
  setUserPreference,
  // User Data (Economy, etc.)
  ensureUserRowExists, // Exported for potential direct use
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  getUserLastWork,
  updateUserLastWork,
  markUserActive,
  // OAuth / Installation
  storeUserInstallation,
  // Mewbot Config
  getMewbotConfig,
  setMewbotWatchConfig,
  setMewbotOutputChannel,
  setMewbotUserId,
  disableMewbotHelper,
};
