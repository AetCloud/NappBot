const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { database } = require("../../utils/database");

async function ensureWalltakerTablesExist() {
  try {
    await database.execute(`
      CREATE TABLE IF NOT EXISTS walltaker_settings (
        guild_id VARCHAR(50) PRIMARY KEY,
        feed_id VARCHAR(50) NOT NULL,
        channel_id VARCHAR(50) NOT NULL
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS walltaker_history (
        history_id INT AUTO_INCREMENT PRIMARY KEY,
        guild_id VARCHAR(50) NOT NULL,
        image_url TEXT NOT NULL,
        posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_guild_posted (guild_id, posted_at)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    `);

    console.log("✅ Walltaker tables (settings & history) ensured.");
  } catch (error) {
    console.error("❌ Error ensuring Walltaker tables exist:", error);
  }
}

ensureWalltakerTablesExist();

async function setWalltakerSettings(guildId, feedId, channelId) {
  try {
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
    }

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

    if (!channel || !channel.isTextBased()) {
      return interaction.reply({
        content: "❌ You must select a valid **text channel**.",
        ephemeral: true,
      });
    }

    const success = await setWalltakerSettings(guildId, feedId, channel.id);

    if (success) {
      await interaction.reply({
        content: `✅ Walltaker settings updated!\n🔗 **Feed ID:** ${feedId}\n📢 **Channel:** ${channel}`,
      });
    } else {
      await interaction.reply({
        content:
          "❌ Failed to save Walltaker settings. Please check bot logs and try again.",
        ephemeral: true,
      });
    }
  },

  modulePath: __filename,
};
