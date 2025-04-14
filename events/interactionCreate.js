const { EmbedBuilder } = require("discord.js");
const cooldowns = new Map();

// Global configuration
const DEFAULT_COOLDOWN = 3; // Seconds
const DEFER_THRESHOLD = 2000; // Defer replies for commands taking longer than 2 seconds

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      return interaction.reply({
        content: "❌ This command is not available",
        ephemeral: true,
      });
    }

    // Global cooldown system
    const cooldownKey = `${interaction.user.id}-${command.data.name}`;
    const cooldownTime = (command.cooldown || DEFAULT_COOLDOWN) * 1000;

    if (cooldowns.has(cooldownKey)) {
      const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
      if (Date.now() < expirationTime) {
        const timeLeft = ((expirationTime - Date.now()) / 1000).toFixed(1);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                `⏳ Please wait ${timeLeft}s before using this command`
              )
              .setColor("#FFA500"),
          ],
          ephemeral: true,
        });
      }
    }

    try {
      // Auto-defer long running commands
      let deferred = false;
      if (command.defer === undefined) {
        // Only auto-defer if not explicitly set
        const deferTimer = setTimeout(async () => {
          await interaction.deferReply({ ephemeral: command.ephemeral });
          deferred = true;
        }, DEFER_THRESHOLD);

        await command.execute(interaction, client);
        clearTimeout(deferTimer);
      } else {
        if (command.defer)
          await interaction.deferReply({ ephemeral: command.ephemeral });
        await command.execute(interaction, client);
      }

      // Update cooldown
      cooldowns.set(cooldownKey, Date.now());
    } catch (error) {
      console.error(`Command Error: /${interaction.commandName}`, error.stack);

      const errorEmbed = new EmbedBuilder()
        .setDescription("❌ An error occurred while processing this command")
        .setColor("#FF0000");

      if (deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }
    }
  },
};
