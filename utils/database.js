const mysql = require("mysql2/promise");
const { URL } = require("node:url");

const dbUrl = process.env.MYSQL_PUBLIC_URL;
if (!dbUrl) {
  console.error("❌ MYSQL_PUBLIC_URL is not set in environment variables!");
  process.exit(1);
}

let databasePool;
const checkedTables = new Set();

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
  walltaker_settings: `
        CREATE TABLE IF NOT EXISTS walltaker_settings (
            guild_id VARCHAR(50) PRIMARY KEY,
            feed_id VARCHAR(50) NOT NULL,
            channel_id VARCHAR(50) NOT NULL
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
  walltaker_last_posted: `
        CREATE TABLE IF NOT EXISTS walltaker_last_posted (
            guild_id VARCHAR(50) PRIMARY KEY NOT NULL,
            image_url TEXT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
  verification_config: `
        CREATE TABLE IF NOT EXISTS verification_config (
            guild_id VARCHAR(30) PRIMARY KEY NOT NULL,
            moderator_channel_id VARCHAR(30) NOT NULL,
            verified_role_id VARCHAR(30) NOT NULL,
            enabled BOOLEAN NOT NULL DEFAULT FALSE
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `,
};

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
    return null;
  }
}

async function ensureTableExists(tableName) {
  if (checkedTables.has(tableName)) {
    return;
  }
  const query = TABLE_DEFS[tableName];
  if (!query) {
    console.error(`❌ No table definition found for ${tableName}`);
    return;
  }
  try {
    await executeQuery(query);
    console.log(`✅ Table ensured: ${tableName}`);
    checkedTables.add(tableName);
  } catch (error) {
    console.error(`❌ Failed to ensure table exists: ${tableName}`, error);
  }
}

async function getUserPreference(userId) {
  if (!userId) return null;
  await ensureTableExists("user_preferences");
  const rows = await executeQuery(
    "SELECT preference FROM user_preferences WHERE user_id = ?",
    [String(userId).trim()]
  );
  return rows?.length ? rows[0].preference : null;
}

async function setUserPreference(userId, preference) {
  if (!userId || !["male", "female", "random"].includes(preference))
    return false;
  await ensureTableExists("user_preferences");
  return !!(await executeQuery(
    "INSERT INTO user_preferences (user_id, preference) VALUES (?, ?) ON DUPLICATE KEY UPDATE preference = ?",
    [String(userId).trim(), preference, preference]
  ));
}

async function ensureUserRowExists(userId) {
  if (!userId) return;
  await ensureTableExists("users");
  await executeQuery(
    "INSERT IGNORE INTO users (user_id, balance, bank_balance, streak, last_work, last_interest, active_last) VALUES (?, ?, ?, 0, NULL, NULL, NOW())",
    [String(userId).trim(), 5000, 0]
  );
}

async function getUserLastWork(userId) {
  if (!userId) return null;
  await ensureUserRowExists(String(userId).trim());
  const rows = await executeQuery(
    "SELECT last_work FROM users WHERE user_id = ?",
    [String(userId).trim()]
  );
  return rows?.length ? rows[0].last_work : null;
}

async function updateUserLastWork(userId) {
  if (!userId) return false;
  await ensureUserRowExists(String(userId).trim());
  return !!(await executeQuery(
    "UPDATE users SET last_work = NOW(), active_last = NOW() WHERE user_id = ?",
    [String(userId).trim()]
  ));
}

async function getUserBalance(userId) {
  if (!userId) return { balance: 0, bank_balance: 0, streak: 0 };
  await ensureUserRowExists(String(userId).trim());
  const rows = await executeQuery(
    "SELECT balance, bank_balance, streak FROM users WHERE user_id = ?",
    [String(userId).trim()]
  );
  return rows?.[0] ?? { balance: 0, bank_balance: 0, streak: 0 };
}

async function updateUserBalance(userId, walletChange = 0, bankChange = 0) {
  if (!userId) {
    console.error("❌ updateUserBalance Error: userId is undefined or null.");
    return false;
  }
  await ensureUserRowExists(String(userId).trim());
  return !!(await executeQuery(
    `UPDATE users
     SET balance = GREATEST(0, CAST(balance AS SIGNED) + CAST(? AS SIGNED)),
         bank_balance = GREATEST(0, CAST(bank_balance AS SIGNED) + CAST(? AS SIGNED)),
         active_last = NOW()
     WHERE user_id = ?`,
    [walletChange, bankChange, String(userId).trim()]
  ));
}

async function getUserStreak(userId) {
  if (!userId) return 0;
  await ensureUserRowExists(String(userId).trim());
  const rows = await executeQuery(
    "SELECT streak FROM users WHERE user_id = ?",
    [String(userId).trim()]
  );
  return rows?.[0]?.streak ?? 0;
}

async function updateStreak(userId, result) {
  if (!userId || !["win", "loss"].includes(result)) {
    console.error(
      `❌ updateStreak Error: Invalid userId or result - ${userId}, ${result}`
    );
    return false;
  }
  await ensureUserRowExists(String(userId).trim());

  const query = `
        UPDATE users
        SET streak = CASE
            WHEN ? = 'win' THEN IF(streak >= 0, streak + 1, 1)
            WHEN ? = 'loss' THEN IF(streak <= 0, streak - 1, -1)
            ELSE streak -- Should not happen with input validation
        END,
        active_last = NOW()
        WHERE user_id = ?
    `;
  return !!(await executeQuery(query, [result, result, String(userId).trim()]));
}

async function markUserActive(userId) {
  if (!userId) return false;
  await ensureUserRowExists(String(userId).trim());
  return !!(await executeQuery(
    "UPDATE users SET active_last = NOW() WHERE user_id = ?",
    [String(userId).trim()]
  ));
}

