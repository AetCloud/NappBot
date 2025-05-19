const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lick")
    .setDescription("👅 Give someone a lick!")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to lick")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("custom_gif")
        .setDescription("Provide a custom lick GIF URL (optional)")
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

    if (recipient.id === sender.id) {
      return interaction.reply({
        content: "❌ You can't lick yourself!",
        ephemeral: true,
      });
    }

    const lickGifs = [
      "https://static1.e621.net/data/c5/a3/c5a3340470ff9e9f73b3ae1c07688cd8.png",
      "https://static1.e621.net/data/e1/2c/e12cf0ba9e5802cd96f19595b383f902.jpg",
      "https://static1.e621.net/data/0b/f2/0bf2fbb2a5ab72cc3113ceeb97ba05dd.png",
      "https://static1.e621.net/data/2c/da/2cda166ceb134f664164dcced739d6f1.gif",
      "https://static1.e621.net/data/f1/ee/f1eea14bc88ca4a30332c9140c64e1a8.gif",
      "https://static1.e621.net/data/2f/6f/2f6f03e6ec4bbd44be64764a81eca17b.jpg",
      "https://static1.e621.net/data/25/05/2505deaea6668e8247a6b3b9b5168c27.gif",
    ];

    const lickMessages = [
      `🤭 ${sender} playfully licks ${recipient}!`,
      `Tastes good? ${sender} gives ${recipient} a big lick! 😆`,
      `${sender} can't resist and licks ${recipient}! 🤭`,
      `Slurp! ${sender} gives ${recipient} a long lick! 👀`,
      `${sender} gives ${recipient} a sweet little lick! 💖`,
    ];

    const randomGif = lickGifs[Math.floor(Math.random() * lickGifs.length)];
    const randomMessage =
      lickMessages[Math.floor(Math.random() * lickMessages.length)];

    const embed = new EmbedBuilder()
      .setTitle("👅 Lick Alert!")
      .setDescription(
        customGif
          ? `${sender} sends a special lick to ${recipient}! 👅`
          : randomMessage
      )
      .setImage(customGif || randomGif)
      .setColor("#FF007F")
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
