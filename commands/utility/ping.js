const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { setDefaultFooter } = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("🏓 Check bot latency"),

  async execute(interaction, client) {
    const latency = Date.now() - interaction.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setTitle("🏓 Pong!")
      .setDescription(
        `**Latency:** ${latency}ms\n**API Latency:** ${apiLatency}ms`
      )
      .setColor("#3498DB")
      .setTimestamp();

    setDefaultFooter(embed, client.user);

    await interaction.reply({
      embeds: [embed],
      ephemeral: true,
    });
  },
};
