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

    if (!config || !config.enabled) {
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
      return interaction.reply({
        content:
          "❌ This server has verification enabled, but no questions have been configured by the administrators.",
        ephemeral: true,
      });
    }

    modal.addComponents(components);

    try {
      await interaction.showModal(modal);
    } catch (error) {
      console.error("Failed to show verification modal:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "❌ Could not display the verification form.",
            ephemeral: true,
          })
          .catch(() => {});
      } else {
        await interaction
          .followUp({
            content: "❌ Could not display the verification form.",
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
  modulePath: __filename,
};
