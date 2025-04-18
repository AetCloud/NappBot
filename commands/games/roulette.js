const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  InteractionFlags,
} = require("discord.js");
const {
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  markUserActive,
} = require("../../utils/database");

const ROULETTE_WHEEL = [
  { number: 0, color: "green" },
  { number: 32, color: "red" },
  { number: 15, color: "black" },
  { number: 19, color: "red" },
  { number: 4, color: "black" },
  { number: 21, color: "red" },
  { number: 2, color: "black" },
  { number: 25, color: "red" },
  { number: 17, color: "black" },
  { number: 34, color: "red" },
  { number: 6, color: "black" },
  { number: 27, color: "red" },
  { number: 13, color: "black" },
  { number: 36, color: "red" },
  { number: 11, color: "black" },
  { number: 30, color: "red" },
  { number: 8, color: "black" },
  { number: 23, color: "red" },
  { number: 10, color: "black" },
  { number: 5, color: "red" },
  { number: 24, color: "black" },
  { number: 16, color: "red" },
  { number: 33, color: "black" },
  { number: 1, color: "red" },
  { number: 20, color: "black" },
  { number: 14, color: "red" },
  { number: 31, color: "black" },
  { number: 9, color: "red" },
  { number: 22, color: "black" },
  { number: 18, color: "red" },
  { number: 29, color: "black" },
  { number: 7, color: "red" },
  { number: 28, color: "black" },
  { number: 12, color: "red" },
  { number: 35, color: "black" },
  { number: 3, color: "red" },
  { number: 26, color: "black" },
];

const COLOR_EMOJIS = { red: "🔴", black: "⚫", green: "🟢" };

