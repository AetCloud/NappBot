const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { searchSauceNaoByUrl } = require("../../utils/saucenaoAPI.js");
const { getE621PostId } = require("../../utils/e621API.js");
const {
  createEmbedWithDefaults,
  createErrorEmbed,
  setDefaultFooter,
  COLORS,
} = require("../../utils/embedUtils");

const SAUCENAO_API_KEY = process.env.SAUCENAO_API_KEY;

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Find Sauce (SauceNAO)")
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
  modulePath: __filename,

  async execute(interaction) {
    const commandName = "SauceMessageContext";
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const targetMessage = interaction.targetMessage;
    const targetMessageId = targetMessage.id;

    console.log(
      `[${commandName}] User ${userId} in guild ${guildId} triggered on message ${targetMessageId}.`
    );

    if (!SAUCENAO_API_KEY) {
      console.error(
        `[${commandName}] API Key issue: SauceNAO API Key is MISSING from environment variables.`
      );
      const errorEmbed = createErrorEmbed(
        "Reverse image search is currently unavailable due to a configuration issue.",
        interaction.client.user
      );
      if (!interaction.replied && !interaction.deferred) {
        return interaction
          .reply({ embeds: [errorEmbed], ephemeral: true })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to send API key error reply:`,
              e
            )
          );
      } else if (interaction.deferred) {
        return interaction
          .editReply({ embeds: [errorEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to send API key error editReply:`,
              e
            )
          );
      }
      return;
    }
    console.log(`[${commandName}] API Key check passed.`);

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
      console.log(
        `[${commandName}] No searchable image found in message ${targetMessageId}.`
      );
      const errorEmbed = createErrorEmbed(
        "No searchable image found in the selected message.",
        interaction.client.user
      );
      if (!interaction.replied && !interaction.deferred) {
        return interaction
          .reply({ embeds: [errorEmbed], ephemeral: true })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to send no image error reply:`,
              e
            )
          );
      } else if (interaction.deferred) {
        return interaction
          .editReply({ embeds: [errorEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to send no image error editReply:`,
              e
            )
          );
      }
      return;
    }
    console.log(`[${commandName}] Image URL to search: ${imageUrlToSearch}`);

    if (!interaction.replied && !interaction.deferred) {
      try {
        console.log(`[${commandName}] Deferring public reply.`);
        await interaction.deferReply({ ephemeral: false });
        console.log(`[${commandName}] Public reply deferred successfully.`);
      } catch (deferError) {
        console.error(
          `[${commandName}] CRITICAL: Failed to defer public reply:`,
          deferError
        );
        return;
      }
    }

    try {
      const numResults = 3;
      const hideLevel = 0;

      console.log(
        `[${commandName}] Calling searchSauceNaoByUrl. Key Used: Present`
      );
      const sauceNaoData = await searchSauceNaoByUrl(
        SAUCENAO_API_KEY,
        imageUrlToSearch,
        numResults,
        hideLevel
      );
      console.log(
        `[${commandName}] SauceNAO API response. Status: ${sauceNaoData?.header?.status}, Results: ${sauceNaoData?.results?.length}`
      );

      if (
        !sauceNaoData ||
        !sauceNaoData.results ||
        sauceNaoData.results.length === 0
      ) {
        console.log(
          `[${commandName}] No results from SauceNAO for ${imageUrlToSearch}.`
        );
        const noResultsEmbed = createEmbedWithDefaults(
          interaction.client.user,
          COLORS.WARNING
        )
          .setTitle("🖼️ SauceNAO Search")
          .setDescription(
            `No results found for the image in [this message](${targetMessage.url}).`
          )
          .setThumbnail(imageUrlToSearch);
        setDefaultFooter(noResultsEmbed, interaction.client.user);
        return interaction
          .editReply({ embeds: [noResultsEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to editReply with no results:`,
              e
            )
          );
      }
      console.log(
        `[${commandName}] Processing ${sauceNaoData.results.length} results.`
      );

      const topResult = sauceNaoData.results.sort(
        (a, b) =>
          parseFloat(b.header.similarity) - parseFloat(a.header.similarity)
      )[0];

      const mainEmbed = createEmbedWithDefaults(interaction.client.user)
        .setTitle("SauceNAO Result")
        .setURL(
          topResult.data.ext_urls && topResult.data.ext_urls.length > 0
            ? topResult.data.ext_urls[0]
            : null
        )
        .setImage(imageUrlToSearch);

      let descriptionContent = "";
      descriptionContent += `**Similarity:** ${topResult.header.similarity}%\n`;

      if (topResult.data.member_name) {
        descriptionContent += `**Artist:** ${String(
          topResult.data.member_name
        )}\n`;
      } else if (topResult.data.creator) {
        const creators = Array.isArray(topResult.data.creator)
          ? topResult.data.creator.join(", ")
          : topResult.data.creator;
        descriptionContent += `**Creator(s):** ${String(creators)}\n`;
      }

      if (topResult.data.characters) {
        descriptionContent += `**Characters:** ${String(
          topResult.data.characters
        )}\n`;
      }
      if (topResult.data.material) {
        descriptionContent += `**Material/Source:** ${String(
          topResult.data.material
        )}\n`;
      }

      if (
        parseFloat(topResult.header.similarity) <
        (parseFloat(sauceNaoData.header.minimum_similarity) || 60)
      ) {
        mainEmbed.setColor(COLORS.WARNING);
        descriptionContent = `⚠️ **Low Similarity** (This might not be accurate)\n${descriptionContent}`;
      }
      if (
        topResult.header.hidden &&
        parseInt(topResult.header.hidden) > 0 &&
        hideLevel < 1
      ) {
        mainEmbed.setColor(COLORS.ERROR);
        descriptionContent = `🚫 **Content Potentially Hidden by Site Rules** (Level ${topResult.header.hidden})\n${descriptionContent}`;
      }

      mainEmbed.setDescription(descriptionContent.trim());
      setDefaultFooter(mainEmbed, interaction.client.user);

      const actionRow = new ActionRowBuilder();
      if (topResult.data.ext_urls && topResult.data.ext_urls.length > 0) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setLabel("Source Link")
            .setStyle(ButtonStyle.Link)
            .setURL(topResult.data.ext_urls[0])
        );
      }

      const e621PostId = await getE621PostId(imageUrlToSearch);
      if (e621PostId) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setLabel("View on e621")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://e621.net/posts/${e621PostId}`)
        );
        console.log(`[${commandName}] Found e621 link: posts/${e621PostId}`);
      }

      actionRow.addComponents(
        new ButtonBuilder()
          .setLabel("Original Message")
          .setStyle(ButtonStyle.Link)
          .setURL(targetMessage.url)
      );

      console.log(`[${commandName}] Sending final public response.`);
      await interaction
        .editReply({
          content: `Source found for the image in the [original message](${targetMessage.url}) requested by ${interaction.user}:`,
          embeds: [mainEmbed],
          components: actionRow.components.length > 0 ? [actionRow] : [],
        })
        .catch((e) =>
          console.error(`[${commandName}] Failed to editReply with results:`, e)
        );
      console.log(`[${commandName}] Final public response sent.`);
    } catch (error) {
      console.error(
        `[${commandName}] CRITICAL ERROR for message ${targetMessageId}:`,
        error
      );
      const errorEmbed = createErrorEmbed(
        `An error occurred: ${error.message || "Could not fetch results."}`,
        interaction.client.user
      );
      if (interaction.deferred && !interaction.replied) {
        await interaction
          .editReply({
            content: `Sorry ${interaction.user}, an error occurred.`,
            embeds: [errorEmbed],
            components: [],
          })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to editReply with critical error:`,
              e
            )
          );
      }
      console.log(`[${commandName}] Public error reply sent.`);
    }
  },
};
