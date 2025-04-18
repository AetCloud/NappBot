const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { getMewbotConfig } = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mewbotsettings")
    .setDescription("⚙️ View the current Mewbot helper settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("👀 View the current Mewbot helper configuration.")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      if (subcommand === "view") {
        const config = await getMewbotConfig(guildId);

        if (!config || !config.enabled) {
          return interaction.editReply(
            "ℹ️ The Mewbot helper is currently disabled or not configured for this server. Use `/mewbotsetup setup` to enable it."
          );
        }

        let watchChannelName = "N/A";
        if (config.watch_mode === "specific" && config.watch_channel_id) {
          try {
            const channel = await interaction.guild.channels
              .fetch(config.watch_channel_id)
              .catch(() => null);
            watchChannelName = channel
              ? `<#${channel.id}>`
              : "`Invalid/Deleted Channel`";
          } catch {
            watchChannelName = "`Error Fetching Channel`";
          }
        } else if (config.watch_mode === "all") {
          watchChannelName = "`All Accessible Channels`";
        }

        let outputChannelName = "`Same as Mewbot's`";
        if (config.output_channel_id) {
          try {
            const channel = await interaction.guild.channels
              .fetch(config.output_channel_id)
              .catch(() => null);
            outputChannelName = channel
              ? `<#${channel.id}>`
              : "`Invalid/Deleted Channel`";
          } catch {
            outputChannelName = "`Error Fetching Channel`";
          }
        }

        const embed = new EmbedBuilder()
          .setTitle("👀 Mewbot Helper Configuration")
          .setColor(config.enabled ? "#57F287" : "#ED4245")
          .addFields(
            {
              name: "Status",
              value: config.enabled ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            },
            {
              name: "Mewbot User ID",
              value: config.mewbot_user_id
                ? `\`${config.mewbot_user_id}\` (Fixed)`
                : "`Not Set`",
              inline: true,
            },
            {
              name: "Watch Mode",
              value: `\`${config.watch_mode}\``,
              inline: true,
            },
            { name: "Watch Channel", value: watchChannelName, inline: false },
            { name: "Output Channel", value: outputChannelName, inline: false }
          )
          .setFooter({ text: `Guild ID: ${guildId}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("❌ Error executing /mewbotsettings command:", error);
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "❌ An error occurred while processing the command.",
            ephemeral: true,
          });
        } catch {
          try {
            await interaction.editReply({
              content: "❌ An error occurred while processing the command.",
            });
          } catch (editError) {
            console.error("❌ Failed to send error reply:", editError);
          }
        }
      } else if (interaction.deferred) {
        await interaction
          .editReply({
            content: "❌ An error occurred while processing the command.",
          })
          .catch((e) => console.error("❌ Failed to edit deferred reply:", e));
      }
    }
  },
  modulePath: __filename,
};
