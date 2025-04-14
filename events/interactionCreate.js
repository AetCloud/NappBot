const { EmbedBuilder } = require("discord.js");
const cooldowns = new Map();

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

    // Cooldown system
    const cooldownKey = `${interaction.user.id}-${interaction.commandName}`;
    const now = Date.now();
    const cooldownTime = (command.cooldown || 3) * 1000;

    if (cooldowns.has(cooldownKey)) {
      const expiration = cooldowns.get(cooldownKey) + cooldownTime;
      if (now < expiration) {
        const timeLeft = ((expiration - now) / 1000).toFixed(1);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                `⏳ Please wait ${timeLeft}s before reusing this command`
              )
              .setColor("#FFA500"),
          ],
          ephemeral: true,
        });
      }
    }

    try {
      // Defer reply for commands taking longer than 2 seconds
      if (command.defer)
        await interaction.deferReply({ ephemeral: command.ephemeral });

      // Execute command
      await command.execute(interaction, client);
      cooldowns.set(cooldownKey, now);
    } catch (error) {
      console.error(`Command Error: /${interaction.commandName}`, {
        User: interaction.user.tag,
        Guild: interaction.guild?.name,
        Error: error.stack,
      });

      const errorMessage =
        process.env.NODE_ENV === "production"
          ? "❌ Something went wrong. Please try again later."
          : `🔧 Error: ${error.message}`;

      const errorEmbed = new EmbedBuilder()
        .setDescription(errorMessage)
        .setColor("#FF0000");

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          embeds: [errorEmbed],
          components: [],
        });
      } else {
        await interaction.reply({
          embeds: [errorEmbed],
          ephemeral: true,
        });
      }
    }
  },
};
