const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const { setDefaultFooter } = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("📩 Get the invite link to add NappBot to your server."),
  async execute(interaction) {
    const inviteLink =
      "https://discord.com/oauth2/authorize?client_id=765387268557897799";

    const embed = new EmbedBuilder()
      .setTitle("Invite NappBot 📩")
      .setDescription(
        "Click the button below to invite **NappBot** to your server!\n\nThank you for your support! 😊"
      )
      .setColor("#5865F2")
      .setThumbnail(interaction.client.user.displayAvatarURL())
      .setTimestamp();

    setDefaultFooter(embed, interaction.client.user);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Invite NappBot")
        .setStyle(ButtonStyle.Link)
        .setURL(inviteLink)
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },
  modulePath: __filename,
};
