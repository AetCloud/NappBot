const { SlashCommandBuilder } = require("discord.js");
const {
  getUserBalance,
  updateUserBalance,
  database,
} = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Withdraw money from your bank account.")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("Amount to withdraw")
        .setRequired(true)
    ),
  async execute(interaction) {
    const userId = interaction.user.id;
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply({
        content: "❌ You must withdraw a **positive** amount.",
        ephemeral: true,
      });
    }

    const balanceData = await getUserBalance(userId);

    if (!balanceData) {
      return interaction.reply({
        content: "❌ Error fetching your balance. Please try again later.",
        ephemeral: true,
      });
    }

    if (balanceData.bank_balance < amount) {
      return interaction.reply({
        content: `❌ Insufficient funds! Your bank balance is **🏦 ${balanceData.bank_balance}**.`,
        ephemeral: true,
      });
    }

    await updateUserBalance(userId, amount, -amount);

    await database.execute(
      "UPDATE users SET active_last = NOW() WHERE user_id = ?",
      [userId]
    );

    await interaction.reply(
      `✅ **Withdrew 🪙 ${amount}** from your bank account!\n\n📊 **New Balances:**\n- Wallet: 🪙 **${
        balanceData.balance + amount
      }**\n- Bank: 🏦 **${balanceData.bank_balance - amount}**`
    );
  },
};
