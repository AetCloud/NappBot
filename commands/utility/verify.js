const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require("discord.js");
const { getVerificationConfig } = require("../../utils/database");
const { setDefaultFooter } = require("../../utils/embedUtils");

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

    if (!config || !config.enabled) {
      const errorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(
          "❌ Age verification is not enabled or configured on this server."
        );
      setDefaultFooter(errorEmbed, interaction.client.user);
      return interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }

    const member = interaction.member;
    if (member.roles.cache.has(config.verified_role_id)) {
      const alreadyVerifiedEmbed = new EmbedBuilder()
        .setColor("Green")
        .setDescription("✅ You are already verified on this server.");
      setDefaultFooter(alreadyVerifiedEmbed, interaction.client.user);
      return interaction.reply({
        embeds: [alreadyVerifiedEmbed],
        ephemeral: true,
      });
    }

    const modal = new ModalBuilder()
      .setCustomId(`age_verification_modal_${guildId}`)
      .setTitle("Server Verification Form");

    const components = [];
    const questions = [
      config.question1,
      config.question2,
      config.question3,
      config.question4,
    ];
    let questionCount = 0;

    questions.forEach((questionText, index) => {
      if (questionText && questionCount < 5) {
        questionCount++;
        const questionInput = new TextInputBuilder()
          .setCustomId(`custom_question_${index + 1}`)
          .setLabel(questionText.substring(0, 45))
          .setPlaceholder(`Answer for: ${questionText.substring(0, 90)}...`)
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        components.push(new ActionRowBuilder().addComponents(questionInput));
      }
    });

    if (components.length === 0) {
      const noQuestionsEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription(
          "❌ This server has verification enabled, but no questions have been configured by the administrators."
        );
      setDefaultFooter(noQuestionsEmbed, interaction.client.user);
      return interaction.reply({
        embeds: [noQuestionsEmbed],
        ephemeral: true,
      });
    }

    modal.addComponents(components);

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error("Failed to show verification modal:", error);
      const modalErrorEmbed = new EmbedBuilder()
        .setColor("Red")
        .setDescription("❌ Could not display the verification form.");
      setDefaultFooter(modalErrorEmbed, interaction.client.user);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            embeds: [modalErrorEmbed],
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            embeds: [modalErrorEmbed],
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
  modulePath: __filename,
};
