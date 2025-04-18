const path = require("path");
const {} = require("discord.js");
const {} = require("../../utils/database");

async function playGame(interaction, gameState) {
  const userId = gameState.userId;
  const currentBet = gameState.currentBet;
  const currentNumber = gameState.currentNumber;

  let currentBalanceData = await getUserBalance(userId);
  if (!currentBalanceData) {
    await interaction.followUp({
      content: "❌ Error fetching your balance.",
      ephemeral: true,
    });
    return;
  }

  const higherButton = new ButtonBuilder()
    .setCustomId(`hl_higher_${interaction.id}`)
    .setLabel("⬆️ Higher")
    .setStyle(ButtonStyle.Primary);

  const lowerButton = new ButtonBuilder()
    .setCustomId(`hl_lower_${interaction.id}`)
    .setLabel("⬇️ Lower")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(higherButton, lowerButton);

  const embed = new EmbedBuilder()
    .setTitle("🔢 Higher or Lower")
    .setDescription(
      `Your current number: **${currentNumber}**\n\nGuess if the next number is higher or lower.`
    )
    .setColor("Gold")
    .addFields(
      { name: "💰 Current Bet", value: `🪙 ${currentBet}`, inline: true },
      {
        name: "📊 Current Balance",
        value: `🪙 ${currentBalanceData.balance}`,
        inline: true,
      }
    )
    .setFooter({ text: `Streak: ${gameState.streak}` });

  const replyOptions = { embeds: [embed], components: [row], fetchReply: true };
  let message;
  if (interaction.isMessageComponent()) {
    message = await interaction.editReply(replyOptions);
  } else if (
    interaction.isChatInputCommand() &&
    (interaction.replied || interaction.deferred)
  ) {
    message = await interaction.editReply(replyOptions);
  } else {
    message = await interaction.reply(replyOptions);
  }
  gameState.message = message;

  const filter = (i) =>
    i.user.id === userId &&
    i.message.id === message.id &&
    (i.customId.startsWith("hl_higher_") || i.customId.startsWith("hl_lower_"));
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 30000,
    max: 1,
  });

  collector.on("collect", async (buttonInteraction) => {
    await buttonInteraction.deferUpdate();

    let secondNumber = Math.floor(Math.random() * 100) + 1;
    while (secondNumber === currentNumber) {
      secondNumber = Math.floor(Math.random() * 100) + 1;
    }

    const choice = buttonInteraction.customId.startsWith("hl_higher_")
      ? "higher"
      : "lower";
    let won =
      (choice === "higher" && secondNumber > currentNumber) ||
      (choice === "lower" && secondNumber < currentNumber);

    const earnings = won ? currentBet : -currentBet;

    await updateUserBalance(userId, earnings, 0);
    await updateStreak(userId, won ? "win" : "loss");
    await markUserActive(userId);

    gameState.streak = won ? gameState.streak + 1 : 0;
    const newBalanceData = await getUserBalance(userId);
    const newOverallStreak = await getUserStreak(userId);

    const dealerComments = [];
    const resultEmbed = new EmbedBuilder()
      .setTitle("🔢 Higher or Lower - Result")
      .setColor(won ? "Green" : "Red")
      .addFields(
        {
          name: "Your Guess",
          value: `\`${choice.toUpperCase()}\``,
          inline: true,
        },
        {
          name: "Previous Number",
          value: `\`${currentNumber}\``,
          inline: true,
        },
        { name: "New Number", value: `\`${secondNumber}\``, inline: true },
        {
          name: "Outcome",
          value: won ? "✅ Correct!" : "❌ Incorrect!",
          inline: true,
        },
        {
          name: "Payout",
          value: `${earnings >= 0 ? "+" : ""}${earnings} coins`,
          inline: true,
        },
        {
          name: "Game Streak",
          value: `${gameState.streak} wins`,
          inline: true,
        },
        {
          name: "📊 New Balance",
          value: `🪙 ${newBalanceData?.balance ?? "Error"}`,
          inline: false,
        },
        {
          name: "🔥 Overall Streak",
          value:
            newOverallStreak > 0
              ? `🔥 ${newOverallStreak}-win`
              : newOverallStreak < 0
              ? `❄️ ${Math.abs(newOverallStreak)}-loss`
              : "😐 None",
          inline: false,
        }
      )
      .setFooter({
        text: dealerComments[Math.floor(Math.random() * dealerComments.length)],
      });

    if (won) {
      const canAffordDouble =
        newBalanceData && newBalanceData.balance >= currentBet * 2;
      const resultRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hl_cont_${interaction.id}`)
          .setLabel("Continue (Same Bet)")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`hl_double_${interaction.id}`)
          .setLabel("Double or Nothing")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(!canAffordDouble),
        new ButtonBuilder()
          .setCustomId(`hl_cashout_${interaction.id}`)
          .setLabel("Cash Out")
          .setStyle(ButtonStyle.Secondary)
      );

      await buttonInteraction.editReply({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      const resultFilter = (i) =>
        i.user.id === userId &&
        i.message.id === message.id &&
        i.customId.startsWith("hl_");
      const resultCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: resultFilter,
        time: 30000,
        max: 1,
      });

      resultCollector.on("collect", async (resultInteraction) => {
        await resultInteraction.deferUpdate();
        if (resultInteraction.customId.startsWith("hl_cont_")) {
          gameState.currentNumber = secondNumber;
          await playGame(resultInteraction, gameState);
        } else if (resultInteraction.customId.startsWith("hl_double_")) {
          gameState.currentNumber = secondNumber;
          gameState.currentBet *= 2;
          await playGame(resultInteraction, gameState);
        } else if (resultInteraction.customId.startsWith("hl_cashout_")) {
          await resultInteraction.editReply({
            content: `✅ Cashed out! You won a total of... (logic needed to track total winnings this session)`,
            embeds: [],
            components: [],
          });
        }
      });
      resultCollector.on("end", async (c, r) => {
        if (r !== "limit") {
        }
      });
    } else {
      const playAgainRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hl_restart_${interaction.id}`)
          .setLabel("Play Again (New Game)")
          .setStyle(ButtonStyle.Primary)
      );
      await buttonInteraction.editReply({
        embeds: [resultEmbed],
        components: [playAgainRow],
      });

      const restartFilter = (i) =>
        i.user.id === userId &&
        i.message.id === message.id &&
        i.customId.startsWith("hl_restart_");
      const restartCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: restartFilter,
        time: 30000,
        max: 1,
      });
      restartCollector.on("collect", async (restartInteraction) => {
        await restartInteraction.update({
          content:
            "Starting a new game... Please use the `/higherlower` command again with your desired bet.",
          embeds: [],
          components: [],
        });
      });
      restartCollector.on("end", async (c, r) => {
        if (r !== "limit") {
        }
      });
    }
  });

  collector.on("end", async (c, r) => {
    if (r !== "limit" && r !== "user") {
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder(),
  modulePath: path.resolve(__filename),
  async execute(interaction) {
    if (interaction.isMessageComponent()) {
      await interaction.reply({
        content: "Please start a new game using the `/higherlower` command.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();
    const initialBet = interaction.options.getInteger("bet");
    const userId = interaction.user.id;

    const balance = await getUserBalance(userId);
    if (!balance || initialBet > balance.balance) {
      return interaction.editReply({
        content: "❌ Invalid bet amount or insufficient balance!",
        ephemeral: true,
      });
    }

    const gameState = {
      userId: userId,
      initialBet: initialBet,
      currentBet: initialBet,
      currentNumber: Math.floor(Math.random() * 100) + 1,
      streak: 0,
      message: null,
    };

    await playGame(interaction, gameState);
  },
};
