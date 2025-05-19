const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setDefaultFooter } = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("🪙 Flip a coin (Heads or Tails)"),
  async execute(interaction) {
    const outcomes = [
      { name: "Heads", emoji: "🪙" },
      { name: "Tails", emoji: "🎭" },
    ];
    const result = outcomes[Math.floor(Math.random() * outcomes.length)];

    const embed = new EmbedBuilder()
      .setColor(result.name === "Heads" ? "#FFD700" : "#A9A9A9")
      .setTitle("🪙 Coin Flip Result")
      .setDescription(`The coin landed on **${result.name} ${result.emoji}**!`)
      .setTimestamp();

    setDefaultFooter(embed, interaction.client.user);

    await interaction.reply({ embeds: [embed] });
  },
  modulePath: __filename,
};
