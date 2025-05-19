const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("🤗 Give someone a hug!")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to hug")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("custom_gif")
        .setDescription("Provide a custom hug GIF URL (optional)")
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

    const hugGifs = [
      "https://static1.e926.net/data/93/4d/934dd18261556c1fddcd41feacc3b9a8.gif",
      "https://static1.e926.net/data/58/1f/581f2a6acd677c631e1a52b8b5c11be0.gif",
      "https://static1.e926.net/data/ca/28/ca289ba459d138a511f216a31bfa01a2.gif",
      "https://static1.e926.net/data/73/47/73473d58b563719f729ab898436715f8.jpg",
      "https://static1.e926.net/data/92/6a/926aa2a696d91ca9c78510646df0ff1c.jpg",
      "https://static1.e926.net/data/35/09/3509727802c7391c9f1c5ff3be8dd99f.jpg",
      "https://d.furaffinity.net/art/pocketpaws/1607620005/1607620002.pocketpaws_6_drakethekobold.gif",
      "https://static1.e621.net/data/3e/85/3e85296961cbb123ae8992f6b8e104b4.jpg",
    ];

    const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

    let embedDescription;
    let gifToUse;

    if (customGif) {
      embedDescription = `${sender} sends a special hug to ${recipient}! 💞`;
      gifToUse = customGif;
    } else {
      const hugMessages = [
        `${sender} wraps ${recipient} in a big warm hug! 🤗`,
        `Aww, ${sender} gives ${recipient} a loving hug! 💖`,
        `${sender} tightly hugs ${recipient}! So wholesome! 🥰`,
        `Hug alert! 🚨 ${sender} just sent ${recipient} a hug! 🫂`,
        `Nothing beats a good hug! ${sender} embraces ${recipient}! 💞`,
      ];
      embedDescription =
        hugMessages[Math.floor(Math.random() * hugMessages.length)];
      gifToUse = randomGif;
    }

    const embed = new EmbedBuilder()
      .setTitle("🤗 Hug Alert!")
      .setDescription(embedDescription)
      .setImage(gifToUse)
      .setColor("#FFC0CB")
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
