const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const {
  setVerificationConfig,
  disableVerification,
} = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify-setup")
    .setDescription(
      "🔧 Configure or disable the age verification system for this server."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("configure")
        .setDescription("Set the moderator channel and verified role.")
        .addChannelOption((option) =>
          option
            .setName("moderator_channel")
            .setDescription(
              "The channel where verification requests will be sent."
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("verified_role")
            .setDescription("The role to assign upon successful verification.")
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName("enabled")
            .setDescription(
              "Enable or disable the verification system (default: true)"
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("disable")
        .setDescription(
          "❌ Disable the age verification system for this server."
        )
    ),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      if (subcommand === "configure") {
        const modChannel = interaction.options.getChannel("moderator_channel");
        const verifiedRole = interaction.options.getRole("verified_role");
        const enabled = interaction.options.getBoolean("enabled") ?? true;

        const botMember = await interaction.guild.members.fetch(
          interaction.client.user.id
        );
        const permissions = modChannel.permissionsFor(botMember);
        if (
          !permissions.has(PermissionFlagsBits.SendMessages) ||
          !permissions.has(PermissionFlagsBits.EmbedLinks)
        ) {
          return interaction.editReply({
            content: `❌ I need 'Send Messages' and 'Embed Links' permissions in ${modChannel} to function correctly.`,
            ephemeral: true,
          });
        }
        if (verifiedRole.position >= botMember.roles.highest.position) {
          return interaction.editReply({
            content: `❌ The role ${verifiedRole} is higher than or equal to my highest role. Please move my role above it in the server settings.`,
            ephemeral: true,
          });
        }

        const success = await setVerificationConfig(
          guildId,
          modChannel.id,
          verifiedRole.id,
          enabled
        );

        if (success) {
          await interaction.editReply(
            `✅ Verification system ${
              enabled ? "enabled" : "disabled"
            } and configured!\n` +
              `**Moderator Channel:** ${modChannel}\n` +
              `**Verified Role:** ${verifiedRole}`
          );
        } else {
          await interaction.editReply(
            "❌ Failed to save configuration to the database."
          );
        }
      } else if (subcommand === "disable") {
        const success = await disableVerification(guildId);
        if (success) {
          await interaction.editReply(
            "✅ Age verification system has been disabled for this server."
          );
        } else {
          await interaction.editReply(
            "❌ Failed to disable the system. It might already be disabled or not configured."
          );
        }
      }
    } catch (error) {
      console.error("Error executing /verify-setup:", error);
      await interaction.editReply(
        "❌ An error occurred while processing the command."
      );
    }
  },
  modulePath: __filename,
};
