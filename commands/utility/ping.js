const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Check bot latency"),

  async execute(interaction, client) {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    await interaction.reply({
      content: `🏓 Pong! (${latency}ms) | API: ${apiLatency}ms`,
      ephemeral: true,
    });
  },
};
