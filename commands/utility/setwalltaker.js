const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { database, ensureTableExists } = require("../../utils/database");

async function ensureRequiredWalltakerTables() {
  await ensureTableExists("walltaker_settings");
  await ensureTableExists("walltaker_last_posted");
  console.log(
    "✅ Walltaker settings & last_posted tables ensured by setwalltaker command init."
  );
}
ensureRequiredWalltakerTables();

async function setWalltakerSettings(guildId, feedId, channelId) {
  try {
    await database.execute(
      `INSERT INTO walltaker_settings (guild_id, feed_id, channel_id)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE feed_id = VALUES(feed_id), channel_id = VALUES(channel_id);`,
      [String(guildId).trim(), String(feedId).trim(), String(channelId).trim()]
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
        .setDescription(
          "Enter the Walltaker Feed ID (e.g., joi.how/links/YOUR_ID)."
        )
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Select the text channel to post images in.")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

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

    if (
      !channel ||
      !channel.isTextBased() ||
      channel.type !== ChannelType.GuildText
    ) {
      return interaction.reply({
        content: "❌ You must select a valid **text channel**.",
        ephemeral: true,
      });
    }

    await ensureTableExists("walltaker_settings");
    await ensureTableExists("walltaker_last_posted");

    const success = await setWalltakerSettings(guildId, feedId, channel.id);

    if (success) {
      await interaction.reply({
        content: `✅ Walltaker auto-posting updated!\n🔗 **Feed ID:** \`${feedId}\`\n📢 **Channel:** ${channel}`,
        ephemeral: true,
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
