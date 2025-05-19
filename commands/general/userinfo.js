const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("📌 Get information about a user.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("The user you want to get info about.")
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser("target") || interaction.user;
    const member = await interaction.guild.members.fetch(user.id);

    const embed = new EmbedBuilder()
      .setTitle(`${user.username}'s Information`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor("#5865F2")
      .addFields(
        { name: "👤 Username", value: user.tag, inline: true },
        { name: "🆔 User ID", value: user.id, inline: true },
        {
          name: "📆 Account Created",
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`,
          inline: false,
        },
        {
          name: "📥 Joined Server",
          value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>`,
          inline: false,
        }
      )
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
