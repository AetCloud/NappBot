import path from "path";
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  InteractionFlags,
  ComponentType,
} from "discord.js";
import {
  getUserBalance,
  updateUserBalance,
  getUserStreak,
  updateStreak,
  markUserActive,
} from "../../utils/database";

const SYMBOLS = ["🍒", "🍋", "🍊", "🍉", "⭐", "💎"];
const getRandomSymbol = () =>
  SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

async function runSlotsGame(interaction, bet, isFollowUp = false) {
  const userId = interaction.user.id;

  try {
    const balanceData = await getUserBalance(userId);
    if (!balanceData || bet > balanceData.balance) {
      const replyOptions = {
        content: "❌ You no longer have enough coins for this bet!",
        ephemeral: true,
      };
      if (isFollowUp && interaction.isMessageComponent()) {
        await interaction.followUp(replyOptions);
      } else if (!isFollowUp && interaction.isChatInputCommand()) {
        await interaction.editReply(replyOptions);
      } else {
        await interaction.reply(replyOptions);
      }
      return;
    }

    await markUserActive(userId);

    const row1 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const row2 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const row3 = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];

    const win = row2[0] === row2[1] && row2[1] === row2[2];
    const jackpot = win && row2[0] === "💎";

    let winnings = 0;
    if (win) {
      winnings = jackpot ? bet * 10 : bet * 3;
    } else {
      winnings = -bet;
    }

    await updateUserBalance(userId, winnings, 0);
    const streakResult = win ? "win" : "loss";
    await updateStreak(userId, streakResult);
    const finalStreak = await getUserStreak(userId);

    let streakText = "😐 No streak";
    if (finalStreak > 0) {
      streakText = `🔥 **${finalStreak}-win streak!**`;
    } else if (finalStreak < 0) {
      streakText = `❄️ **${Math.abs(finalStreak)}-loss streak!**`;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎰 Slot Machine Results")
      .setDescription(
        `| ${row1[0]} | ${row1[1]} | ${row1[2]} |\n` +
          `| ${row2[0]} | ${row2[1]} | ${row2[2]} | ⬅️\n` +
          `| ${row3[0]} | ${row3[1]} | ${row3[2]} |`
      )
      .setColor(win ? "Green" : "Red")
      .addFields(
        { name: "\u200B", value: "\u200B" },
        {
          name: "Result",
          value: win
            ? jackpot
              ? "💎 JACKPOT!"
              : "✅ You won!"
            : "❌ You lost!",
          inline: true,
        },
        {
          name: "Payout",
          value: `${winnings >= 0 ? "+" : ""}${winnings} coins`,
          inline: true,
        },
        {
          name: "Streak",
          value: streakText,
          inline: true,
        }
      )
      .setFooter({ text: `Bet: ${bet} coins` });

    const playAgainButton = new ButtonBuilder()
      .setCustomId("slots_play_again")
      .setLabel("Spin Again")
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
      interaction.deferred
    ) {
      message = await interaction.editReply(replyOptions);
    } else {
      console.warn("Unexpected interaction state in runSlotsGame");
      message = await interaction.reply(replyOptions);
    }

    const filter = (i) =>
      i.user.id === userId &&
      i.customId === "slots_play_again" &&
      i.message.id === message.id;
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 30000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      await runSlotsGame(i, bet, true);
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "limit" && reason !== "user") {
        try {
          if (message && !message.deleted) {
            await interaction.editReply({ components: [] });
          }
        } catch (error) {
          console.warn(
            "Failed to remove components on slots collector end:",
            error.message
          );
        }
      }
    });
  } catch (error) {
    console.error("Error during runSlotsGame:", error);
    const errorContent = "❌ An error occurred while running the slots game.";
    try {
      if (isFollowUp && interaction.isMessageComponent()) {
        await interaction.followUp({ content: errorContent, ephemeral: true });
      } else if (
        !isFollowUp &&
        interaction.isChatInputCommand() &&
        interaction.deferred
      ) {
        await interaction.editReply({
          content: errorContent,
          embeds: [],
          components: [],
        });
      } else {
        await interaction.reply({ content: errorContent, ephemeral: true });
      }
    } catch (e) {
      console.error(
        "Failed to send error reply in runSlotsGame catch block",
        e
      );
    }
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("🎰 Spin the slot machine!")
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

    console.log(`⚡ Executing /slots from: ${module.exports.modulePath}`);
    const bet = interaction.options.getInteger("bet");

    await runSlotsGame(interaction, bet, false);
  },
};
