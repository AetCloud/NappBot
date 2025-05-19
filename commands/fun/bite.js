const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("bite")
    .setDescription("🦷 Bite someone!")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to bite")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("custom_gif")
        .setDescription("Provide a custom bite GIF URL (optional)")
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

    const biteGifs = [
      "https://static1.e621.net/data/ce/39/ce39f5b6fd17e11be6ba17763cb6ce9a.jpg",
      "https://static1.e621.net/data/80/b6/80b63d6d2261e43cbf1dc5b8257b36aa.jpg",
      "https://static1.e621.net/data/4a/e5/4ae5de707c5eb2b894c026a0bcd5cbd8.png",
      "https://static1.e621.net/data/31/37/3137e40e2a2821a65ccd8694d603d2d5.png",
      "https://static1.e621.net/data/b4/9f/b49f4547c44b320c3a49c12cb6f85d31.png",
      "https://static1.e621.net/data/fd/1b/fd1bbbfd6508f2fe4580df4710e52f8c.jpg",
      "https://static1.e621.net/data/fa/17/fa17127b7e089825fb4c576e81cfb2a8.png",
      "https://static1.e621.net/data/65/ff/65ffdee53255213ae73af62a1d0ac652.png",
      "https://static1.e621.net/data/af/d4/afd41986a9e5c699cecaf854081a3f71.png",
      "https://static1.e621.net/data/da/36/da36f95f6924d1ccafa6628ca22d94ed.jpg",
      "https://static1.e621.net/data/10/51/10518efe35c7be5151f568e26fa9fed8.png",
      "https://static1.e621.net/data/ef/1d/ef1dba47149528b216c3da1b89c39f2d.jpg",
      "https://static1.e621.net/data/67/ed/67ed4a71ba43b7e272615a694747cc99.jpg",
      "https://static1.e621.net/data/79/12/7912bfb3f8cc7cb7cfb55b4084bbbdf4.png",
    ];

    const biteMessages = [
      `${sender} bites ${recipient} playfully! 🦷`,
      `😈 ${sender} gives ${recipient} a mischievous bite!`,
    ];

    const randomGif = biteGifs[Math.floor(Math.random() * biteGifs.length)];
    const randomMessage =
      biteMessages[Math.floor(Math.random() * biteMessages.length)];

    const embed = new EmbedBuilder()
      .setTitle("🦷 Bite Alert!")
      .setDescription(
        customGif
          ? `${sender} sends a special bite to ${recipient}! 😈`
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
