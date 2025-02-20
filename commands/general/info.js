const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { getSystemMetrics } = require("../../utils/metrics");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("info")
    .setDescription("📊 Get detailed statistics about NappBot."),

  async execute(interaction) {
    const client = interaction.client;
    const metrics = getSystemMetrics();

    const botUptime = client.uptime / 1000;
    const botUptimeFormatted = formatUptime(botUptime);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("📊 NappBot Statistics")
      .setDescription("ℹ️ Detailed bot information and system metrics.")
      .addFields(
        {
          name: "📦 Package Info",
          value:
            "```yaml\n" +
            `OS: ${require("os").type()}\n` +
            `Node.js: ${process.version}\n` +
            `Discord.js: v${require("discord.js").version}\n` +
            "```",
        },
        {
          name: "📊 Bot Metadata",
          value:
            `**Uptime:** ${botUptimeFormatted}\n` +
            `**Servers:** ${client.guilds.cache.size}\n` +
            `**API/Bot Latency:** ${client.ws.ping}ms`,
          inline: true,
        },
        {
          name: "🛠️ Shard Info",
          value:
            `**Total Shards:** ${client.shard?.count || 1}\n` +
            `**Current Shard:** ${client.shard?.ids[0] || 0}\n`,
          inline: true,
        },
        {
          name: "💻 System Metrics",
          value:
            `**System Uptime:** ${metrics.uptime}\n` +
            `**RAM Usage:** ${metrics.usedRam} GB / ${metrics.totalRam} GB\n` +
            `**Free RAM:** ${metrics.freeRam} GB\n` +
            `**CPU Load (1m avg):** ${metrics.cpuLoad}%\n` +
            `**Bot Process RAM:** ${metrics.processMemory} MB`,
          inline: false,
        },
        {
          name: "👤 Bot Owner",
          value: "n4ppstar",
          inline: false,
        }
      )
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: "Made with 💚 by n4ppstar" });

    // Buttons
    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("GitHub Repository")
        .setStyle(ButtonStyle.Link)
        .setURL("https://github.com/AetCloud/NappBot"),
      new ButtonBuilder()
        .setLabel("Support Server")
        .setStyle(ButtonStyle.Link)
        .setURL("https://discord.gg/7xFAdhG7Tx")
    );

    await interaction.reply({
      embeds: [embed],
      components: [buttons],
      ephemeral: false,
    });
  },
};

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}