async function storeUserInstallation(
  userId,
  accessTokenHash,
  refreshTokenHash
) {
  if (!userId || !accessTokenHash || !refreshTokenHash) return false;
  await ensureTableExists("user_installations");
  try {
    return !!(await executeQuery(
      `INSERT INTO user_installations (user_id, access_token_hash, refresh_token_hash)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE access_token_hash = VALUES(access_token_hash), refresh_token_hash = VALUES(refresh_token_hash), installed_at = NOW()`,
      [String(userId).trim(), accessTokenHash, refreshTokenHash]
    ));
  } catch (error) {
    console.error(`❌ Failed to store installation for user ${userId}:`, error);
    return false;
  }
}

async function getLastPostedImage(guildId) {
  if (!guildId) return null;
  await ensureTableExists("walltaker_last_posted");
  const rows = await executeQuery(
    "SELECT image_url FROM walltaker_last_posted WHERE guild_id = ?",
    [String(guildId).trim()]
  );
  return rows?.[0]?.image_url || null;
}

async function saveLastPostedImage(guildId, imageUrl) {
  if (!guildId || typeof imageUrl !== "string") return false;
  await ensureTableExists("walltaker_last_posted");
  return !!(await executeQuery(
    `INSERT INTO walltaker_last_posted (guild_id, image_url, last_updated)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), last_updated = NOW()`,
    [String(guildId).trim(), imageUrl.trim()]
  ));
}

async function setVerificationConfig(guildId, modChannelId, roleId, enabled) {
  if (!guildId || !modChannelId || !roleId) return false;
  await ensureTableExists("verification_config");
  return !!(await executeQuery(
    `INSERT INTO verification_config (guild_id, moderator_channel_id, verified_role_id, enabled)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            moderator_channel_id = VALUES(moderator_channel_id),
            verified_role_id = VALUES(verified_role_id),
            enabled = VALUES(enabled)`,
    [
      String(guildId).trim(),
      String(modChannelId).trim(),
      String(roleId).trim(),
      Boolean(enabled),
    ]
  ));
}

async function getVerificationConfig(guildId) {
  if (!guildId) return null;
  await ensureTableExists("verification_config");
  const rows = await executeQuery(
    "SELECT moderator_channel_id, verified_role_id, enabled FROM verification_config WHERE guild_id = ?",
    [String(guildId).trim()]
  );
  return rows?.[0] && rows[0].enabled ? rows[0] : null;
}

async function disableVerification(guildId) {
  if (!guildId) return false;
  await ensureTableExists("verification_config");
  const result = await executeQuery(
    "UPDATE verification_config SET enabled = FALSE WHERE guild_id = ?",
    [String(guildId).trim()]
  );
  return result && result.affectedRows > 0;
}

async function getMewbotConfig(guildId) {
  if (!guildId) return null;
  await ensureTableExists("mewbot_config");
  const rows = await executeQuery(
    "SELECT watch_mode, watch_channel_id, output_channel_id, mewbot_user_id, enabled FROM mewbot_config WHERE guild_id = ?",
    [String(guildId).trim()]
  );
  return (
    rows?.[0] ?? {
      enabled: false,
      watch_mode: "specific",
      watch_channel_id: null,
      output_channel_id: null,
      mewbot_user_id: null,
    }
  );
}

async function setMewbotWatchConfig(
  guildId,
  mode,
  channelId = null,
  mewbotUserId = null
) {
  if (!guildId || !["all", "specific"].includes(mode)) return false;
  await ensureTableExists("mewbot_config");
  const watchChannel =
    mode === "specific" && channelId ? String(channelId).trim() : null;
  const mewbotIdToSet = mewbotUserId ? String(mewbotUserId).trim() : null;

  return !!(await executeQuery(
    `INSERT INTO mewbot_config (guild_id, watch_mode, watch_channel_id, mewbot_user_id, enabled)
         VALUES (?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
            watch_mode = VALUES(watch_mode),
            watch_channel_id = VALUES(watch_channel_id),
            mewbot_user_id = COALESCE(?, mewbot_user_id), -- Only update mewbot ID if provided
            enabled = TRUE`,
    [String(guildId).trim(), mode, watchChannel, mewbotIdToSet, mewbotIdToSet]
  ));
}

async function setMewbotOutputChannel(guildId, channelId) {
  if (!guildId) return false;
  await ensureTableExists("mewbot_config");
  const outputChannel = channelId ? String(channelId).trim() : null;
  return !!(await executeQuery(
    `INSERT INTO mewbot_config (guild_id, output_channel_id, enabled)
         VALUES (?, ?, TRUE)
         ON DUPLICATE KEY UPDATE output_channel_id = VALUES(output_channel_id), enabled = TRUE`,
    [String(guildId).trim(), outputChannel]
  ));
}

async function disableMewbotHelper(guildId) {
  if (!guildId) return false;
  await ensureTableExists("mewbot_config");
  const result = await executeQuery(
    "UPDATE mewbot_config SET enabled = FALSE WHERE guild_id = ?",
    [String(guildId).trim()]
  );
  return result && result.affectedRows > 0;
}

if (!databasePool) {
  console.error("❌ MySQL connection pool failed to initialize. Exiting.");
  process.exit(1);
}

module.exports = {
  database: databasePool,
  executeQuery,
  ensureTableExists,

  getUserPreference,
  setUserPreference,

  ensureUserRowExists,
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  getUserLastWork,
  updateUserLastWork,
  markUserActive,

  storeUserInstallation,

  getLastPostedImage,
  saveLastPostedImage,

  setVerificationConfig,
  getVerificationConfig,
  disableVerification,

  getMewbotConfig,
  setMewbotWatchConfig,
  setMewbotOutputChannel,
  disableMewbotHelper,
};
