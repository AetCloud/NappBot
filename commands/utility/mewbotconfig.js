const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const {
  getMewbotConfig,
  setMewbotWatchConfig,
  setMewbotOutputChannel,
  setMewbotUserId,
  disableMewbotHelper,
} = require("../../utils/database"); // Adjust path if needed

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mewbotconfig")
    .setDescription("🔧 Configure the Mewbot helper settings.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Only admins
    .setDMPermission(false) // Guild only command
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("🔧 Set up or update Mewbot helper channels and mode.")
        .addStringOption((option) =>
          option
            .setName("mewbot_user_id")
            .setDescription("The User ID of the Mewbot application.")
            .setRequired(true)
        )
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
              .addChannelTypes(ChannelType.GuildText) // Only allow text channels
              .setRequired(false) // Required conditionally based on mode
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
        .setName("view")
        .setDescription("👀 View the current Mewbot helper configuration.")
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
        const mewbotUserId = interaction.options.getString("mewbot_user_id");

        // Validate Mewbot User ID format (basic check for numbers)
        if (!/^\d+$/.test(mewbotUserId)) {
          return interaction.editReply(
            "❌ Invalid Mewbot User ID provided. It should be a sequence of numbers."
          );
        }

        // Validate watch channel requirement
        if (watchMode === "specific" && !watchChannel) {
          return interaction.editReply(
            "❌ You must select a 'watch_channel' when using 'specific' mode."
          );
        }
        if (watchMode === "all" && watchChannel) {
          // Provide feedback instead of erroring out
          await interaction.followUp({
            content:
              "ℹ️ You selected 'all' channels mode, the specific 'watch_channel' will be ignored.",
            ephemeral: true,
          });
        }

        // Save watch settings - pass watchChannel?.id which is null if not provided or mode is 'all'
        const watchSuccess = await setMewbotWatchConfig(
          guildId,
          watchMode,
          watchChannel?.id,
          mewbotUserId
        );

        // Save output channel settings (pass null if not provided to potentially clear it)
        const outputSuccess = await setMewbotOutputChannel(
          guildId,
          outputChannel?.id
        );

        if (watchSuccess && outputSuccess) {
          // Check if both operations were successful
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
              `**Mewbot User ID:** \`${mewbotUserId}\`\n` +
              `**Watch Mode:** ${watchMode}\n` +
              `**Watch Channel:** ${watchChannelText}\n` +
              `**Output Channel:** ${outputChannelText}`
          );
        } else {
          await interaction.editReply(
            "❌ Failed to save Mewbot helper settings to the database."
          );
        }
      } else if (subcommand === "view") {
        const config = await getMewbotConfig(guildId);

        if (!config || !config.enabled) {
          return interaction.editReply(
            "ℹ️ The Mewbot helper is currently disabled or not configured for this server. Use `/mewbotconfig setup` to enable it."
          );
        }

        let watchChannelName = "N/A";
        if (config.watch_mode === "specific" && config.watch_channel_id) {
          try {
            // Use interaction.guild.channels.fetch to ensure it's fetched from the correct guild cache
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
          .setColor(config.enabled ? "#57F287" : "#ED4245") // Green if enabled, Red if disabled
          .addFields(
            {
              name: "Status",
              value: config.enabled ? "✅ Enabled" : "❌ Disabled",
              inline: true,
            },
            {
              name: "Mewbot User ID",
              value: config.mewbot_user_id
                ? `\`${config.mewbot_user_id}\``
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
      console.error("❌ Error executing /mewbotconfig command:", error);
      if (!interaction.replied && !interaction.deferred) {
        // Use reply if possible, otherwise editReply
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
