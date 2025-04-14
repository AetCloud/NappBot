const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} = require("discord.js");
const { getMewbotConfig } = require("../utils/database"); // Adjust path if needed
const fs = require("fs");
const path = require("path");

// --- Constants and Data Loading ---
const COOLDOWN_SECONDS = 5; // 5 seconds cooldown
const guessCooldowns = new Collection();
const pokemonDataMap = new Map(); // Store parsed data: { pokedexId: name }

const FORM_SUFFIX_MAP = {
  // 0: Standard (no suffix needed)
  1: "-alola",
  2: "-galar",
  3: "-hisui",
  4: "-paldea",
  // Add more mappings if Mewbot uses other numbers/suffixes
};

// --- Parse pokemonlist.txt ---
try {
  const filePath = path.join(__dirname, "..", "utils", "pokemonlist.txt"); // Adjust path if needed
  const fileContent = fs.readFileSync(filePath, "utf8");
  const lines = fileContent.split(/\r?\n/); // Split by newline, handle Windows/Unix endings

  console.log(
    `[Pokemon Parser] Reading ${lines.length} lines from pokemonlist.txt`
  );

  let parsedCount = 0;
  for (const line of lines) {
    if (!line.trim() || line.toLowerCase().startsWith("number")) {
      // console.log(`[Pokemon Parser] Skipping line: ${line}`); // Skip header or empty lines
      continue; // Skip header or empty lines
    }

    // Split by tab or multiple spaces
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const numberStr = parts[0];
      const name = parts.slice(1).join(" "); // Rejoin name parts if name has spaces (shouldn't based on file)

      // Clean the number string (remove leading zeros)
      const pokedexId = parseInt(numberStr, 10);

      // Clean the name (remove symbols like ♀ ♂, convert to lowercase)
      const cleanedName = name.replace(/[♀♂]/g, "").toLowerCase().trim();

      if (!isNaN(pokedexId) && cleanedName) {
        pokemonDataMap.set(pokedexId, cleanedName);
        parsedCount++;
        // console.log(`[Pokemon Parser] Parsed: ID=${pokedexId}, Name='${cleanedName}'`); // Debug log
      } else {
        console.warn(
          `[Pokemon Parser] Failed to parse line: ${line} -> ID=${pokedexId}, Name='${cleanedName}'`
        );
      }
    } else {
      console.warn(`[Pokemon Parser] Skipping malformed line: ${line}`);
    }
  }
  console.log(
    `[Pokemon Parser] Successfully parsed ${parsedCount} Pokémon into map.`
  );
} catch (err) {
  console.error(
    "❌ CRITICAL: Failed to load or parse utils/pokemonlist.txt:",
    err
  );
  // Bot might still run, but Mewbot helper will fail. Consider exiting if this is critical.
  // process.exit(1);
}
// -----------------------------

