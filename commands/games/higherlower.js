const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  markUserActive,
} = require("../../utils/database");

async function playGame(interaction, gameState) {
  const userId = gameState.userId;
  const currentBet = gameState.currentBet;
  const currentNumber = gameState.currentNumber;
  const interactionId = gameState.interactionId;

  let currentBalanceData = await getUserBalance(userId);
  if (!currentBalanceData) {
    const replyMethod = interaction.isMessageComponent()
      ? "followUp"
      : "editReply";
    await interaction[replyMethod]({
      content: "❌ Error fetching your balance. Game aborted.",
      embeds: [],
      components: [],
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  const higherButton = new ButtonBuilder()
    .setCustomId(`hl_higher_${interactionId}`)
    .setLabel("⬆️ Higher")
    .setStyle(ButtonStyle.Primary);

  const lowerButton = new ButtonBuilder()
    .setCustomId(`hl_lower_${interactionId}`)
    .setLabel("⬇️ Lower")
    .setStyle(ButtonStyle.Primary);

  const cashoutButton = new ButtonBuilder()
    .setCustomId(`hl_cashout_${interactionId}`)
    .setLabel(
      `💰 Cash Out (${
        gameState.streak > 0
          ? gameState.initialBet * Math.pow(2, gameState.streak)
          : currentBet
      })`
    )
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(gameState.streak === 0);

  const row = new ActionRowBuilder().addComponents(
    higherButton,
    lowerButton,
    cashoutButton
  );

  const embed = new EmbedBuilder()
    .setTitle("🔢 Higher or Lower")
    .setDescription(
      `Your current number: **${currentNumber}**\n\n` +
        `Guess if the next number (1-100) will be higher or lower.\n` +
        `*Ties (same number) result in a loss.*`
    )
    .setColor("Gold")
    .addFields(
      { name: "💰 Current Bet", value: `🪙 ${currentBet}`, inline: true },
      {
        name: "📊 Current Balance",
        value: `🪙 ${currentBalanceData.balance}`,
        inline: true,
      },
      {
        name: "🔥 Game Streak",
        value: `${gameState.streak} wins`,
        inline: true,
      }
    )
    .setFooter({ text: `Game ID: ${interactionId}` });

  const replyOptions = { embeds: [embed], components: [row], fetchReply: true };
  let message;

  try {
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
  } catch (error) {
    console.error("HL Game: Error sending/editing game prompt:", error);
    if (interaction.replied || interaction.deferred) {
      await interaction
        .editReply({
          content: "❌ Error updating game state.",
          embeds: [],
          components: [],
        })
        .catch(() => {});
    }
    return;
  }

  const filter = (i) =>
    i.user.id === userId &&
    i.message.id === message.id &&
    (i.customId === `hl_higher_${interactionId}` ||
      i.customId === `hl_lower_${interactionId}` ||
      i.customId === `hl_cashout_${interactionId}`);

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 60000,
    max: 1,
  });

  collector.on("collect", async (buttonInteraction) => {
    await buttonInteraction.deferUpdate();

    if (buttonInteraction.customId === `hl_cashout_${interactionId}`) {
      const totalWinnings =
        gameState.streak > 0
          ? gameState.initialBet * Math.pow(2, gameState.streak) -
            gameState.initialBet
          : 0;
      const finalPot =
        gameState.streak > 0
          ? gameState.initialBet * Math.pow(2, gameState.streak)
          : gameState.initialBet;

      await updateUserBalance(userId, totalWinnings);
      await markUserActive(userId);

      const cashoutEmbed = new EmbedBuilder()
        .setTitle("✅ Cashed Out!")
        .setColor("Green")
        .setDescription(
          `You cashed out after a **${gameState.streak}-win streak**!`
        )
        .addFields(
          {
            name: "Initial Bet",
            value: `🪙 ${gameState.initialBet}`,
            inline: true,
          },
          { name: "Final Pot", value: `🪙 ${finalPot}`, inline: true },
          { name: "Profit", value: `🪙 ${totalWinnings}`, inline: true }
        )
        .setTimestamp();

      await buttonInteraction.editReply({
        embeds: [cashoutEmbed],
        components: [],
      });
      return;
    }

    let secondNumber = Math.floor(Math.random() * 100) + 1;

    const choice = buttonInteraction.customId.startsWith(`hl_higher_`)
      ? "higher"
      : "lower";
    let won =
      (choice === "higher" && secondNumber > currentNumber) ||
      (choice === "lower" && secondNumber < currentNumber);

    if (secondNumber === currentNumber) {
      won = false;
    }

    await markUserActive(userId);

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
          value: won
            ? "✅ Correct!"
            : secondNumber === currentNumber
            ? "⚖️ Tie (Loss)!"
            : "❌ Incorrect!",
          inline: true,
        },
        { name: "Current Bet", value: `🪙 ${currentBet}`, inline: true },
        {
          name: "Game Streak",
          value: `${won ? gameState.streak + 1 : 0} wins`,
          inline: true,
        }
      )
      .setTimestamp();

    if (won) {
      gameState.streak += 1;
      gameState.currentNumber = secondNumber;

      const continueButton = new ButtonBuilder()
        .setCustomId(`hl_continue_${interactionId}`)
        .setLabel("Keep Going!")
        .setStyle(ButtonStyle.Success);

      const cashoutNextButton = new ButtonBuilder()
        .setCustomId(`hl_cashout_${interactionId}`)
        .setLabel(
          `💰 Cash Out (${
            gameState.initialBet * Math.pow(2, gameState.streak)
          })`
        )
        .setStyle(ButtonStyle.Secondary);

      const resultRow = new ActionRowBuilder().addComponents(
        continueButton,
        cashoutNextButton
      );

      await buttonInteraction.editReply({
        embeds: [resultEmbed],
        components: [resultRow],
      });

      const continueFilter = (i) =>
        i.user.id === userId &&
        i.message.id === message.id &&
        (i.customId === `hl_continue_${interactionId}` ||
          i.customId === `hl_cashout_${interactionId}`);

      const continueCollector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: continueFilter,
        time: 60000,
        max: 1,
      });

      continueCollector.on("collect", async (contInteraction) => {
        await contInteraction.deferUpdate();
        if (contInteraction.customId === `hl_continue_${interactionId}`) {
          await playGame(contInteraction, gameState);
        } else {
          const totalWinnings =
            gameState.initialBet * Math.pow(2, gameState.streak) -
            gameState.initialBet;
          const finalPot = gameState.initialBet * Math.pow(2, gameState.streak);
          await updateUserBalance(userId, totalWinnings);
          await markUserActive(userId);

          const cashoutEmbed = new EmbedBuilder()
            .setTitle("✅ Cashed Out!")
            .setColor("Green")
            .setDescription(
              `You cashed out after a **${gameState.streak}-win streak**!`
            )
            .addFields(
              {
                name: "Initial Bet",
                value: `🪙 ${gameState.initialBet}`,
                inline: true,
              },
              { name: "Final Pot", value: `🪙 ${finalPot}`, inline: true },
              { name: "Profit", value: `🪙 ${totalWinnings}`, inline: true }
            )
            .setTimestamp();
          await contInteraction.editReply({
            embeds: [cashoutEmbed],
            components: [],
          });
        }
      });

      continueCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
          const totalWinnings =
            gameState.initialBet * Math.pow(2, gameState.streak) -
            gameState.initialBet;
          const finalPot = gameState.initialBet * Math.pow(2, gameState.streak);
          await updateUserBalance(userId, totalWinnings);
          await markUserActive(userId);

          const timeoutEmbed = new EmbedBuilder()
            .setTitle("⏰ Timed Out - Cashed Out!")
            .setColor("Orange")
            .setDescription(
              `Game timed out. You were automatically cashed out after a **${gameState.streak}-win streak**.`
            )
            .addFields(
              {
                name: "Initial Bet",
                value: `🪙 ${gameState.initialBet}`,
                inline: true,
              },
              { name: "Final Pot", value: `🪙 ${finalPot}`, inline: true },
              { name: "Profit", value: `🪙 ${totalWinnings}`, inline: true }
            )
            .setTimestamp();

          try {
            await interaction.editReply({
              embeds: [timeoutEmbed],
              components: [],
            });
          } catch (editError) {
            if (editError.code !== 10008)
              console.error("HL Timeout: Failed to edit message:", editError);
          }
        }
      });
    } else {
      await updateUserBalance(userId, -currentBet);
      await updateStreak(userId, "loss");

      const finalBalanceData = await getUserBalance(userId);
      const finalOverallStreak = await getUserStreak(userId);

      resultEmbed.addFields(
        { name: "📉 Bet Lost", value: `🪙 -${currentBet}`, inline: true },
        {
          name: "📊 New Balance",
          value: `🪙 ${finalBalanceData?.balance ?? "Error"}`,
          inline: true,
        },
        {
          name: "🔥 Overall Streak",
          value:
            finalOverallStreak > 0
              ? `🔥 ${finalOverallStreak}-win`
              : finalOverallStreak < 0
              ? `❄️ ${Math.abs(finalOverallStreak)}-loss`
              : "😐 None",
          inline: true,
        }
      );

      await buttonInteraction.editReply({
        embeds: [resultEmbed],
        components: [],
      });
    }
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "time" && collected.size === 0) {
      try {
        await interaction.editReply({
          content: "⏰ Game timed out. You didn't make a guess.",
          embeds: [],
          components: [],
        });
      } catch (editError) {
        if (editError.code !== 10008)
          console.error(
            "HL Timeout: Failed to edit message on initial timeout:",
            editError
          );
      }
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("higherlower")
    .setDescription("🔢 Play Higher or Lower against the bot!")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("The amount of coins to bet.")
        .setRequired(true)
        .setMinValue(10)
    ),

  modulePath: path.resolve(__filename),

  async execute(interaction) {
    if (interaction.isMessageComponent()) {
      await interaction
        .reply({
          content: "Please start a new game using the `/higherlower` command.",
          ephemeral: true,
        })
        .catch(() => {});
      return;
    }

    await interaction.deferReply();

    const initialBet = interaction.options.getInteger("bet");
    const userId = interaction.user.id;

    const balanceData = await getUserBalance(userId);
    if (
      !balanceData ||
      typeof balanceData.balance === "undefined" ||
      initialBet > balanceData.balance
    ) {
      return interaction.editReply({
        content: `❌ Invalid bet amount or insufficient balance! You need 🪙 ${initialBet} but have 🪙 ${
          balanceData?.balance ?? 0
        }.`,
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
      interactionId: interaction.id,
    };

    await playGame(interaction, gameState);
  },
};
