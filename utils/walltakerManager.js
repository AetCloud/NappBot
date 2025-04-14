const { fetchWalltakerImage } = require("./fetchWalltaker");
const { getE621PostId } = require("./e621API");
const { database } = require("./database");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

// Configuration
const CHECK_INTERVAL = process.env.WALLTAKER_CHECK_INTERVAL || 5 * 60 * 1000; // 5 minutes
const DEFAULT_FOOTER_ICON =
  "https://cdn-icons-png.flaticon.com/512/1828/1828490.png";

// Database Queries
const WALLTAKER_SETTINGS_QUERY =
  "SELECT guild_id, feed_id, channel_id FROM walltaker_settings;";
const LAST_POSTED_QUERY =
  "SELECT image_url FROM walltaker_history WHERE guild_id = ? ORDER BY posted_at DESC LIMIT 1;";
const SAVE_POSTED_QUERY =
  "INSERT INTO walltaker_history (guild_id, image_url) VALUES (?, ?);";

async function fetchWalltakerSettings() {
  try {
    const [rows] = await database.execute(WALLTAKER_SETTINGS_QUERY);
    return rows;
  } catch (error) {
    console.error("❌ Database Error - fetchWalltakerSettings:", error);
    return [];
  }
}

async function getLastPostedImage(guildId) {
  try {
    const [rows] = await database.execute(LAST_POSTED_QUERY, [guildId]);
    return rows?.[0]?.image_url || null;
  } catch (error) {
    console.error(
      `❌ Database Error - getLastPostedImage (Guild ${guildId}):`,
      error
    );
    return null;
  }
}

async function saveLastPostedImage(guildId, imageUrl) {
  try {
    await database.execute(SAVE_POSTED_QUERY, [guildId, imageUrl]);
  } catch (error) {
    console.error(
      `❌ Database Error - saveLastPostedImage (Guild ${guildId}):`,
      error
    );
  }
}

async function processGuildFeed(client, { guild_id, feed_id, channel_id }) {
  try {
    const channel = await client.channels.fetch(channel_id);
    if (!channel) {
      console.error(`❌ Channel ${channel_id} not found in guild ${guild_id}`);
      return;
    }

    const imageData = await fetchWalltakerImage(feed_id);
    if (!imageData) {
      console.log(
        `⚠️ No Walltaker image found for feed ${feed_id} (Guild ${guild_id})`
      );
      return;
    }

    const { imageUrl, sourceUrl, lastUpdatedBy } = imageData;
    const cleanImageUrl = imageUrl?.trim() || null;

    // Check for duplicates
    const lastPosted = await getLastPostedImage(guild_id);
    if (lastPosted === cleanImageUrl) {
      console.log(`✅ No new image for guild ${guild_id}`);
      return;
    }

    // Prepare embed
    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Walltaker Feed #${feed_id}`)
      .setDescription("🔄 **Automatic Update** - New wallpaper detected!")
      .setImage(cleanImageUrl)
      .setColor("#3498DB")
      .setFooter({
        text: `Updated by: ${lastUpdatedBy?.trim() || "Anonymous"}`,
        iconURL: DEFAULT_FOOTER_ICON,
      });

    // Prepare buttons
    const buttons = [
      new ButtonBuilder()
        .setLabel("🔗 Walltaker Source")
        .setStyle(ButtonStyle.Link)
        .setURL(sourceUrl),
    ];

    // Add e621 button if available
    const e621PostId = await getE621PostId(cleanImageUrl);
    if (e621PostId) {
      buttons.push(
        new ButtonBuilder()
          .setLabel("🔍 e621 Post")
          .setStyle(ButtonStyle.Link)
          .setURL(`https://e621.net/posts/${e621PostId}`)
      );
    }

    // Send message
    await channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(...buttons)],
    });

    // Update history
    await saveLastPostedImage(guild_id, cleanImageUrl);
    console.log(`✅ Posted new image to guild ${guild_id}`);
  } catch (error) {
    console.error(`❌ Error processing guild ${guild_id}:`, error);
  }
}

async function initializeWalltaker(client) {
  console.log("🔄 Initializing Walltaker feeds...");

  // Immediate first check
  await checkAndPostFeeds(client);

  // Set up interval
  const interval = setInterval(() => checkAndPostFeeds(client), CHECK_INTERVAL);

  // Cleanup on client shutdown
  client.on("destroyed", () => clearInterval(interval));
}

async function checkAndPostFeeds(client) {
  try {
    console.log("🔍 Checking Walltaker feeds...");
    const settings = await fetchWalltakerSettings();

    if (!settings.length) {
      console.log("⚠️ No Walltaker feeds configured");
      return;
    }

    console.log(`📡 Processing ${settings.length} feeds...`);
    await Promise.allSettled(
      settings.map((config) => processGuildFeed(client, config))
    );
  } catch (error) {
    console.error("❌ Walltaker feed check failed:", error);
  }
}

module.exports = {
  initializeWalltaker,
};
