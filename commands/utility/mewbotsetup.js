const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const {
  setMewbotWatchConfig,
  setMewbotOutputChannel,
  disableMewbotHelper,
} = require("../../utils/database");

const MEWBOT_USER_ID = "519850436899897346";

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mewbotsetup")
    .setDescription("🔧 Configure or disable the Mewbot helper settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("🔧 Set up or update Mewbot helper channels and mode.")
        .addStringOption((option) =>
          option
            .setName("watch_mode")
            .setDescription("Where to look for Mewbot messages.")
            .setRequired(true)
            .addChoices(
              { name: "Specific Channel", value: "specific" },
              { name: "All Channels", value: "all" }
            )
        )
        .addChannelOption(
          (option) =>
            option
              .setName("watch_channel")
              .setDescription(
                "The specific channel to watch (if watch_mode is 'specific')."
              )
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false)
        )
        .addChannelOption((option) =>
          option
            .setName("output_channel")
            .setDescription(
              "Where to send the guess messages (optional, defaults to Mewbot's channel)."
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disable")
        .setDescription("❌ Disable the Mewbot helper feature for this server.")
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    try {
      await interaction.deferReply({ ephemeral: true });

      if (subcommand === "setup") {
        const watchMode = interaction.options.getString("watch_mode");
        const watchChannel = interaction.options.getChannel("watch_channel");
        const outputChannel = interaction.options.getChannel("output_channel");
        const mewbotUserId = MEWBOT_USER_ID;

        if (watchMode === "specific" && !watchChannel) {
          return interaction.editReply(
            "❌ You must select a 'watch_channel' when using 'specific' mode."
          );
        }
        if (watchMode === "all" && watchChannel) {
          await interaction.followUp({
            content:
              "ℹ️ You selected 'all' channels mode, the specific 'watch_channel' will be ignored.",
            ephemeral: true,
          });
        }

        const watchSuccess = await setMewbotWatchConfig(
          guildId,
          watchMode,
          watchChannel?.id,
          mewbotUserId
        );

        const outputSuccess = await setMewbotOutputChannel(
          guildId,
          outputChannel?.id
        );

        if (watchSuccess && outputSuccess) {
          const watchChannelText =
            watchChannel && watchMode === "specific"
              ? `${watchChannel}`
              : watchMode === "all"
              ? "All Channels"
              : "Not Set";
          const outputChannelText = outputChannel
            ? `${outputChannel}`
            : "Same as Mewbot message channel";
          await interaction.editReply(
            `✅ Mewbot helper configured!\n` +
              `**Mewbot User ID:** \`${mewbotUserId}\` (Fixed)\n` +
              `**Watch Mode:** ${watchMode}\n` +
              `**Watch Channel:** ${watchChannelText}\n` +
              `**Output Channel:** ${outputChannelText}`
          );
        } else {
          await interaction.editReply(
            "❌ Failed to save Mewbot helper settings to the database."
          );
        }
      } else if (subcommand === "disable") {
        const success = await disableMewbotHelper(guildId);
        if (success) {
          await interaction.editReply(
            "✅ Mewbot helper has been disabled for this server."
          );
        } else {
          await interaction.editReply(
            "❌ Failed to disable the Mewbot helper. It might already be disabled or an error occurred."
          );
        }
      }
    } catch (error) {
      console.error("❌ Error executing /mewbotsetup command:", error);
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
