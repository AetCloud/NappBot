const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require("discord.js");
const { getVerificationConfig } = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("verify")
    .setDescription("👤 Start the age verification process for this server.")
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;
    const config = await getVerificationConfig(guildId);

    if (!config) {
      return interaction.reply({
        content:
          "❌ Age verification is not enabled or configured on this server.",
        ephemeral: true,
      });
    }

    const member = interaction.member;
    if (member.roles.cache.has(config.verified_role_id)) {
      return interaction.reply({
        content: "✅ You are already verified on this server.",
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`age_verification_modal_${guildId}`)
      .setTitle("Age Verification Form");

    const socialLinkInput = new TextInputBuilder()
      .setCustomId("social_link")
      .setLabel("X (Twitter) or Bluesky Link")
      .setPlaceholder(
        "https://twitter.com/username OR https://bsky.app/profile/handle.bsky.social"
      )
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const ageInput = new TextInputBuilder()
      .setCustomId("declared_age")
      .setLabel("Your Age")
      .setPlaceholder("Enter your current age (e.g., 18)")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const dobInput = new TextInputBuilder()
      .setCustomId("date_of_birth")
      .setLabel("Date of Birth (YYYY-MM-DD)")
      .setPlaceholder("Example: 1999-12-31")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(10);

    const firstActionRow = new ActionRowBuilder().addComponents(
      socialLinkInput
    );
    const secondActionRow = new ActionRowBuilder().addComponents(ageInput);
    const thirdActionRow = new ActionRowBuilder().addComponents(dobInput);

    modal.addComponents(firstActionRow, secondActionRow, thirdActionRow);

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error("Failed to show verification modal:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content:
              "❌ Could not display the verification form. Please try again.",
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            content:
              "❌ Could not display the verification form. Please try again.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
  modulePath: __filename,
};
