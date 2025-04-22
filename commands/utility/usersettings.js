const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getUserPreference,
  setUserPreference,
} = require("../../utils/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("usersettings")
    .setDescription("⚙️ View or modify your personal bot settings.")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("👀 View your current settings.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("set_preference")
        .setDescription("🔧 Set your preferred gender interaction type.")
        .addStringOption((option) =>
          option
            .setName("sex")
            .setDescription("Choose 'male' or 'female'.")
            .setRequired(true)
            .addChoices(
              { name: "Male", value: "male" },
              { name: "Female", value: "female" }
            )
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      if (subcommand === "view") {
        const preference = await getUserPreference(userId);

        const embed = new EmbedBuilder()
          .setTitle("⚙️ Your User Settings")
          .setColor("#3498db")
          .addFields({
            name: "🚻 Interaction Preference",
            value: preference
              ? preference.charAt(0).toUpperCase() + preference.slice(1)
              : "Not set",
            inline: false,
          })
          .setFooter({
            text: `User ID: ${userId}`,
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed], ephemeral: true });
      } else if (subcommand === "set_preference") {
        const preference = interaction.options.getString("sex");
        const success = await setUserPreference(userId, preference);

        if (success) {
          console.log(`✅ Preference set for ${userId}: ${preference}`);
          await interaction.editReply({
            content: `✅ Your interaction preference has been set to **${preference}**!`,
            ephemeral: true,
          });
        } else {
          console.error(`❌ Failed to set preference for user ${userId}`);
          await interaction.editReply({
            content:
              "⚠️ Could not save your preference. Please try again later.",
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      console.error(
        `Error executing /usersettings (subcommand: ${subcommand}):`,
        error
      );
      await interaction
        .editReply({
          content: "❌ An error occurred while handling your settings.",
          ephemeral: true,
        })
        .catch(() => {});
    }
  },
  modulePath: __filename,
};