async function playRouletteRound(
  interaction,
  betAmount,
  betType,
  chosenNumber,
  isFollowUp = false
) {
  const userId = interaction.user.id;
  try {
    await markUserActive(userId);

    const balanceData = await getUserBalance(userId);
    if (!balanceData || betAmount > balanceData.balance) {
      const replyOptions = {
        content: `❌ You ${
          isFollowUp ? "no longer " : ""
        }have enough coins for this bet! (Need ${betAmount}, Have ${
          balanceData?.balance ?? 0
        })`,
        ephemeral: true,
      };
      await (isFollowUp ? interaction.followUp : interaction.editReply)(
        replyOptions
      );
      return;
    }

    const result =
      ROULETTE_WHEEL[Math.floor(Math.random() * ROULETTE_WHEEL.length)];
    const { number: winningNumber, color: winningColor } = result;

    let won = false;
    let payoutMultiplier = 0;

    switch (betType) {
      case "number":
        if (chosenNumber === winningNumber) {
          won = true;
          payoutMultiplier = 35;
        }
        break;
      case "red":
      case "black":
        if (winningColor === betType) {
          won = true;
          payoutMultiplier = 1;
        }
        break;
      case "even":
        if (winningNumber !== 0 && winningNumber % 2 === 0) {
          won = true;
          payoutMultiplier = 1;
        }
        break;
      case "odd":
        if (winningNumber % 2 !== 0) {
          won = true;
          payoutMultiplier = 1;
        }
        break;
      case "high":
        if (winningNumber >= 19 && winningNumber <= 36) {
          won = true;
          payoutMultiplier = 1;
        }
        break;
      case "low":
        if (winningNumber >= 1 && winningNumber <= 18) {
          won = true;
          payoutMultiplier = 1;
        }
        break;
    }

    const earnings = won ? betAmount * payoutMultiplier : -betAmount;

    await updateUserBalance(userId, earnings, 0);
    const streakResult = won ? "win" : "loss";
    await updateStreak(userId, streakResult);
    const finalStreak = await getUserStreak(userId);
    const finalBalance = await getUserBalance(userId);

    const betDescription =
      betType === "number"
        ? `Number ${chosenNumber}`
        : betType.charAt(0).toUpperCase() + betType.slice(1);
    const resultEmoji = COLOR_EMOJIS[winningColor] || "❔";

    const embed = new EmbedBuilder()
      .setTitle("🎰 Roulette Results")
      .setDescription(
        `The wheel landed on **${resultEmoji} ${winningNumber} (${winningColor})**!`
      )
      .setColor(won ? "Green" : "Red")
      .addFields(
        { name: "Your Bet", value: `\`${betDescription}\``, inline: true },
        { name: "Bet Amount", value: `🪙 ${betAmount}`, inline: true },
        { name: "\u200B", value: "\u200B", inline: true },
        {
          name: "Result",
          value: won ? "✅ You won!" : "❌ You lost!",
          inline: true,
        },
        {
          name: "Payout",
          value: `${earnings >= 0 ? "+" : ""}${earnings} coins`,
          inline: true,
        },
        {
          name: "Streak",
          value:
            finalStreak > 0
              ? `🔥 ${finalStreak}-win`
              : finalStreak < 0
              ? `❄️ ${Math.abs(finalStreak)}-loss`
              : "😐 None",
          inline: true,
        },
        {
          name: "📊 New Balance",
          value: `🪙 ${finalBalance.balance}`,
          inline: false,
        }
      )
      .setTimestamp();

    const playAgainButton = new ButtonBuilder()
      .setCustomId(`roulette_play_again_${interaction.id}`)
      .setLabel("Spin Again (Same Bet)")
      .setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(playAgainButton);

    const replyOptions = {
      embeds: [embed],
      components: [row],
      fetchReply: true,
    };
    let message;
    if (isFollowUp && interaction.isMessageComponent()) {
      message = await interaction.editReply(replyOptions);
    } else if (
      !isFollowUp &&
      interaction.isChatInputCommand() &&
      (interaction.replied || interaction.deferred)
    ) {
      message = await interaction.editReply(replyOptions);
    } else {
      message = await interaction.reply(replyOptions);
    }

    const filter = (i) =>
      i.user.id === userId &&
      i.customId === `roulette_play_again_${interaction.id}` &&
      i.message.id === message.id;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      await playRouletteRound(i, betAmount, betType, chosenNumber, true);
    });

    collector.on("end", async (collected, reason) => {});
  } catch (error) {
    console.error("Error during playRouletteRound:", error);
    const errorContent = "❌ An error occurred during the Roulette game.";
    try {
      if (isFollowUp && interaction.isMessageComponent())
        await interaction.followUp({ content: errorContent, ephemeral: true });
      else if (
        !isFollowUp &&
        interaction.isChatInputCommand() &&
        (interaction.replied || interaction.deferred)
      )
        await interaction.editReply({
          content: errorContent,
          embeds: [],
          components: [],
        });
      else await interaction.reply({ content: errorContent, ephemeral: true });
    } catch {}
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("🎰 Play a game of roulette!")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("Amount to bet")
        .setRequired(true)
        .setMinValue(10)
    )
    .addStringOption((option) =>
      option
        .setName("bet_type")
        .setDescription("Choose your bet type")
        .setRequired(true)
        .addChoices(
          { name: "🎯 Number (Pays 35:1)", value: "number" },
          { name: "🔴 Red (Pays 1:1)", value: "red" },
          { name: "⚫ Black (Pays 1:1)", value: "black" },
          { name: "🔢 Even (Pays 1:1)", value: "even" },
          { name: "🔢 Odd (Pays 1:1)", value: "odd" },
          { name: "⬆️ High (19-36) (Pays 1:1)", value: "high" },
          { name: "⬇️ Low (1-18) (Pays 1:1)", value: "low" }
        )
    )
    .addIntegerOption((option) =>
      option
        .setName("number")
        .setDescription("Pick a number (0-36) if betting on 'Number'")
        .setMinValue(0)
        .setMaxValue(36)
        .setRequired(false)
    ),

  modulePath: path.resolve(__filename),

  async execute(interaction) {
    await interaction.deferReply();

    const betAmount = interaction.options.getInteger("bet");
    const betType = interaction.options.getString("bet_type");
    const chosenNumber = interaction.options.getInteger("number");

    if (
      betType === "number" &&
      (chosenNumber === null || chosenNumber < 0 || chosenNumber > 36)
    ) {
      return interaction.editReply({
        content:
          "❌ You must provide a valid number (0-36) when betting on 'Number'.",
        ephemeral: true,
      });
    }
    if (betType !== "number" && chosenNumber !== null) {
      await interaction.followUp({
        content:
          "ℹ️ You selected a bet type other than 'Number', so the chosen number will be ignored.",
        ephemeral: true,
      });
    }

    const initialBalance = await getUserBalance(interaction.user.id);
    if (!initialBalance || betAmount > initialBalance.balance) {
      return interaction.editReply({
        content: `❌ Insufficient funds! (Need ${betAmount}, Have ${
          initialBalance?.balance ?? 0
        })`,
        ephemeral: true,
      });
    }

    await playRouletteRound(
      interaction,
      betAmount,
      betType,
      chosenNumber,
      false
    );
  },
};
