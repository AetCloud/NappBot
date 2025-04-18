const path = require("path");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  InteractionFlags,
} = require("discord.js");
const {
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  markUserActive,
} = require("../../utils/database");

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  "A",
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
];

function generateDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      suit,
      rank,
      value: rank === "A" ? 11 : isNaN(rank) ? 10 : parseInt(rank),
    }))
  );
}

function drawCard(deck) {
  if (deck.length === 0) {
    console.warn("Deck is empty, cannot draw card.");
    return null;
  }
  const index = Math.floor(Math.random() * deck.length);
  return deck.splice(index, 1)[0];
}

function calculateHandValue(hand) {
  if (!Array.isArray(hand) || hand.some((card) => !card)) return 0;
  let value = hand.reduce((sum, card) => sum + card.value, 0);
  let aces = hand.filter((card) => card.rank === "A").length;
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  return value;
}

function formatHand(hand) {
  if (!Array.isArray(hand) || hand.some((card) => !card)) return "Invalid Hand";
  return hand.map((card) => `${card.rank}${card.suit}`).join(" ");
}

function getHandStrengthTip(total) {
  if (total <= 11)
    return "Low total. Consider hitting unless the dealer shows a bust card.";
  if (total >= 12 && total <= 16)
    return "Risky zone. Consider standing if the dealer shows a weak card (2-6), otherwise hit.";
  if (total >= 17 && total <= 20)
    return "Strong hand. Standing is generally recommended.";
  if (total === 21) return "Blackjack! The best possible hand.";
  return "Bust! Your hand is over 21.";
}

