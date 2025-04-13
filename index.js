require("dotenv").config();
const {
  Client,
  Collection,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const fs = require("fs");
const path = require("path");
const { database } = require("./utils/database");
const { fetchWalltakerImage } = require("./utils/fetchWalltaker");
const { getE621PostId } = require("./utils/e621API");
const {
  getLastPostedImage,
  saveLastPostedImage,
} = require("./commands/utility/setwalltaker.js");
const { deployCommands } = require("./deploy-commands");
const { clearInterestTimers } = require("./utils/interest");

require("./server");

const { TOKEN, CLIENT_ID } = require("./config");

if (!TOKEN || !CLIENT_ID) {
  console.error("❌ Missing required environment variables!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const eventFiles = fs
  .readdirSync("./events")
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

async function fetchWalltakerSettings() {
  try {
    const [rows] = await database.execute("SELECT * FROM walltaker_settings;");
    return rows;
  } catch (error) {
    console.error("❌ MySQL Error (fetchWalltakerSettings):", error);
    return [];
  }
}

async function postWalltakerImages() {
  const settings = await fetchWalltakerSettings();

  for (const { guild_id, feed_id, channel_id } of settings) {
    try {
      const channel = await client.channels.fetch(channel_id);
      if (!channel) {
        console.error(`❌ Walltaker: Channel not found for guild ${guild_id}`);
        continue;
      }

      const imageData = await fetchWalltakerImage(feed_id);
      if (!imageData) {
        console.log(
          `⚠️ No image found in Walltaker feed for guild ${guild_id}`
        );
        continue;
      }

      const { imageUrl, sourceUrl, lastUpdatedBy } = imageData;
      const cleanImageUrl = imageUrl?.trim() || null;

      const lastPosted = await getLastPostedImage(guild_id);
      if (lastPosted === cleanImageUrl) {
        console.log(
          `✅ No new Walltaker image for guild ${guild_id}, skipping...`
        );
        continue;
      }

      console.log(
        `🆕 New Walltaker image detected for guild ${guild_id}, sending now!`
      );
      await saveLastPostedImage(guild_id, cleanImageUrl);

      const updatedByUser = lastUpdatedBy?.trim() || "anon";
      const e621PostId = await getE621PostId(cleanImageUrl);
      const e621PostUrl = e621PostId
        ? `https://e621.net/posts/${e621PostId}`
        : null;

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Walltaker Image for Feed ${feed_id}`)
        .setDescription(
          "🔄 **Automatic Detection** - A new image has been set!"
        )
        .setImage(cleanImageUrl)
        .setColor("#3498DB")
        .setFooter({
          text: `Image changed by: ${updatedByUser}`,
          iconURL: "https://cdn-icons-png.flaticon.com/512/1828/1828490.png",
        });

      const buttons = [
        new ButtonBuilder()
          .setLabel("🔗 View on Walltaker")
          .setStyle(ButtonStyle.Link)
          .setURL(sourceUrl),
      ];

      if (e621PostUrl) {
        buttons.push(
          new ButtonBuilder()
            .setLabel("🔍 View on e621")
            .setStyle(ButtonStyle.Link)
            .setURL(e621PostUrl)
        );
      }

      const row = new ActionRowBuilder().addComponents(...buttons);
      await channel.send({ embeds: [embed], components: [row] });
    } catch (error) {
      console.error(
        `❌ Error posting Walltaker image for guild ${guild_id}:`,
        error
      );
    }
  }
}

(async () => {
  try {
    await database.query("SELECT 1");
    console.log("✅ Connected to MySQL!");

    await deployCommands();
    console.log("✅ Command deployment completed successfully.");

    await client.login(TOKEN);
    console.log("✅ Bot logged in successfully!");
  } catch (error) {
    console.error("❌ Error during initialization:", error);
  }
})();

process.on("beforeExit", (code) => {
  console.log(`⚠️ Process is about to exit with code: ${code}`);
  clearInterestTimers(); // Clear the interest timers
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});
