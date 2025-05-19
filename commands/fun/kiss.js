const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("💋 Give someone a kiss!")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to kiss")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("custom_gif")
        .setDescription("Provide a custom kiss GIF URL (optional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const sender = interaction.user;
    const recipient = interaction.options.getUser("user");
    const customGif = interaction.options.getString("custom_gif");

    if (!recipient) {
      return interaction.reply({
        content: "❌ You must mention a user!",
        ephemeral: true,
      });
    }

    const kissGifs = [
      "https://static1.e621.net/data/7d/09/7d094af501ac64ca96105811f613eb2e.gif",
      "https://static1.e621.net/data/6b/5b/6b5b2994c7a98be239f42d2fe199495a.png",
      "https://static1.e621.net/data/1e/a8/1ea85e4c1fa189691345656d32fc380c.jpg",
      "https://static1.e621.net/data/e7/0b/e70b5c9af84ce154e7c7b91900815a63.gif",
      "https://static1.e621.net/data/9a/b6/9ab6c91af0a46a2cbb4486147d608d4d.jpg",
      "https://static1.e621.net/data/e1/aa/e1aa139df3d2bd06fde0d0d1e2ca0236.png",
      "https://static1.e621.net/data/0f/32/0f3277a9b5648b5798ffb5edbe915be8.jpg",
      "https://static1.e621.net/data/35/09/3509727802c7391c9f1c5ff3be8dd99f.jpg",
      "https://static1.e621.net/data/ab/d2/abd20dbaf47352b8407a666213abb246.jpg",
      "https://static1.e621.net/data/7f/91/7f915c94aa1cbf9296b7ca5ee86432c4.png",
      "https://static1.e621.net/data/1b/59/1b5964d9689b9a114eed16fa657d4176.jpg",
      "https://static1.e621.net/data/d6/9e/d69e21e6e0dcbfd436295855037cdf39.jpg",
      "https://static1.e621.net/data/26/c8/26c82e8e25ad4b4c3ba7a98248206696.jpg",
      "https://static1.e621.net/data/e0/f4/e0f4707f5c21fc15bde541e1ef83a40f.png",
      "https://static1.e621.net/data/14/45/1445b98605534ec756ad3b4063926ec0.jpg",
      "https://static1.e621.net/data/97/d8/97d87726964dfb3c14aec58b7c2450a6.gif",
      "https://static1.e621.net/data/16/4a/164ab3550d9bcf0a8e693963a7b64c0c.gif",
    ];

    const kissMessages = [
      `${sender} gives ${recipient} a sweet and loving kiss! 💞`,
      `😘 ${sender} kisses ${recipient} with love!`,
      `${sender} plants a gentle kiss on ${recipient}! So cute! 🥰`,
      `Smooch! ${sender} gives ${recipient} a passionate kiss! 😍`,
      `${sender} can't resist and kisses ${recipient} on the cheek! 💕`,
    ];

    const randomGif = kissGifs[Math.floor(Math.random() * kissGifs.length)];
    const randomMessage =
      kissMessages[Math.floor(Math.random() * kissMessages.length)];

    const embed = new EmbedBuilder()
      .setTitle("💋 Kiss Alert!")
      .setDescription(
        customGif
          ? `${sender} sends a special kiss to ${recipient}! 💖`
          : randomMessage
      )
      .setImage(customGif || randomGif)
      .setColor("#FF69B4")
      .setTimestamp();

    const footerText = `Requested by ${sender.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
    setCustomFooter(
      embed,
      footerText,
      interaction.client.user.displayAvatarURL()
    );

    await interaction.reply({ embeds: [embed] });
  },
  modulePath: __filename,
};