async function determineAndEndGame(
  interaction,
  userId,
  playerHand,
  dealerHand,
  deck,
  bet,
  initialStreak
) {
  let playerTotal = calculateHandValue(playerHand);
  let dealerTotal = calculateHandValue(dealerHand);

  while (dealerTotal < 17) {
    const newCard = drawCard(deck);
    if (newCard) {
      dealerHand.push(newCard);
      dealerTotal = calculateHandValue(dealerHand);
    } else {
      console.warn("Dealer couldn't draw card, deck empty.");
      break;
    }
  }

  let resultText;
  let resultOutcome;
  let color;
  let earnings = 0;

  if (playerTotal > 21) {
    resultText = "busted and lost 💀";
    resultOutcome = "loss";
    color = "Red";
    earnings = -bet;
  } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
    resultText = "won 🎉";
    resultOutcome = "win";
    color = "Green";
    earnings = bet;
  } else if (dealerTotal === playerTotal) {
    resultText = "pushed 🤝";
    resultOutcome = "push";
    color = "#808080";
    earnings = 0;
  } else {
    resultText = "lost 💀";
    resultOutcome = "loss";
    color = "Red";
    earnings = -bet;
  }

  let finalStreak = initialStreak;
  if (resultOutcome !== "push") {
    await updateStreak(userId, resultOutcome);
    finalStreak = await getUserStreak(userId);
    await updateUserBalance(userId, earnings, 0);
  }

  const handStrengthTip = getHandStrengthTip(playerTotal);

  const embed = new EmbedBuilder()
    .setTitle("🃏 Blackjack Result")
    .setDescription(
      `**Dealer's Hand:** ${formatHand(dealerHand)} (**${dealerTotal}**)\n` +
        `**Your Hand:** ${formatHand(playerHand)} (**${playerTotal}**)\n\n` +
        `You **${resultText}**!\n` +
        (earnings !== 0
          ? `💰 **Payout:** ${earnings > 0 ? "+" : ""}${earnings} coins\n`
          : "💰 **Payout:** 0 coins\n") +
        `🔥 **Streak:** ${finalStreak}\n\n` +
        `**Tip:** ${handStrengthTip}`
    )
    .setColor(color)
    .setFooter({ text: `Bet: ${bet} coins` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("play_again_blackjack")
      .setLabel("Play Again")
      .setStyle(ButtonStyle.Success)
  );

  try {
    if (interaction.isMessageComponent()) {
      await interaction.update({ embeds: [embed], components: [row] });
    } else {
      await interaction.editReply({ embeds: [embed], components: [row] });
    }
  } catch (error) {
    console.error("Failed to edit reply with final results:", error);
    try {
      await interaction.followUp({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    } catch (followUpError) {
      console.error("Failed to follow up with final results:", followUpError);
    }
  }
}

function createGameEmbed(playerHand, dealerHand, showDealerCard = false) {
  const playerTotal = calculateHandValue(playerHand);
  const dealerVisibleCard = dealerHand[0]
    ? `${dealerHand[0].rank}${dealerHand[0].suit}`
    : "?";
  const dealerText = showDealerCard
    ? `${formatHand(dealerHand)} (**${calculateHandValue(dealerHand)}**)`
    : `${dealerVisibleCard} ?`;

  return new EmbedBuilder()
    .setTitle("🃏 Blackjack")
    .setColor(playerTotal > 21 ? "Red" : "Blue")
    .addFields(
      {
        name: "Your Hand",
        value: `${formatHand(playerHand)} (**${playerTotal}**)`,
        inline: true,
      },
      { name: "Dealer's Hand", value: dealerText, inline: true }
    )
    .setFooter({
      text: `Use buttons to play. Tip: ${getHandStrengthTip(playerTotal)}`,
    });
}

function createActionRow(playerTotal, canDouble, bet) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("hit_blackjack")
      .setLabel("Hit")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(playerTotal >= 21),
    new ButtonBuilder()
      .setCustomId("stand_blackjack")
      .setLabel("Stand")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("double_blackjack")
      .setLabel(`Double (${bet * 2})`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canDouble || playerTotal >= 21)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("🃏 Play a game of blackjack!")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("The amount of coins to bet")
        .setRequired(true)
        .setMinValue(10)
    ),

  modulePath: path.resolve(__filename),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      console.log(`⚡ Executing /blackjack from: ${module.exports.modulePath}`);

      const userId = interaction.user.id;
      const initialBet = interaction.options.getInteger("bet");
      let currentBet = initialBet;

      const balanceData = await getUserBalance(userId);
      const initialStreak = await getUserStreak(userId);

      if (!balanceData || initialBet > balanceData.balance) {
        return interaction.editReply({
          content: "❌ You don't have enough coins for this bet!",
          flags: InteractionFlags.EPHEMERAL,
        });
      }

      await updateUserBalance(userId, -initialBet, 0);
      let currentBalance = balanceData.balance - initialBet;

      await markUserActive(userId);

      const deck = generateDeck();
      let playerHand = [];
      let dealerHand = [];

      playerHand.push(drawCard(deck));
      dealerHand.push(drawCard(deck));
      playerHand.push(drawCard(deck));
      dealerHand.push(drawCard(deck));

      let playerTotal = calculateHandValue(playerHand);
      let canDouble = true;

      if (playerTotal === 21) {
        await determineAndEndGame(
          interaction,
          userId,
          playerHand,
          dealerHand,
          deck,
          currentBet,
          initialStreak
        );
        return;
      }

      const initialEmbed = createGameEmbed(playerHand, dealerHand);
      const initialActions = createActionRow(
        playerTotal,
        canDouble && currentBalance >= initialBet,
        currentBet
      );

      const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: [initialActions],
      });

      const filter = (i) =>
        i.isButton() && i.user.id === userId && i.message.id === message.id;
      const collector = interaction.channel.createMessageComponentCollector({
        filter,
        time: 60000,
      });

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();

          if (i.customId === "hit_blackjack") {
            canDouble = false;
            const newCard = drawCard(deck);
            if (newCard) playerHand.push(newCard);
            playerTotal = calculateHandValue(playerHand);

            if (playerTotal >= 21) {
              collector.stop("player_action_complete");
              await determineAndEndGame(
                i,
                userId,
                playerHand,
                dealerHand,
                deck,
                currentBet,
                initialStreak
              );
            } else {
              const gameEmbed = createGameEmbed(playerHand, dealerHand);
              const actions = createActionRow(playerTotal, false, currentBet);
              await i.editReply({ embeds: [gameEmbed], components: [actions] });
            }
          } else if (i.customId === "stand_blackjack") {
            collector.stop("player_action_complete");
            await determineAndEndGame(
              i,
              userId,
              playerHand,
              dealerHand,
              deck,
              currentBet,
              initialStreak
            );
          } else if (i.customId === "double_blackjack") {
            if (currentBalance < initialBet) {
              await i.followUp({
                content: "❌ You cannot afford to double down!",
                ephemeral: true,
              });
              return;
            }
            await updateUserBalance(userId, -initialBet, 0);
            currentBalance -= initialBet;
            currentBet *= 2;

            canDouble = false;
            const newCard = drawCard(deck);
            if (newCard) playerHand.push(newCard);

            collector.stop("player_action_complete");
            await determineAndEndGame(
              i,
              userId,
              playerHand,
              dealerHand,
              deck,
              currentBet,
              initialStreak
            );
          } else if (i.customId === "play_again_blackjack") {
            collector.stop("restart");
            module.exports.execute(i);
          }

          if (collector.checkEnd() === false) {
            collector.resetTimer();
          }
        } catch (error) {
          console.error("Error during Blackjack button interaction:", error);
          collector.stop("error");
          try {
            await i.followUp({
              content: "❌ An error occurred during your turn.",
              ephemeral: true,
            });
          } catch {}
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          try {
            const timeoutEmbed = new EmbedBuilder()
              .setTitle("🃏 Blackjack Timeout")
              .setDescription(
                "Game timed out due to inactivity. Your bet is lost."
              )
              .setColor("Orange");
            await updateUserBalance(userId, -currentBet, 0);
            await updateStreak(userId, "loss");
            await interaction.editReply({
              embeds: [timeoutEmbed],
              components: [],
            });
          } catch (error) {
            console.warn(
              "Failed to edit reply on collector timeout:",
              error.message
            );
          }
        } else if (
          reason !== "player_action_complete" &&
          reason !== "restart" &&
          reason !== "error"
        ) {
          try {
            if (interaction.message && !interaction.message.deleted) {
              await interaction.editReply({ components: [] });
            }
          } catch (error) {
            console.warn(
              "Failed to remove components on collector end (generic):",
              error.message
            );
          }
        }
      });
    } catch (error) {
      console.error("Error executing /blackjack command:", error);
      const errorContent =
        "❌ An error occurred setting up the Blackjack game.";
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: errorContent, ephemeral: true });
      } else {
        await interaction.editReply({
          content: errorContent,
          embeds: [],
          components: [],
        });
      }
    }
  },
};
