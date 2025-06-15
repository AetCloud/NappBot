const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { searchSauceNaoByUrl } = require("../../utils/saucenaoAPI.js");
const {
  createEmbedWithDefaults,
  createErrorEmbed,
  setDefaultFooter,
  COLORS,
} = require("../../utils/embedUtils");

const SAUCENAO_API_KEY = process.env.SAUCENAO_API_KEY;

async function executeSauceFinder(interaction, isEphemeral) {
  const commandName = `SauceMessageContext-${isEphemeral ? "Eph" : "Pub"}`;
  const targetMessage = interaction.targetMessage;

  await interaction.deferReply({ ephemeral: isEphemeral });

  if (!SAUCENAO_API_KEY) {
    const errorEmbed = createErrorEmbed(
      "Reverse image search is currently unavailable.",
      interaction.client.user
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  let imageUrlToSearch = null;
  if (targetMessage.attachments.size > 0) {
    const firstAttachment = targetMessage.attachments.first();
    if (firstAttachment.contentType?.startsWith("image/")) {
      imageUrlToSearch = firstAttachment.url;
    }
  }
  if (!imageUrlToSearch && targetMessage.embeds.length > 0) {
    for (const embed of targetMessage.embeds) {
      if (embed.image?.url) {
        imageUrlToSearch = embed.image.url;
        break;
      }
      if (embed.thumbnail?.url) {
        imageUrlToSearch = embed.thumbnail.url;
        break;
      }
    }
  }

  if (!imageUrlToSearch) {
    const errorEmbed = createErrorEmbed(
      "No searchable image found in the selected message.",
      interaction.client.user
    );
    return interaction.editReply({ embeds: [errorEmbed] });
  }

  try {
    const sauceNaoData = await searchSauceNaoByUrl(
      SAUCENAO_API_KEY,
      imageUrlToSearch,
      10,
      0
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
        .setDescription(
          `No results found for the image in [this message](${targetMessage.url}).`
        )
        .setThumbnail(imageUrlToSearch);
      return interaction.editReply({ embeds: [noResultsEmbed] });
    }

    const minimumSimilarity =
      parseFloat(sauceNaoData.header.minimum_similarity) || 50.0;
    const goodResults = sauceNaoData.results
      .filter((r) => parseFloat(r.header.similarity) >= minimumSimilarity)
      .sort(
        (a, b) =>
          parseFloat(b.header.similarity) - parseFloat(a.header.similarity)
      );

    if (goodResults.length === 0) {
      const lowConfidenceEmbed = createEmbedWithDefaults(
        interaction.client.user,
        COLORS.WARNING
      )
        .setTitle("🖼️ SauceNAO Search")
        .setDescription(
          `No high-confidence results found (Similarity < ${minimumSimilarity}%).`
        )
        .setThumbnail(imageUrlToSearch);
      return interaction.editReply({ embeds: [lowConfidenceEmbed] });
    }

    const topResult = goodResults[0];

    const mainEmbed = createEmbedWithDefaults(interaction.client.user)
      .setTitle("SauceNAO Result (Best Match)")
      .setURL(topResult.data.ext_urls?.[0] || null)
      .setImage(imageUrlToSearch);

    let descriptionContent = `**Similarity:** ${topResult.header.similarity}%\n`;
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
    mainEmbed.setDescription(descriptionContent.trim());
    setDefaultFooter(mainEmbed, interaction.client.user);

    const actionRow = new ActionRowBuilder();
    const sourceLinks = new Map();

    for (const result of goodResults) {
      if (result.data.ext_urls && result.data.ext_urls.length > 0) {
        const url = result.data.ext_urls[0];
        let label = null;

        if (result.header.index_name.includes("e621")) label = "e621";
        else if (result.header.index_name.includes("Pixiv")) label = "Pixiv";
        else if (result.header.index_name.includes("Danbooru"))
          label = "Danbooru";
        else if (result.header.index_name.includes("Twitter"))
          label = "Twitter";

        if (label && !sourceLinks.has(label)) {
          sourceLinks.set(label, url);
        }
      }
    }

    let buttonsAdded = 0;
    for (const [label, url] of sourceLinks.entries()) {
      if (buttonsAdded >= 4) break;
      actionRow.addComponents(
        new ButtonBuilder()
          .setLabel(`View on ${label}`)
          .setStyle(ButtonStyle.Link)
          .setURL(url)
      );
      buttonsAdded++;
    }

    actionRow.addComponents(
      new ButtonBuilder()
        .setLabel("Original Message")
        .setStyle(ButtonStyle.Link)
        .setURL(targetMessage.url)
    );

    await interaction.editReply({
      content: `Source found for the image in the [original message](${targetMessage.url}) requested by ${interaction.user}:`,
      embeds: [mainEmbed],
      components: actionRow.components.length > 0 ? [actionRow] : [],
    });
  } catch (error) {
    console.error(`[${commandName}] CRITICAL ERROR:`, error);
    const errorEmbed = createErrorEmbed(
      `An error occurred: ${error.message}`,
      interaction.client.user
    );
    await interaction.editReply({
      content: `Sorry ${interaction.user}, an error occurred.`,
      embeds: [errorEmbed],
      components: [],
    });
  }
}

const publicCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Find Sauce (Public)")
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
  async execute(interaction) {
    await executeSauceFinder(interaction, false);
  },
};

const ephemeralCommand = {
  data: new ContextMenuCommandBuilder()
    .setName("Find Sauce (Ephemeral)")
    .setType(ApplicationCommandType.Message)
    .setDMPermission(false),
  async execute(interaction) {
    await executeSauceFinder(interaction, true);
  },
};

module.exports = [publicCommand, ephemeralCommand];
