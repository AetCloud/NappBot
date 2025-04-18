const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ApplicationCommandOptionType,
  ComponentType, // Import ComponentType
} = require("discord.js");
const path = require("path");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cmds")
    .setDescription("📜 Browse available commands by category."),
  defer: true, // Keep this, interactionCreate.js handles the initial defer

  async execute(interaction) {
    try {
      const commandList = interaction.client.commands;

      if (!commandList || commandList.size === 0) {
        return interaction.editReply("⚠️ No commands available.");
      }

      // --- Prepare Data ---
      const categories = {};
      let commandCount = 0;

      commandList.forEach((cmd) => {
        if (!cmd.filePath) return; // Skip if no path
        const category = path.dirname(cmd.filePath).split(path.sep).pop();
        const capitalizedCategory =
          category.charAt(0).toUpperCase() + category.slice(1);

        if (!categories[capitalizedCategory]) {
          categories[capitalizedCategory] = [];
        }

        const subcommands = cmd.data.options?.filter(
          (option) => option.type === ApplicationCommandOptionType.Subcommand
        );

        if (subcommands && subcommands.length > 0) {
          categories[capitalizedCategory].push(
            `**/${cmd.data.name}** - *(${cmd.data.description})*`
          );
          subcommands.forEach((sub) => {
            categories[capitalizedCategory].push(
              `  ┕ \`/${cmd.data.name} ${sub.name}\` - ${sub.description}`
            );
            commandCount++;
          });
        } else {
          categories[capitalizedCategory].push(
            `\`/${cmd.data.name}\` - ${cmd.data.description}`
          );
          commandCount++;
        }
      });

      const sortedCategoryNames = Object.keys(categories).sort();
      if (sortedCategoryNames.length === 0) {
        return interaction.editReply("⚠️ No categorized commands found.");
      }

      let currentCategoryIndex = 0;

      // --- Helper Functions ---
      const generateEmbed = (index) => {
        const categoryName = sortedCategoryNames[index];
        const commandsInCategory = categories[categoryName];

        // Simple truncation if too long for one field - adjust as needed
        let commandString = commandsInCategory.join("\n");
        if (commandString.length > 1024) {
          commandString = commandString.substring(0, 1020) + "\n...";
        }

        return new EmbedBuilder()
          .setTitle(`📜 Commands - ${categoryName}`)
          .setColor("#F1C40F")
          .addFields({
            name: `📂 ${categoryName}`,
            value: commandString || "No commands in this category.",
          })
          .setFooter({
            text: `Category ${index + 1} of ${
              sortedCategoryNames.length
            } | Total Commands: ${commandCount}`,
            iconURL: interaction.client.user.displayAvatarURL(),
          })
          .setTimestamp();
      };

      const generateButtons = (index) => {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("prev_cat")
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId("next_cat")
            .setLabel("Next ➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === sortedCategoryNames.length - 1)
        );
      };

      // --- Initial Reply ---
      const initialEmbed = generateEmbed(currentCategoryIndex);
      const initialButtons = generateButtons(currentCategoryIndex);

      const message = await interaction.editReply({
        embeds: [initialEmbed],
        components: [initialButtons],
      });

      // --- Collector ---
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button, // Specify Button type
        filter: (i) => i.user.id === interaction.user.id,
        time: 120000, // 2 minutes inactivity timeout
      });

      collector.on("collect", async (i) => {
        if (i.customId === "prev_cat") {
          currentCategoryIndex = Math.max(0, currentCategoryIndex - 1);
        } else if (i.customId === "next_cat") {
          currentCategoryIndex = Math.min(
            sortedCategoryNames.length - 1,
            currentCategoryIndex + 1
          );
        }

        const newEmbed = generateEmbed(currentCategoryIndex);
        const newButtons = generateButtons(currentCategoryIndex);

        try {
          await i.update({
            embeds: [newEmbed],
            components: [newButtons],
          });
        } catch (updateError) {
          console.error(
            "Failed to update command list interaction:",
            updateError
          );
        }
        // No need to reset timer manually here, collector handles inactivity timeout
      });

      collector.on("end", async (collected, reason) => {
        // Edit the message to remove buttons after timeout or manual stop
        try {
          await interaction.editReply({
            embeds: [generateEmbed(currentCategoryIndex)], // Keep the last embed
            components: [], // Remove buttons
          });
        } catch (error) {
          // Ignore if message was deleted
        }
      });
    } catch (error) {
      console.error("❌ [ERROR] /cmds failed:", error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(
            "⚠️ An error occurred while retrieving commands."
          );
        } else {
          await interaction.reply({
            content: "⚠️ An error occurred while retrieving commands.",
            ephemeral: true,
          });
        }
      } catch (errorReplyError) {
        console.error("Failed to send error reply for /cmds:", errorReplyError);
      }
    }
  },
};
