const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const { fetchE621Images, fetchE621User } = require("../../utils/e621API");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("e621")
    .setDescription("🔞 Interact with e621.net (Search posts or view profiles)")
    .setNSFW(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("🔞 Search for images on e621.net by tags")
        .addStringOption((option) =>
          option
            .setName("tags")
            .setDescription(
              "Enter search tags separated by spaces (e.g., lucario rating:safe)"
            )
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("profile")
        .setDescription("🔎 Get a user's profile from e621.net")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("The e621 username you want to lookup")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const sender = interaction.user;
    const clientUser = interaction.client.user;

    if (subcommand === "search") {
      const tagsInput = interaction.options.getString("tags");
      const tags = tagsInput
        ? tagsInput.split(" ").filter((tag) => tag.length > 0)
        : [];

      if (tags.length === 0) {
        tags.push("score:>=100");
      }

      await interaction.deferReply();

      let postDataArray;
      try {
        postDataArray = await fetchE621Images(tags, 10);
      } catch (error) {
        console.error("❌ Error fetching e621 data (search):", error);
        return interaction.editReply({
          content: "⚠️ Failed to fetch data from e621. Please try again later.",
          ephemeral: true,
        });
      }

      if (!postDataArray || postDataArray.length === 0) {
        return interaction.editReply({
          content: `❌ No results found for tags: \`${tags.join(" ")}\``,
          ephemeral: true,
        });
      }

      let currentIndex = 0;

      function createSearchEmbed(postData) {
        const embed = new EmbedBuilder()
          .setTitle("🔞 e621 Image Search Result")
          .setDescription(
            `**Artist(s):** ${
              postData.artists?.length
                ? postData.artists.join(", ")
                : "*Unknown*"
            }\n` +
              `**Characters:** ${
                postData.characters?.length
                  ? postData.characters.join(", ")
                  : "*None*"
              }`
          )
          .setColor("#00549F")
          .setImage(
            postData.imageUrl &&
              (postData.imageUrl.endsWith(".webm") ||
                postData.imageUrl.endsWith(".mp4"))
              ? postData.thumbnail
              : postData.imageUrl
          )
          .setURL(postData.postUrl)
          .setTimestamp();

        const footerText = `⭐ ${postData.score} | ❤️ ${
          postData.favCount
        } | ID: ${postData.postId} | Result ${currentIndex + 1}/${
          postDataArray.length
        }\nRequested by ${sender.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(embed, footerText, clientUser.displayAvatarURL());
        return embed;
      }

      function createSearchRow(index, total) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("View on e621")
            .setStyle(ButtonStyle.Link)
            .setURL(postDataArray[index].postUrl),
          new ButtonBuilder()
            .setCustomId(`e621_prev_${interaction.id}`)
            .setLabel("⬅️ Previous")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId(`e621_next_${interaction.id}`)
            .setLabel("Next ➡️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === total - 1)
        );
      }

      const message = await interaction.editReply({
        embeds: [createSearchEmbed(postDataArray[currentIndex])],
        components: [createSearchRow(currentIndex, postDataArray.length)],
      });

      const filter = (i) =>
        i.user.id === sender.id &&
        i.message.id === message.id &&
        (i.customId.startsWith("e621_prev_") ||
          i.customId.startsWith("e621_next_"));
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter,
        time: 90000,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate();
        if (i.customId.startsWith("e621_next_")) {
          currentIndex = Math.min(currentIndex + 1, postDataArray.length - 1);
        } else if (i.customId.startsWith("e621_prev_")) {
          currentIndex = Math.max(currentIndex - 1, 0);
        }

        await i.editReply({
          embeds: [createSearchEmbed(postDataArray[currentIndex])],
          components: [createSearchRow(currentIndex, postDataArray.length)],
        });
        collector.resetTimer();
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "messageDelete") {
          try {
            if (message && !message.deleted) {
              await interaction.editReply({ components: [] });
            }
          } catch (error) {
            console.warn(
              "Failed to remove components on e621 search collector end:",
              error.message
            );
          }
        }
      });
    } else if (subcommand === "profile") {
      const username = interaction.options.getString("username");
      await interaction.deferReply();

      let profileData;
      try {
        profileData = await fetchE621User(username);
      } catch (error) {
        console.error("❌ Error fetching e621 user data (profile):", error);
        return interaction.editReply({
          content:
            "⚠️ Failed to fetch profile data from e621. Please try again later.",
          ephemeral: true,
        });
      }

      if (!profileData) {
        return interaction.editReply({
          content: `❌ User profile not found for username: \`${username}\``,
          ephemeral: true,
        });
      }

      let currentView = "uploads";
      let imageData = [];

      try {
        imageData = await fetchE621Images([`user:${profileData.username}`], 3);
      } catch (fetchError) {
        console.warn(
          `Could not fetch uploads for ${profileData.username}:`,
          fetchError.message
        );
      }

      if (!imageData || imageData.length === 0) {
        try {
          imageData = await fetchE621Images([`fav:${profileData.username}`], 3);
          if (imageData && imageData.length > 0) {
            currentView = "favorites";
          }
        } catch (fetchError) {
          console.warn(
            `Could not fetch favorites for ${profileData.username}:`,
            fetchError.message
          );
        }
      }

      function createProfileEmbed(profile, images, viewType) {
        const imagesList =
          images && images.length > 0
            ? images
                .map(
                  (post, index) =>
                    `**${index + 1}.** [Post ID: ${post.postId}](${
                      post.postUrl
                    }) | Score: ${post.score}`
                )
                .join("\n")
            : `No recent ${viewType} found.`;

        const embed = new EmbedBuilder()
          .setTitle(`📊 e621 User Profile: ${profile.username}`)
          .setURL(`https://e621.net/users/${profile.id}`)
          .setColor("#00549F")
          .setThumbnail("https://e621.net/static/logo.png")
          .addFields(
            {
              name: "🆔 User ID",
              value: String(profile.id || "N/A"),
              inline: true,
            },
            { name: "📅 Joined", value: profile.joined || "N/A", inline: true },
            { name: "\u200B", value: "\u200B", inline: true },
            {
              name: "📤 Uploads",
              value: String(profile.uploads ?? "0"),
              inline: true,
            },
            {
              name: "❤️ Favorites",
              value: String(profile.favorites ?? "0"),
              inline: true,
            },
            {
              name: "📝 Tag Edits",
              value: String(profile.tagEdits ?? "0"),
              inline: true,
            },
            {
              name: `🖼️ Recent ${
                viewType === "uploads" ? "Uploads" : "Favorites"
              } (Max 3)`,
              value: imagesList,
              inline: false,
            }
          )
          .setTimestamp();

        const footerText = `Requested by ${sender.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
        setCustomFooter(embed, footerText, clientUser.displayAvatarURL());
        return embed;
      }

      function createProfileRow(viewType) {
        return new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`e621profile_toggle_${interaction.id}`)
            .setLabel(
              `View Recent ${viewType === "uploads" ? "Favorites" : "Uploads"}`
            )
            .setStyle(ButtonStyle.Secondary)
        );
      }

      const profileMessage = await interaction.editReply({
        embeds: [createProfileEmbed(profileData, imageData, currentView)],
        components: [createProfileRow(currentView)],
      });

      const profileFilter = (i) =>
        i.user.id === sender.id &&
        i.message.id === profileMessage.id &&
        i.customId.startsWith("e621profile_toggle_");
      const profileCollector = profileMessage.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: profileFilter,
        time: 60000,
      });

      profileCollector.on("collect", async (i) => {
        await i.deferUpdate();

        currentView = currentView === "uploads" ? "favorites" : "uploads";
        let newImageData = [];

        try {
          const fetchTags = [
            `${currentView === "uploads" ? "user" : "fav"}:${
              profileData.username
            }`,
          ];
          newImageData = await fetchE621Images(fetchTags, 3);
        } catch (fetchError) {
          console.warn(
            `Could not fetch ${currentView} for ${profileData.username}:`,
            fetchError.message
          );
          newImageData = [];
        }

        await i.editReply({
          embeds: [createProfileEmbed(profileData, newImageData, currentView)],
          components: [createProfileRow(currentView)],
        });
        profileCollector.resetTimer();
      });

      profileCollector.on("end", async (collected, reason) => {
        if (reason !== "messageDelete") {
          try {
            if (profileMessage && !profileMessage.deleted) {
              await interaction.editReply({ components: [] });
            }
          } catch (error) {
            console.warn(
              "Failed to remove components on e621 profile collector end:",
              error.message
            );
          }
        }
      });
    }
  },
  modulePath: __filename,
};
