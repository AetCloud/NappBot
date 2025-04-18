const { fetchWalltakerImage } = require("./fetchWalltaker");
const { getE621PostId } = require("./e621API");
const { getLastPostedImage, saveLastPostedImage } = require("./database");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const CHECK_INTERVAL =
  parseInt(process.env.WALLTAKER_CHECK_INTERVAL, 10) || 5 * 60 * 1000;
const DEFAULT_FOOTER_ICON =
  "https://cdn-icons-png.flaticon.com/512/1828/1828490.png";

const { database } = require("./database");

async function fetchWalltakerSettings() {
  try {
    const [rows] = await database.execute(
      "SELECT guild_id, feed_id, channel_id FROM walltaker_settings WHERE channel_id IS NOT NULL AND feed_id IS NOT NULL;"
    );
    return rows;
  } catch (error) {
    console.error("❌ Database Error - fetchWalltakerSettings:", error);
    return [];
  }
}

async function processGuildFeed(client, { guild_id, feed_id, channel_id }) {
  const guildIdStr = String(guild_id);
  const channelIdStr = String(channel_id);
  const feedIdStr = String(feed_id);

  try {
    const channel = await client.channels.fetch(channelIdStr).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      console.error(
        `❌ Channel ${channelIdStr} not found, inaccessible, or not text-based in guild ${guildIdStr}`
      );
      return;
    }

    const imageData = await fetchWalltakerImage(feedIdStr);
    if (!imageData || !imageData.imageUrl) {
      return;
    }

    const { imageUrl, sourceUrl, lastUpdatedBy } = imageData;
    const cleanImageUrl = imageUrl.trim();

    const lastPosted = await getLastPostedImage(guildIdStr);

    if (lastPosted === cleanImageUrl) {
      return;
    }

    console.log(
      `🚀 Found new image for guild ${guildIdStr}. Posting to #${channel.name}...`
    );

    const embed = new EmbedBuilder()
      .setTitle(`🖼️ Walltaker Feed Update!`)
      .setDescription(`Wallpaper for Feed ID \`${feedIdStr}\` changed.`)
      .setColor("#3498DB")
      .setTimestamp()
      .setImage(cleanImageUrl)
      .setFooter({
        text: `Updated by: ${lastUpdatedBy?.trim() || "Anonymous"}`,
        iconURL: DEFAULT_FOOTER_ICON,
      });

    const buttons = [
      new ButtonBuilder()
        .setLabel("🔗 Walltaker Source")
        .setStyle(ButtonStyle.Link)
        .setURL(sourceUrl || `https://walltaker.joi.how/links/${feedIdStr}`),
    ];

    try {
      const e621PostId = await getE621PostId(cleanImageUrl);
      if (e621PostId) {
        buttons.push(
          new ButtonBuilder()
            .setLabel("🔍 View on e621")
            .setStyle(ButtonStyle.Link)
            .setURL(`https://e621.net/posts/${e621PostId}`)
        );
      }
    } catch (e621Error) {
      console.warn(
        `[Walltaker] Failed to get e621 Post ID for ${cleanImageUrl}: ${e621Error.message}`
      );
    }

    await channel.send({
      embeds: [embed],
      components:
        buttons.length > 0
          ? [new ActionRowBuilder().addComponents(...buttons)]
          : [],
    });

    await saveLastPostedImage(guildIdStr, cleanImageUrl);

    console.log(
      `✅ Posted new image to guild ${guildIdStr} (#${channel.name})`
    );
  } catch (error) {
    if (error.code === 50013) {
      console.error(
        `❌ Walltaker Error: Missing Permissions to send message in channel ${channelIdStr} (Guild ${guildIdStr})`
      );
    } else if (error.code === 10003 || error.code === 50001) {
      console.error(
        `❌ Walltaker Error: Channel ${channelIdStr} is unknown or inaccessible (Guild ${guildIdStr})`
      );
    } else {
      console.error(
        `❌ Error processing Walltaker feed for guild ${guildIdStr} (Feed ${feedIdStr}):`,
        error.message || error
      );
    }
  }
}

async function checkAndPostFeeds(client) {
  if (!client || !client.isReady()) {
    console.warn("Walltaker Check: Client not ready.");
    return;
  }
  try {
    const settings = await fetchWalltakerSettings();

    if (!settings || settings.length === 0) {
      return;
    }

    console.log(
      `[Walltaker] Processing ${settings.length} configured feed(s)...`
    );
    for (const config of settings) {
      await processGuildFeed(client, config);
    }
  } catch (error) {
    console.error("❌ Walltaker feed check cycle failed:", error);
  }
}

let walltakerIntervalId = null;

async function initializeWalltaker(client) {
  if (walltakerIntervalId) {
    console.warn("[Walltaker] Initialization called but already running.");
    return;
  }
  console.log("🔄 Initializing Walltaker feed checker...");

  setTimeout(() => checkAndPostFeeds(client), 5000);

  walltakerIntervalId = setInterval(
    () => checkAndPostFeeds(client),
    CHECK_INTERVAL
  );
  console.log(
    `✅ Walltaker checker scheduled to run every ${
      CHECK_INTERVAL / 60000
    } minutes.`
  );

  client.on("invalidated", () => clearInterval(walltakerIntervalId));
  client.on("error", () => clearInterval(walltakerIntervalId));
}

module.exports = {
  initializeWalltaker,
};
