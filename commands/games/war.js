const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
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

const SUITS = ["♠️", "♥️", "♦️", "♣️"];
const RANKS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];
const RANK_VALUES = {
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function getRandomCard() {
  const rank = RANKS[Math.floor(Math.random() * RANKS.length)];
  const suit = SUITS[Math.floor(Math.random() * SUITS.length)];
  return { rank, suit, value: RANK_VALUES[rank] };
}

function getWarResult(playerValue, dealerValue) {
  if (playerValue > dealerValue) return "win";
  if (playerValue < dealerValue) return "loss";
  return "tie";
}

const TIPS = {
  win: [
    "🔥 Keep up the streak! Maybe raise your bet?",
    "✅ Winning is great! But don't push your luck too hard!",
    "💡 If you're on a streak, consider stopping at a set goal.",
  ],
  loss: [
    "❌ Bad luck! Maybe lower your bet to recover?",
    "📉 Losing streak? Take a break or change your strategy!",
    "🤔 If you're losing often, think about pacing your bets.",
  ],
  tie: [
    "⚖️ A tie! Consider playing again for a better outcome.",
    "🤝 A tie means nobody wins. Will you go for another round?",
    "🔄 No loss, no win. Maybe this is your chance to go big?",
  ],
};

async function playWarRound(interaction, bet, isFollowUp = false) {
  const userId = interaction.user.id;
  try {
    await markUserActive(userId);

    const balanceData = await getUserBalance(userId);
    if (!balanceData || bet > balanceData.balance) {
      const replyOptions = {
        content: `❌ You ${
          isFollowUp ? "no longer " : ""
        }have enough coins for this bet! (Need ${bet}, Have ${
          balanceData?.balance ?? 0
        })`,
        ephemeral: true,
      };
      if (isFollowUp && interaction.isMessageComponent()) {
        await interaction.followUp(replyOptions);
      } else if (
        !isFollowUp &&
        interaction.isChatInputCommand() &&
        (interaction.replied || interaction.deferred)
      ) {
        await interaction.editReply(replyOptions);
      } else {
        await interaction.reply(replyOptions);
      }
      return;
    }

    const playerCard = getRandomCard();
    const dealerCard = getRandomCard();
    const result = getWarResult(playerCard.value, dealerCard.value);

    let earnings = 0;
    if (result === "win") earnings = bet;
    else if (result === "loss") earnings = -bet;

    if (result !== "tie") {
      await updateUserBalance(userId, earnings, 0);
      await updateStreak(userId, result);
    }
    const finalStreak = await getUserStreak(userId);
    const finalBalance = await getUserBalance(userId);

    const embed = new EmbedBuilder()
      .setTitle("⚔️ War Results")
      .setColor(
        result === "win" ? "Green" : result === "loss" ? "Red" : "Yellow"
      )
      .addFields(
        {
          name: "Your Card",
          value: `${playerCard.rank}${playerCard.suit} (${playerCard.value})`,
          inline: true,
        },
        {
          name: "Dealer's Card",
          value: `${dealerCard.rank}${dealerCard.suit} (${dealerCard.value})`,
          inline: true,
        },
        { name: "\u200B", value: "\u200B" },
        {
          name: "🎯 Result",
          value:
            result === "win"
              ? "✅ You won!"
              : result === "loss"
              ? "❌ You lost!"
              : "⚖️ It's a tie!",
          inline: true,
        },
        {
          name: "💰 Payout",
          value: `${earnings >= 0 ? "+" : ""}${earnings} coins`,
          inline: true,
        },
        {
          name: "🔥 Streak",
          value:
            finalStreak > 0
              ? `🔥 **${finalStreak}-win streak!**`
              : finalStreak < 0
              ? `❄️ **${Math.abs(finalStreak)}-loss streak!**`
              : "😐 No streak",
          inline: true,
        },
        {
          name: "💡 Tip",
          value: TIPS[result][Math.floor(Math.random() * TIPS[result].length)],
          inline: false,
        },
        {
          name: "📊 New Balance",
          value: `🪙 ${finalBalance.balance}`,
          inline: false,
        }
      )
      .setFooter({ text: `Bet: ${bet} coins` });

    const playAgainButton = new ButtonBuilder()
      .setCustomId(`war_play_again_${interaction.id}`)
      .setLabel("Play Again")
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
      i.customId === `war_play_again_${interaction.id}` &&
      i.message.id === message.id;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      await playWarRound(i, bet, true);
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "limit" && reason !== "user") {
        try {
          if (message && !message.deleted) {
            await message.edit({ components: [] });
          }
        } catch (error) {
          console.warn(
            "Failed to remove War 'Play Again' button:",
            error.message
          );
        }
      }
    });
  } catch (error) {
    console.error("Error during playWarRound:", error);
    const errorContent = "❌ An error occurred during the War game.";
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
    .setName("war")
    .setDescription("⚔️ Play a game of War against the dealer!")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("Amount of coins to bet")
        .setRequired(true)
        .setMinValue(10)
    ),

  modulePath: path.resolve(__filename),

  async execute(interaction) {
    await interaction.deferReply();
    const bet = interaction.options.getInteger("bet");
    const initialBalance = await getUserBalance(interaction.user.id);
    if (!initialBalance || bet > initialBalance.balance) {
      return interaction.editReply({
        content: `❌ You don't have enough coins for this bet! (Need ${bet}, Have ${
          initialBalance?.balance ?? 0
        })`,
        ephemeral: true,
      });
    }
    await playWarRound(interaction, bet, false);
  },
};
