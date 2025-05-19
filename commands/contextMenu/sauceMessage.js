const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { searchSauceNaoByUrl } = require("../../utils/saucenaoAPI.js");
const {
  createEmbedWithDefaults,
  createErrorEmbed,
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
  COLORS,
} = require("../../utils/embedUtils");

const SAUCENAO_API_KEY = process.env.SAUCENAO_API_KEY;

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Find Sauce (SauceNAO)")
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),

  async execute(interaction) {
    if (
      !SAUCENAO_API_KEY ||
      (SAUCENAO_API_KEY === "a286d02f3476139b8f363ebd89cf1cc25e39072d" &&
        process.env.NODE_ENV === "production")
    ) {
      console.error(
        "SauceNAO API Key is not configured properly for production."
      );
      const errorEmbed = createErrorEmbed(
        "Reverse image search is currently unavailable due to a configuration issue.",
        interaction.client.user
      );
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    const targetMessage = interaction.targetMessage;
    let imageUrlToSearch = null;

    if (targetMessage.attachments.size > 0) {
      const firstAttachment = targetMessage.attachments.first();
      if (
        firstAttachment.contentType &&
        firstAttachment.contentType.startsWith("image/")
      ) {
        imageUrlToSearch = firstAttachment.url;
      }
    }

    if (!imageUrlToSearch && targetMessage.embeds.length > 0) {
      for (const embed of targetMessage.embeds) {
        if (embed.image && embed.image.url) {
          imageUrlToSearch = embed.image.url;
          break;
        }
        if (embed.thumbnail && embed.thumbnail.url) {
          imageUrlToSearch = embed.thumbnail.url;
          break;
        }
      }
    }

    if (!imageUrlToSearch) {
      const errorEmbed = createErrorEmbed(
        "No searchable image found in the selected message (check attachments or embeds).",
        interaction.client.user
      );
      return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const numResults = 5;
      const hideLevel = 0;
      const sauceNaoData = await searchSauceNaoByUrl(
        SAUCENAO_API_KEY,
        imageUrlToSearch,
        numResults,
        hideLevel
      );

      if (
        !sauceNaoData ||
        !sauceNaoData.results ||
        sauceNaoData.results.length === 0
      ) {
        const noResultsEmbed = createEmbedWithDefaults(
          interaction.client.user,
          COLORS.WARNING
        )
          .setTitle("🖼️ SauceNAO Search")
          .setDescription("No results found for the image in the message.")
          .setThumbnail(imageUrlToSearch);
        const footerText = `Searched by ${interaction.user.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(
          noResultsEmbed,
          footerText,
          interaction.client.user.displayAvatarURL()
        );
        return interaction.editReply({ embeds: [noResultsEmbed] });
      }

      const header = sauceNaoData.header;
      let limitInfo = `Searches: ${header.short_remaining}/${header.short_limit} (30s) | ${header.long_remaining}/${header.long_limit} (24h)`;
      if (
        parseInt(header.short_remaining) < 5 ||
        parseInt(header.long_remaining) < 20
      ) {
        limitInfo = `⚠️ ${limitInfo}`;
      }

      const results = sauceNaoData.results.sort(
        (a, b) =>
          parseFloat(b.header.similarity) - parseFloat(a.header.similarity)
      );
      let currentIndex = 0;

      const embedsToShow = [];
      for (let i = 0; i < Math.min(results.length, 3); i++) {
        const result = results[i];
        const embed = createEmbedWithDefaults(interaction.client.user)
          .setTitle(`SauceNAO Result ${i + 1}`)
          .setThumbnail(result.header.thumbnail)
          .setURL(
            result.data.ext_urls && result.data.ext_urls.length > 0
              ? result.data.ext_urls[0]
              : null
          )
          .addFields(
            {
              name: "Similarity",
              value: `${result.header.similarity}%`,
              inline: true,
            },
            {
              name: "Source Index",
              value: `${result.header.index_name} (ID: ${result.header.index_id})`,
              inline: true,
            }
          );

        if (result.data.title)
          embed.addFields({
            name: "Title",
            value: String(result.data.title).substring(0, 1020),
          });
        if (result.data.member_name)
          embed.addFields({
            name: "Artist (Pixiv)",
            value: String(result.data.member_name).substring(0, 1020),
          });
        else if (result.data.creator) {
          const creators = Array.isArray(result.data.creator)
            ? result.data.creator.join(", ")
            : result.data.creator;
          embed.addFields({
            name: "Creator(s)",
            value: String(creators).substring(0, 1020),
          });
        }

        if (result.data.ext_urls && result.data.ext_urls.length > 0) {
          const urlsText = result.data.ext_urls
            .map((url) => `[View Link](${url})`)
            .slice(0, 3)
            .join("\n")
            .substring(0, 1020);
          embed.addFields({ name: "External Links", value: urlsText });
        }

        if (
          parseFloat(result.header.similarity) <
          (parseFloat(header.minimum_similarity) || 60)
        ) {
          embed.setColor(COLORS.WARNING);
        }
        if (result.header.hidden && parseInt(result.header.hidden) > 0) {
          embed.setColor(COLORS.ERROR);
        }

        const footerText = `Orig. Img: ${imageUrlToSearch.substring(
          0,
          50
        )}... | ${limitInfo} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(
          embed,
          footerText,
          interaction.client.user.displayAvatarURL()
        );
        embedsToShow.push(embed);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel("View Original Message")
          .setStyle(ButtonStyle.Link)
          .setURL(targetMessage.url)
      );
      if (results[0].data.ext_urls && results[0].data.ext_urls.length > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("Top Source Link")
            .setStyle(ButtonStyle.Link)
            .setURL(results[0].data.ext_urls[0])
        );
      }

      await interaction.editReply({ embeds: embedsToShow, components: [row] });
    } catch (error) {
      console.error("SauceNAO context menu command error:", error);
      const errorEmbed = createErrorEmbed(
        `An error occurred: ${error.message || "Could not fetch results."}`,
        interaction.client.user
      );
      await interaction.editReply({ embeds: [errorEmbed], components: [] });
    }
  },
  modulePath: __filename,
};
