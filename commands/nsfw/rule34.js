const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { fetchRule34Images } = require("../../utils/rule34API");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rule34")
    .setDescription("🔞 Search for images on Rule34.xxx")
    .addStringOption((option) =>
      option
        .setName("tags")
        .setDescription("Enter search tags separated by spaces (optional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    const sender = interaction.user;
    const tags = interaction.options.getString("tags")?.split(" ") || [];

    await interaction.deferReply();

    let postDataArray;
    try {
      postDataArray = await fetchRule34Images(tags, 10); //
    } catch (error) {
      console.error("❌ Error fetching Rule34 data:", error); //
      return interaction.editReply("⚠️ Failed to fetch data. Try again later."); //
    }

    if (!postDataArray || postDataArray.length === 0) {
      return interaction.editReply("❌ No results found!"); //
    }

    let currentIndex = 0;

    function createEmbed(postData) {
      return new EmbedBuilder()
        .setTitle("🔞 Rule34 Image Result") //
        .setDescription(`**Tags:** \`${postData.tags.join(", ")}\``) //
        .setColor("#E91E63") //
        .setImage(postData.imageUrl) //
        .setFooter({
          text: `⭐ Score: ${postData.score} | 📌 Post ID: ${postData.postId}\nRequested by ${sender.tag}`, //
          iconURL: sender.displayAvatarURL(), //
        });
    }

    function createRow() {
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("🔗 View on Rule34") //
          .setStyle(ButtonStyle.Link) //
          .setURL(postDataArray[currentIndex].postUrl), //
        new ButtonBuilder()
          .setCustomId(`prev`) //
          .setLabel("⬅️ Previous") //
          .setStyle(ButtonStyle.Primary) //
          .setDisabled(currentIndex === 0), //
        new ButtonBuilder()
          .setCustomId(`next`) //
          .setLabel("➡️ Next") //
          .setStyle(ButtonStyle.Primary) //
          .setDisabled(currentIndex === postDataArray.length - 1) //
      );
    }

    const message = await interaction.editReply({
      embeds: [createEmbed(postDataArray[currentIndex])], //
      components: [createRow()], //
    });

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id, //
      time: 90000, // 1.5 minutes //
    });

    collector.on("collect", async (i) => {
      if (i.customId === "next") {
        //
        currentIndex = Math.min(currentIndex + 1, postDataArray.length - 1); //
      } else if (i.customId === "prev") {
        //
        currentIndex = Math.max(currentIndex - 1, 0); //
      }

      await i.update({
        //
        embeds: [createEmbed(postDataArray[currentIndex])], //
        components: [createRow()], //
      });

      // Reset the collector's inactivity timer
      collector.resetTimer();
    });

    collector.on("end", async () => {
      try {
        await interaction.editReply({ components: [] }); //
      } catch (error) {
        // Ignore error if message was deleted
      }
    });
  },
  modulePath: __filename, //
};
