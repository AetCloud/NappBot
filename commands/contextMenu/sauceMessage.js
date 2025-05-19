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
  modulePath: __filename,

  async execute(interaction) {
    const commandName = "SauceMessageContext";
    const userId = interaction.user.id;
    const guildId = interaction.guildId;
    const targetMessageId = interaction.targetMessage.id;

    console.log(
      `[${commandName}] User ${userId} in guild ${guildId} triggered on message ${targetMessageId}.`
    );

    if (
      !SAUCENAO_API_KEY ||
      (SAUCENAO_API_KEY === "a286d02f3476139b8f363ebd89cf1cc25e39072d" &&
        process.env.NODE_ENV === "production")
    ) {
      console.error(
        `[${commandName}] API Key issue. Key present: ${!!SAUCENAO_API_KEY}`
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

    const targetMessage = interaction.targetMessage;
    let imageUrlToSearch = null;

    console.log(
      `[${commandName}] Searching for image in message ${targetMessageId}. Attachments: ${targetMessage.attachments.size}, Embeds: ${targetMessage.embeds.length}`
    );

    if (targetMessage.attachments.size > 0) {
      const firstAttachment = targetMessage.attachments.first();
      console.log(
        `[${commandName}] Found attachment: ${firstAttachment.name}, type: ${firstAttachment.contentType}, URL: ${firstAttachment.url}`
      );
      if (
        firstAttachment.contentType &&
        firstAttachment.contentType.startsWith("image/")
      ) {
        imageUrlToSearch = firstAttachment.url;
        console.log(
          `[${commandName}] Using attachment URL: ${imageUrlToSearch}`
        );
      } else {
        console.log(
          `[${commandName}] Attachment ${firstAttachment.name} is not a recognized image type.`
        );
      }
    }

    if (!imageUrlToSearch && targetMessage.embeds.length > 0) {
      console.log(`[${commandName}] No attachment image, checking embeds.`);
      for (const embed of targetMessage.embeds) {
        if (embed.image && embed.image.url) {
          imageUrlToSearch = embed.image.url;
          console.log(
            `[${commandName}] Using embed image URL: ${imageUrlToSearch}`
          );
          break;
        }
        if (embed.thumbnail && embed.thumbnail.url) {
          imageUrlToSearch = embed.thumbnail.url;
          console.log(
            `[${commandName}] Using embed thumbnail URL: ${imageUrlToSearch}`
          );
          break;
        }
      }
    }

    if (!imageUrlToSearch) {
      console.log(
        `[${commandName}] No searchable image found in message ${targetMessageId}.`
      );
      const errorEmbed = createErrorEmbed(
        "No searchable image found in the selected message (check attachments or embeds).",
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
        console.log(`[${commandName}] Deferring reply.`);
        await interaction.deferReply({ ephemeral: false });
        console.log(`[${commandName}] Reply deferred successfully.`);
      } catch (deferError) {
        console.error(
          `[${commandName}] CRITICAL: Failed to defer reply:`,
          deferError
        );
        return;
      }
    }

    try {
      const numResults = 5;
      const hideLevel = 0;
      console.log(
        `[${commandName}] Calling searchSauceNaoByUrl with URL: ${imageUrlToSearch}, numResults: ${numResults}, hideLevel: ${hideLevel}. Key Used: ${
          SAUCENAO_API_KEY ? "Present" : "MISSING!"
        }`
      );

      const sauceNaoData = await searchSauceNaoByUrl(
        SAUCENAO_API_KEY,
        imageUrlToSearch,
        numResults,
        hideLevel
      );
      console.log(
        `[${commandName}] SauceNAO API response received. Status: ${sauceNaoData?.header?.status}, Results count: ${sauceNaoData?.results?.length}`
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
          .setDescription("No results found for the image in the message.")
          .setThumbnail(imageUrlToSearch);
        const footerText = `Searched by ${interaction.user.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(
          noResultsEmbed,
          footerText,
          interaction.client.user.displayAvatarURL()
        );
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

      const header = sauceNaoData.header;
      let limitInfo = `Searches: ${header.short_remaining}/${header.short_limit} (30s) | ${header.long_remaining}/${header.long_limit} (24h)`;
      if (
        parseInt(header.short_remaining) < 5 ||
        parseInt(header.long_remaining) < 20
      ) {
        limitInfo = `⚠️ ${limitInfo}`;
      }
      console.log(`[${commandName}] API Limit Info: ${limitInfo}`);

      const results = sauceNaoData.results.sort(
        (a, b) =>
          parseFloat(b.header.similarity) - parseFloat(a.header.similarity)
      );

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

        const resultFooterText = `Orig. Img: ${imageUrlToSearch.substring(
          0,
          50
        )}... | ${limitInfo} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(
          embed,
          resultFooterText,
          interaction.client.user.displayAvatarURL()
        );
        embedsToShow.push(embed);
      }
      console.log(
        `[${commandName}] Prepared ${embedsToShow.length} embeds for display.`
      );

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
      console.log(
        `[${commandName}] Sending final response with embeds and buttons.`
      );
      await interaction
        .editReply({ embeds: embedsToShow, components: [row] })
        .catch((e) =>
          console.error(`[${commandName}] Failed to editReply with results:`, e)
        );
      console.log(`[${commandName}] Final response sent.`);
    } catch (error) {
      console.error(
        `[${commandName}] CRITICAL ERROR in try block for message ${targetMessageId}:`,
        error
      );
      const errorEmbed = createErrorEmbed(
        `An error occurred while searching: ${
          error.message || "Could not fetch results."
        }`,
        interaction.client.user
      );
      if (interaction.deferred && !interaction.replied) {
        await interaction
          .editReply({ embeds: [errorEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to editReply with critical error:`,
              e
            )
          );
      } else if (!interaction.replied) {
        await interaction
          .reply({ embeds: [errorEmbed], ephemeral: true })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to reply with critical error:`,
              e
            )
          );
      }
      console.log(`[${commandName}] Error reply sent.`);
    }
  },
};
