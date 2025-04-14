const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rps")
    .setDescription("🗿📄✂️ Play Rock, Paper, Scissors against the bot!") // Updated description
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("Choose rock, paper, or scissors")
        .setRequired(true)
        .addChoices(
          { name: "Rock 🗿", value: "rock" }, // Standard emoji
          { name: "Paper 📄", value: "paper" }, // Standard emoji
          { name: "Scissors ✂️", value: "scissors" } // Standard emoji
        )
    ),
  async execute(interaction) {
    try {
      const userChoice = interaction.options.getString("choice");
      const choices = ["rock", "paper", "scissors"];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      // Map choices to emojis for the reply
      const choiceEmojis = {
        rock: "🗿",
        paper: "📄",
        scissors: "✂️",
      };

      let result;
      let resultEmoji;

      if (userChoice === botChoice) {
        result = "It's a tie!";
        resultEmoji = "🤝"; // Tie emoji
      } else if (
        (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper")
      ) {
        result = "You win!";
        resultEmoji = "🎉"; // Win emoji
      } else {
        result = "You lose!";
        resultEmoji = "💀"; // Lose emoji
      }

      await interaction.reply(
        `You chose **${userChoice}** <span class="math-inline">\{choiceEmojis\[userChoice\]\}, I chose \*\*</span>{botChoice}** ${choiceEmojis[botChoice]}. ${result} ${resultEmoji}`
      );
    } catch (error) {
      console.error("Error executing /rps command:", error); // Added better logging
      await interaction.reply({
        // Reply ephemerally on error
        content:
          "An error occurred while playing the game. Please try again later.",
        ephemeral: true,
      });
    }
  },
  modulePath: __filename, // Keep if used elsewhere, otherwise optional
};
