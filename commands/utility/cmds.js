const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cmds")
    .setDescription("📜 View a list of all available commands."),

  async execute(interaction) {
    console.log(
      `⚡ [DEBUG] /cmds used by ${interaction.user.tag} (${interaction.user.id})`
    );

    try {
      await interaction.deferReply();
      console.log("⌛ [DEBUG] Reply deferred");

      const commandList = interaction.client.commands;

      if (!commandList || commandList.size === 0) {
        console.warn("⚠️ [WARN] No commands found in client.commands.");
        return interaction.editReply("⚠️ No commands available.");
      }

      const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
      const categories = {};

      commandList.forEach((cmd, cmdName) => {
        const category = capitalize(path.basename(path.dirname(cmd.filePath)));

        if (!categories[category]) {
          categories[category] = [];
        }

        categories[category].push(
          `\`/${cmd.data.name}\` - ${cmd.data.description}`
        );
      });

      const embedFields = Object.keys(categories).map((category) => ({
        name: `📂 ${category}`,
        value: categories[category].join("\n"),
      }));

      console.log("✅ [DEBUG] Successfully grouped commands by category");

      const embed = new EmbedBuilder()
        .setTitle("📜 Available Commands")
        .setColor("#F1C40F")
        .addFields(embedFields)
        .setFooter({
          text: `Total Commands: ${commandList.size}`,
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      console.log("✅ [DEBUG] Command list sent successfully");
    } catch (error) {
      console.error("❌ [ERROR] /cmds failed:", error);
      return interaction.editReply(
        "⚠️ An error occurred while retrieving commands."
      );
    }
  },
};
