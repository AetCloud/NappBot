const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("🗿📄✂️ Play Rock, Paper, Scissors against the bot!")
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("Choose rock, paper, or scissors")
        .setRequired(true)
        .addChoices(
          { name: "Rock 🗿", value: "rock" },
          { name: "Paper 📄", value: "paper" },
          { name: "Scissors ✂️", value: "scissors" }
        )
    ),
  async execute(interaction) {
    try {
      const userChoice = interaction.options.getString("choice");
      const choices = ["rock", "paper", "scissors"];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      const choiceEmojis = {
        rock: "🗿",
        paper: "📄",
        scissors: "✂️",
      };

      let result;
      let resultEmoji;

      if (userChoice === botChoice) {
        result = "It's a tie!";
        resultEmoji = "🤝";
      } else if (
        (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper")
      ) {
        result = "You win!";
        resultEmoji = "🎉";
      } else {
        result = "You lose!";
        resultEmoji = "💀";
      }

      await interaction.reply(
        `You chose **${userChoice}** <span class="math-inline">\{choiceEmojis\[userChoice\]\}, I chose \*\*</span>{botChoice}** ${choiceEmojis[botChoice]}. ${result} ${resultEmoji}`
      );
    } catch (error) {
      console.error("Error executing /rps command:", error);
      await interaction.reply({
        content:
          "An error occurred while playing the game. Please try again later.",
        ephemeral: true,
      });
    }
  },
  modulePath: __filename,
};
