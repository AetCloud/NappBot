const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { database } = require("../../utils/database");

// Centralized function to ensure all necessary Walltaker tables exist
async function ensureWalltakerTablesExist() {
  try {
    // Create settings table (guild_id is primary key)
    await database.execute(`
      CREATE TABLE IF NOT EXISTS walltaker_settings (
        guild_id VARCHAR(50) PRIMARY KEY,
        feed_id VARCHAR(50) NOT NULL,
        channel_id VARCHAR(50) NOT NULL
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `);

    // Create history table (auto-incrementing ID, stores posts over time)
    await database.execute(`
      CREATE TABLE IF NOT EXISTS walltaker_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(50) NOT NULL,
        image_url TEXT NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_posted (guild_id, posted_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `);
    // Note: Removed walltaker_last_posted table creation as history table replaces its function.

    console.log("✅ Walltaker tables (settings & history) ensured.");
  } catch (error) {
    console.error("❌ Error ensuring Walltaker tables exist:", error);
    // Depending on the error, you might want to throw it or handle differently
  }
}

// Call this function once when the module loads or during bot initialization
// We call it here to ensure tables are checked/created when the command *might* be used
// Or alternatively, call this reliably during your main bot startup sequence in index.js
ensureWalltakerTablesExist();

async function setWalltakerSettings(guildId, feedId, channelId) {
  try {
    // Use INSERT ... ON DUPLICATE KEY UPDATE for settings
    await database.execute(
      `INSERT INTO walltaker_settings (guild_id, feed_id, channel_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE feed_id = VALUES(feed_id), channel_id = VALUES(channel_id);`,
      [guildId, feedId, channelId]
    );
    return true;
  } catch (error) {
    console.error("❌ MySQL Error (setWalltakerSettings):", error);
    return false;
  }
}

// Note: getWalltakerSettings, getLastPostedImage, saveLastPostedImage are primarily
// used by walltakerManager.js, so they don't necessarily need to be duplicated
// or exported here unless this command module also needs them directly.
// The versions in walltakerManager.js should now work once the table exists.

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setwalltaker")
    .setDescription(
      "📌 Set the Walltaker feed ID and channel for auto-posting."
    )
    .addStringOption((option) =>
      option
        .setName("feed_id")
        .setDescription("Enter the Walltaker Feed ID.")
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Select the channel to post images in.")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild), // Permissions for who can run the command

  async execute(interaction) {
    // Ensure command is used in a server
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
    }

    // Check if the member has the required permissions
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content:
          "❌ You must have the **Manage Server** permission to use this command.",
        ephemeral: true,
      });
    }

    const feedId = interaction.options.getString("feed_id");
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    // Ensure the selected channel is a text-based channel
    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: "❌ You must select a valid **text channel**.",
        ephemeral: true,
      });
    }

    // Attempt to save the settings to the database
    const success = await setWalltakerSettings(guildId, feedId, channel.id);

    // Reply to the user based on success or failure
    if (success) {
      await interaction.reply({
        // Made reply non-ephemeral to confirm publicly
        content: `✅ Walltaker settings updated!\n🔗 **Feed ID:** ${feedId}\n📢 **Channel:** ${channel}`,
      });
    } else {
      await interaction.reply({
        content:
          "❌ Failed to save Walltaker settings. Please check bot logs and try again.",
        ephemeral: true, // Keep error ephemeral
      });
    }
  },

  // Export module path if needed elsewhere, otherwise optional
  modulePath: __filename,
};
