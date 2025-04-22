const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { fetchWalltakerImage } = require("../../utils/fetchWalltaker");
const { getE621PostId } = require("../../utils/e621API");
const { database } = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("walltaker")
    .setDescription("🖼️ Fetch the latest image from Walltaker.")
    .setNSFW(true)
    .addStringOption((option) =>
      option
        .setName("feed_id")
        .setDescription("Enter a specific Walltaker feed ID (optional)")
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Channel to send the image (optional)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const guildId = interaction.guild.id;
    let feedId = interaction.options.getString("feed_id");
    let targetChannel = interaction.options.getChannel("channel");

    try {
      if (!feedId) {
        const [settings] = await database.execute(
          "SELECT feed_id, channel_id FROM walltaker_settings WHERE guild_id = ? LIMIT 1",
          [guildId]
        );

        if (!settings.length) {
          return interaction.editReply({
            content:
              "❌ No Walltaker feed is set for this server! Use `/setwalltaker` first.",
            ephemeral: true,
          });
        }

        feedId = settings[0].feed_id;
        if (!targetChannel) {
          targetChannel = await interaction.client.channels
            .fetch(settings[0].channel_id)
            .catch(() => null);
        }
      }

      if (!targetChannel) targetChannel = interaction.channel;
      const imageData = await fetchWalltakerImage(feedId);
      if (!imageData) {
        return interaction.editReply({
          content: "❌ No image found for this Walltaker feed.",
          ephemeral: true,
        });
      }

      const { imageUrl, sourceUrl, lastUpdatedBy } = imageData;
      const e621PostId = await getE621PostId(imageUrl);
      const e621PostUrl = e621PostId
        ? `https://e621.net/posts/${e621PostId}`
        : null;

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Walltaker Image for Feed ${feedId}`)
        .setImage(imageUrl)
        .setColor("#3498DB")
        .setFooter({
          text: `Image changed by: ${lastUpdatedBy} | Requested by ${interaction.user.tag}`,
          iconURL: interaction.user.displayAvatarURL(),
        });

      const buttons = [
        new ButtonBuilder()
          .setLabel("🔗 View on Walltaker")
          .setStyle(ButtonStyle.Link)
          .setURL(sourceUrl),
      ];

      if (e621PostUrl) {
        buttons.push(
          new ButtonBuilder()
            .setLabel("🔍 View on e621")
            .setStyle(ButtonStyle.Link)
            .setURL(e621PostUrl)
        );
      }

      const row = new ActionRowBuilder().addComponents(...buttons);
      await targetChannel.send({ embeds: [embed], components: [row] });
      return interaction.editReply({
        content: `✅ Image posted in ${targetChannel}.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error("❌ Error executing /walltaker:", error);
      return interaction.editReply({
        content: "❌ An error occurred while fetching the Walltaker image.",
        ephemeral: true,
      });
    }
  },
  modulePath: __filename,
};

