const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const {
  searchSauceNaoByUrl,
  searchSauceNaoByFile,
} = require("../../utils/saucenaoAPI.js");
const {
  createEmbedWithDefaults,
  createErrorEmbed,
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
  COLORS,
} = require("../../utils/embedUtils");
const fetch = require("node-fetch");

const SAUCENAO_API_KEY = process.env.SAUCENAO_API_KEY;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("saucenao")
    .setDescription("🖼️ Reverse image search using SauceNAO.")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("image_url")
        .setDescription("The URL of the image to search.")
        .setRequired(false)
    )
    .addAttachmentOption((option) =>
      option
        .setName("image_upload")
        .setDescription("Upload an image to search.")
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("results")
        .setDescription("Number of results to display (1-10, default 5).")
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName("hide_level")
        .setDescription(
          "Content hiding level (0=All, 1=Exp, 2=Exp+Susp, 3=All but Safe). Default 0."
        )
        .addChoices(
          { name: "Show All (0)", value: 0 },
          { name: "Hide Explicit (1)", value: 1 },
          { name: "Hide Explicit & Suspected (2)", value: 2 },
          { name: "Hide All except Safe (3)", value: 3 }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    const commandName = "SauceNaoSlash";
    if (!SAUCENAO_API_KEY) {
      console.error(
        `[${commandName}] SauceNAO API Key is not configured in environment variables.`
      );
      const errorEmbed = createErrorEmbed(
        "Reverse image search is currently unavailable due to a configuration issue. Please contact the bot owner.",
        interaction.client.user
      );
      if (interaction.replied || interaction.deferred) {
        return interaction
          .editReply({ embeds: [errorEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to editReply for API key error:`,
              e
            )
          );
      } else {
        return interaction
          .reply({ embeds: [errorEmbed], ephemeral: true })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to reply for API key error:`,
              e
            )
          );
      }
    }

    const imageUrl = interaction.options.getString("image_url");
    const imageUpload = interaction.options.getAttachment("image_upload");
    const numResults = interaction.options.getInteger("results") || 5;
    const hideLevel = interaction.options.getInteger("hide_level") || 0;

    if (!imageUrl && !imageUpload) {
      const errorEmbed = createErrorEmbed(
        "You must provide either an image URL or an image upload.",
        interaction.client.user
      );
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errorEmbed], components: [] });
      } else {
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
    if (imageUrl && imageUpload) {
      const errorEmbed = createErrorEmbed(
        "Please provide either an image URL or an image upload, not both.",
        interaction.client.user
      );
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errorEmbed], components: [] });
      } else {
        return interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferReply();
    }

    try {
      let sauceNaoData;
      let sourceImageUrl = imageUrl;
      console.log(
        `[${commandName}] User ${interaction.user.id} initiated search. URL: ${
          imageUrl || "N/A"
        }, Upload: ${imageUpload ? imageUpload.name : "N/A"}`
      );

      if (imageUpload) {
        sourceImageUrl = imageUpload.url;
        console.log(`[${commandName}] Processing upload: ${imageUpload.name}`);
        const imageResponse = await fetch(imageUpload.url);
        if (!imageResponse.ok) {
          console.error(
            `[${commandName}] Failed to fetch uploaded image ${imageUpload.url}: ${imageResponse.statusText}`
          );
          throw new Error(
            `Failed to fetch uploaded image: ${imageResponse.statusText}`
          );
        }
        const imageBuffer = await imageResponse.buffer();
        console.log(
          `[${commandName}] Image buffer created for ${imageUpload.name}. Calling API by file.`
        );
        sauceNaoData = await searchSauceNaoByFile(
          SAUCENAO_API_KEY,
          imageBuffer,
          imageUpload.name,
          numResults,
          hideLevel
        );
      } else {
        console.log(`[${commandName}] Calling API by URL: ${imageUrl}`);
        sauceNaoData = await searchSauceNaoByUrl(
          SAUCENAO_API_KEY,
          imageUrl,
          numResults,
          hideLevel
        );
      }
      console.log(
        `[${commandName}] API Response: Status ${sauceNaoData?.header?.status}, Results: ${sauceNaoData?.results?.length}`
      );

      if (
        !sauceNaoData ||
        !sauceNaoData.results ||
        sauceNaoData.results.length === 0
      ) {
        console.log(
          `[${commandName}] No results found for ${
            sourceImageUrl || "uploaded image"
          }.`
        );
        const noResultsEmbed = createEmbedWithDefaults(
          interaction.client.user,
          COLORS.WARNING
        )
          .setTitle("🖼️ SauceNAO Search")
          .setDescription("No results found for the provided image.")
          .setThumbnail(sourceImageUrl || null);
        return interaction.editReply({
          embeds: [noResultsEmbed],
          components: [],
        });
      }

      const header = sauceNaoData.header;
      let limitInfo = `Searches: ${header.short_remaining}/${header.short_limit} (30s) | ${header.long_remaining}/${header.long_limit} (24h)`;
      if (
        parseInt(header.short_remaining) < 5 ||
        parseInt(header.long_remaining) < 20
      ) {
        limitInfo = `⚠️ ${limitInfo} (Limits low!)`;
      }
      console.log(`[${commandName}] API Limits: ${limitInfo}`);

      const results = sauceNaoData.results.sort(
        (a, b) =>
          parseFloat(b.header.similarity) - parseFloat(a.header.similarity)
      );
      let currentIndex = 0;

      const generateResultEmbed = (result) => {
        const embed = createEmbedWithDefaults(interaction.client.user)
          .setTitle(`SauceNAO Result ${currentIndex + 1}/${results.length}`)
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

        if (result.data.title) {
          embed.addFields({
            name: "Title",
            value: String(result.data.title).substring(0, 1020),
          });
        }
        if (result.data.member_name) {
          embed.addFields({
            name: "Artist (Pixiv)",
            value: String(result.data.member_name).substring(0, 1020),
          });
        } else if (result.data.creator) {
          const creators = Array.isArray(result.data.creator)
            ? result.data.creator.join(", ")
            : result.data.creator;
          embed.addFields({
            name: "Creator(s)",
            value: String(creators).substring(0, 1020),
          });
        }
        if (result.data.source) {
          embed.addFields({
            name: "Source Info",
            value: String(result.data.source).substring(0, 1020),
          });
        }
        if (result.data.ext_urls && result.data.ext_urls.length > 0) {
          const urlsText = result.data.ext_urls
            .map((url) => `[View Link](${url})`)
            .join("\n")
            .substring(0, 1020);
          embed.addFields({ name: "External Links", value: urlsText });
        }
        if (
          parseFloat(result.header.similarity) <
          (parseFloat(header.minimum_similarity) || 60)
        ) {
          embed
            .setColor(COLORS.WARNING)
            .setDescription(
              `⚠️ **Low Similarity:** This result might not be accurate.\n${
                embed.data.description || ""
              }`
            );
        }
        if (result.header.hidden && parseInt(result.header.hidden) > 0) {
          embed
            .setColor(COLORS.ERROR)
            .setDescription(
              `🚫 **Content Hidden by Site Rules** (Level ${
                result.header.hidden
              })\n${embed.data.description || ""}`
            );
        }
        const footerText = `Searched by ${interaction.user.tag} | ${limitInfo} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(
          embed,
          footerText,
          interaction.client.user.displayAvatarURL()
        );
        return embed;
      };

      const generateButtons = (index, totalResults) => {
        const row = new ActionRowBuilder();
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`saucenao_prev_${interaction.id}`)
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId(`saucenao_next_${interaction.id}`)
            .setLabel("Next ➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index >= totalResults - 1)
        );
        if (
          results[index].data.ext_urls &&
          results[index].data.ext_urls.length > 0
        ) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel("Main Source")
              .setStyle(ButtonStyle.Link)
              .setURL(results[index].data.ext_urls[0])
          );
        }
        return row;
      };

      console.log(`[${commandName}] Preparing to send results.`);
      const message = await interaction.editReply({
        embeds: [generateResultEmbed(results[currentIndex])],
        components: [generateButtons(currentIndex, results.length)],
      });
      console.log(`[${commandName}] Results sent.`);

      const filter = (i) =>
        i.user.id === interaction.user.id &&
        i.message.id === message.id &&
        (i.customId.startsWith("saucenao_prev_") ||
          i.customId.startsWith("saucenao_next_"));
      const collector = message.createMessageComponentCollector({
        filter,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        console.log(`[${commandName}] Collector received: ${i.customId}`);
        await i.deferUpdate();
        if (i.customId.startsWith("saucenao_next_")) {
          currentIndex = Math.min(currentIndex + 1, results.length - 1);
        } else if (i.customId.startsWith("saucenao_prev_")) {
          currentIndex = Math.max(currentIndex - 1, 0);
        }
        await i.editReply({
          embeds: [generateResultEmbed(results[currentIndex])],
          components: [generateButtons(currentIndex, results.length)],
        });
        collector.resetTimer();
        console.log(
          `[${commandName}] Collector updated to index ${currentIndex}`
        );
      });

      collector.on("end", (collected, reason) => {
        console.log(`[${commandName}] Collector ended. Reason: ${reason}`);
        if (
          reason !== "messageDelete" &&
          reason !== "user" &&
          reason !== "guildDelete"
        ) {
          const finalEmbed = generateResultEmbed(results[currentIndex]);
          const finalButtons = new ActionRowBuilder();
          if (
            results[currentIndex].data.ext_urls &&
            results[currentIndex].data.ext_urls.length > 0
          ) {
            finalButtons.addComponents(
              new ButtonBuilder()
                .setLabel("Main Source")
                .setStyle(ButtonStyle.Link)
                .setURL(results[currentIndex].data.ext_urls[0])
            );
          }
          interaction
            .editReply({
              embeds: [finalEmbed],
              components:
                finalButtons.components.length > 0 ? [finalButtons] : [],
            })
            .catch((err) => {
              if (err.code !== 10008)
                console.error(
                  `[${commandName}] Error editing SauceNAO reply on collector end:`,
                  err
                );
            });
        }
      });
    } catch (error) {
      console.error(
        `[${commandName}] CRITICAL ERROR in main try block for user ${interaction.user.id}:`,
        error
      );
      const errorEmbed = createErrorEmbed(
        `An error occurred: ${error.message || "Could not fetch results."}`,
        interaction.client.user
      );
      if (interaction.deferred || interaction.replied) {
        await interaction
          .editReply({ embeds: [errorEmbed], components: [] })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to editReply with critical error:`,
              e
            )
          );
      } else {
        await interaction
          .reply({ embeds: [errorEmbed], ephemeral: true })
          .catch((e) =>
            console.error(
              `[${commandName}] Failed to reply with critical error:`,
              e
            )
          );
      }
    }
  },
  modulePath: __filename,
};
