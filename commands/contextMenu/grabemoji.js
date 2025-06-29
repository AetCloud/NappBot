const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionContextType,
} = require("discord.js");
const {
  createEmbedWithDefaults,
  createErrorEmbed,
  setDefaultFooter,
} = require("../../utils/embedUtils");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Grab Emojis")
    .setType(ApplicationCommandType.Message)
    .setContexts([
      InteractionContextType.Guild,
      InteractionContextType.BotDM,
      InteractionContextType.PrivateChannel,
    ]),

  async execute(interaction) {
    const targetMessage = interaction.targetMessage;

    await interaction.deferReply({ ephemeral: true });

    const emojiRegex =
      /<(a)?:(\w{2,32}):(\d{17,19})>|(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
    const matches = targetMessage.content.matchAll(emojiRegex);

    const emojis = [];
    for (const match of matches) {
      if (match[3]) {
        const isAnimated = match[1] === "a";
        emojis.push({
          name: match[2],
          url: `https://cdn.discordapp.com/emojis/${match[3]}.${
            isAnimated ? "gif" : "png"
          }?quality=lossless`,
        });
      } else {
        const emoji = match[0];
        const codepoint = [...emoji]
          .map((c) => c.codePointAt(0).toString(16))
          .join("-");
        emojis.push({
          name: emoji,
          url: `https://twemoji.maxcdn.com/v/latest/72x72/${codepoint}.png`,
        });
      }
    }

    if (emojis.length === 0) {
      const errorEmbed = createErrorEmbed(
        "No emojis found in the selected message.",
        interaction.client.user
      );
      return interaction.editReply({ embeds: [errorEmbed] });
    }

    let currentIndex = 0;

    const generateEmbed = (index) => {
      const emoji = emojis[index];
      const embed = new EmbedBuilder()
        .setTitle(`Emoji Viewer (${index + 1}/${emojis.length})`)
        .setDescription(`**Name:** ${emoji.name}`)
        .setColor("#5865F2")
        .setImage(emoji.url)
        .setTimestamp();
      setDefaultFooter(embed, interaction.client.user);
      return embed;
    };

    const generateButtons = (index) => {
      const emoji = emojis[index];
      const isSingleEmoji = emojis.length <= 1;
      return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("prev_emoji")
          .setLabel("⬅️ Previous")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isSingleEmoji || index === 0),
        new ButtonBuilder()
          .setCustomId("next_emoji")
          .setLabel("Next ➡️")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(isSingleEmoji || index === emojis.length - 1),
        new ButtonBuilder()
          .setLabel("Download")
          .setStyle(ButtonStyle.Link)
          .setURL(emoji.url)
      );
    };

    const message = await interaction.editReply({
      embeds: [generateEmbed(currentIndex)],
      components: [generateButtons(currentIndex)],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === interaction.user.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "prev_emoji") {
        currentIndex = Math.max(0, currentIndex - 1);
      } else if (i.customId === "next_emoji") {
        currentIndex = Math.min(emojis.length - 1, currentIndex + 1);
      }

      await i.update({
        embeds: [generateEmbed(currentIndex)],
        components: [generateButtons(currentIndex)],
      });
    });

    collector.on("end", async () => {
      try {
        const finalEmbed = generateEmbed(currentIndex);
        const finalButtons = generateButtons(currentIndex);
        finalButtons.components.forEach((button) => button.setDisabled(true));
        const downloadButton = finalButtons.components.find(
          (c) => c.data.style === ButtonStyle.Link
        );
        if (downloadButton) downloadButton.setDisabled(false);

        await interaction.editReply({
          embeds: [finalEmbed],
          components: [finalButtons],
        });
      } catch (error) {
        if (error.code !== 10008) {
          console.error(
            "Failed to update emoji grabber interaction on end:",
            error
          );
        }
      }
    });
  },
};
