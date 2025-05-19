const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("🖼 Fetch a user's avatar.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user whose avatar you want to see.")
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("target") || interaction.user;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Avatar`)
      .setImage(avatarURL)
      .setColor("#5865F2")
      .setTimestamp();

    const footerText = `Requested by ${interaction.user.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
    setCustomFooter(
      embed,
      footerText,
      interaction.client.user.displayAvatarURL()
    );

    await interaction.reply({ embeds: [embed] });
  },
  modulePath: __filename,
};