// --- Helper Function to Parse Embed ---
function parseMewbotEmbed(embed) {
  // ... (Keep the parseMewbotEmbed function from the previous example - no changes needed here) ...
  let hint = null;
  let imageUrl = null;

  if (embed?.image?.url) {
    imageUrl = embed.image.url;
  } else {
    return null; // No image, definitely not a catch embed
  }

  // Look for hint in description
  if (embed.description) {
    const hintMatch = embed.description.match(
      /(?:The Pok.mon's name begins with|Pok.mon name:|This Pok.mon.s name begins with)\s*\n?([A-Za-z\s_]+)/i
    );
    if (hintMatch && hintMatch[1]) {
      const potentialHint = hintMatch[1].trim();
      if (/[a-zA-Z]/i.test(potentialHint) && /_/.test(potentialHint)) {
        hint = potentialHint;
      }
    }
  }

  // Fallback: Check fields
  if (!hint && embed.fields?.length > 0) {
    for (const field of embed.fields) {
      if (!field.name || !field.value) continue;
      const potentialHint = field.name + " " + field.value;
      const hintMatch = potentialHint.match(
        /([A-Z][a-z]?\s*_[\s_A-Za-z]*|[A-Z][a-z]?\s+[A-Z][a-z]?\s*_[\s_A-Za-z]*)/i
      );
      if (
        hintMatch &&
        hintMatch[0] &&
        /[a-zA-Z]/i.test(hintMatch[0]) &&
        /_/.test(hintMatch[0])
      ) {
        hint = hintMatch[0].trim();
        break;
      }
    }
  }

  if (hint && imageUrl) {
    return { hint, imageUrl };
  }
  return null;
}

module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    // --- Basic Checks & Config Fetch ---
    if (message.author.id === client.user.id || !message.guild) return;
    if (pokemonDataMap.size === 0) return; // Don't run if Pokemon data failed to load

    const guildId = message.guild.id;
    let config;
    try {
      config = await getMewbotConfig(guildId);
    } catch (dbError) {
      console.error(
        `[Mewbot Helper] Database error fetching config for guild ${guildId}:`,
        dbError
      );
      return;
    }

    // --- Author Check & Feature Status ---
    // Only proceed if feature is enabled AND message is from the configured Mewbot ID
    if (
      !config ||
      !config.enabled ||
      !config.mewbot_user_id ||
      message.author.id !== config.mewbot_user_id
    ) {
      return; // Exit if not enabled, not configured, or not the right bot
    }

    // --- Watch Channel Check ---
    if (
      config.watch_mode === "specific" &&
      (!config.watch_channel_id ||
        message.channel.id !== config.watch_channel_id)
    ) {
      return; // Not in the specific channel
    }

    // --- Embed Check ---
    if (!message.embeds || message.embeds.length === 0) return;
    const mewbotInfo = parseMewbotEmbed(message.embeds[0]);
    if (!mewbotInfo) return; // Embed doesn't match

    // --- Process Hint and Image URL ---
    const { hint, imageUrl } = mewbotInfo;

    // Parse Pokémon ID and Form ID from URL
    let parsedId = null;
    let parsedFormId = null;
    const urlMatch = imageUrl.match(/\/(\d+)-(\d+).*\.png/);
    if (urlMatch) {
      try {
        parsedId = parseInt(urlMatch[1], 10);
        parsedFormId = parseInt(urlMatch[2], 10);
      } catch (e) {
        console.error("[Mewbot Helper] Error parsing ID/Form:", e);
      }
    } else {
      console.warn(
        `[Mewbot Helper] Could not parse ID/Form from URL: ${imageUrl}`
      );
      return; // Cannot proceed without ID/Form
    }

    // --- Get Base Name and Construct Form Name ---
    const baseName = pokemonDataMap.get(parsedId);
    if (!baseName) {
      console.warn(
        `[Mewbot Helper] No base name found for Pokedex ID: ${parsedId}`
      );
      return; // Cannot proceed without base name
    }

    const formSuffix = FORM_SUFFIX_MAP[parsedFormId] || ""; // Get suffix or empty string if form 0 or unknown
    const expectedName = (baseName + formSuffix).toLowerCase(); // e.g., "rattata-alola"

    // --- Process Hint for Regex Matching ---
    const processedHint = hint.replace(/\s+/g, ""); // Remove all spaces -> "Hi________"
    const hintLength = processedHint.length;
    if (hintLength === 0 || expectedName.length !== hintLength) {
      // console.log(`[Mewbot Helper] Length mismatch: Hint='${processedHint}'(${hintLength}), Expected='${expectedName}'(${expectedName.length})`);
      return; // Hint length must match expected name length
    }

    // Create Regex from hint
    const hintRegexPattern =
      "^" +
      processedHint
        .split("")
        .map((char) => {
          if (char === "_") return ".";
          return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // Escape special chars
        })
        .join("") +
      "$";

    let hintRegex;
    try {
      hintRegex = new RegExp(hintRegexPattern, "i");
    } catch (e) {
      console.error(
        "[Mewbot Helper] Invalid regex from hint:",
        hintRegexPattern,
        e
      );
      return;
    }

    // --- Match Constructed Name with Hint Regex ---
    let isMatch = hintRegex.test(expectedName);

    // --- Prepare and Send Response ---
    if (isMatch) {
      const suggestionEmbed = new EmbedBuilder()
        .setColor("#77DD77") // Greenish color for success
        .setTitle("💡 Pokémon Guess!")
        .setDescription(`Hint: \`${hint}\`\nExpected Name: **${expectedName}**`)
        .setFooter({ text: `Helper by ${client.user.username}` })
        .addFields({
          name: "Parsed Info",
          value: `ID: \`${parsedId}\`, Form: \`${parsedFormId}\`, Base: \`${baseName}\``,
          inline: true,
        });

      // Determine output channel
      let outputChannel = message.channel;
      let fetchedOutputChannel = false;
      if (
        config.output_channel_id &&
        config.output_channel_id !== message.channel.id
      ) {
        try {
          const fetchedChannel = await client.channels.fetch(
            config.output_channel_id
          );
          if (fetchedChannel?.isTextBased()) {
            outputChannel = fetchedChannel;
            fetchedOutputChannel = true;
          } else {
            console.warn(
              `[Mewbot Helper] Configured output channel ${config.output_channel_id} invalid. Defaulting.`
            );
          }
        } catch (err) {
          console.warn(
            `[Mewbot Helper] Error fetching output channel ${config.output_channel_id}: ${err.message}. Defaulting.`
          );
        }
      }

      // Prepare Action Row with Button if needed
      const row = new ActionRowBuilder();
      if (fetchedOutputChannel) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel("View Original Message")
            .setStyle(ButtonStyle.Link)
            .setURL(message.url)
        );
      }

      // Send the response
      try {
        await outputChannel.send({
          embeds: [suggestionEmbed],
          components: row.components.length > 0 ? [row] : [],
        });
      } catch (err) {
        console.error(
          `[Mewbot Helper] Failed to send suggestion to channel ${
            outputChannel.id
          }: ${err.permission || err.message}`
        );
        if (outputChannel.id !== message.channel.id) {
          try {
            if (
              message.channel.permissionsFor(client.user).has("SendMessages")
            ) {
              await message.channel.send(
                `⚠️ Couldn't send Pokémon suggestion to ${outputChannel}. Check permissions?`
              );
            }
          } catch {} // Ignore fallback error
        }
      }
    } else {
      console.log(`[Mewbot Helper] No match: Expected Name '${expectedName}' did not match hint pattern '${hintRegexPattern}'`);
    }
  },
};
