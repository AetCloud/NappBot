const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
} = require("discord.js");
const { getMewbotConfig } = require("../utils/database"); // Adjust path if needed
let pokemonDataMap = new Map(); // Store parsed data: { pokedexId: name }

// --- Constants ---
const COOLDOWN_SECONDS = 5; // 5 seconds cooldown
const guessCooldowns = new Collection();

const FORM_SUFFIX_MAP = {
  // 0: Standard (no suffix needed)
  1: "-alola",
  2: "-galar",
  3: "-hisui",
  4: "-paldea",
  // Add more mappings if Mewbot uses other numbers/suffixes
};

// --- Load pokemonData.json ---
try {
  // Use require to load the JSON file directly
  const pokemonList = require("../utils/pokemonData.json"); // Adjust path if needed

  if (!Array.isArray(pokemonList)) {
    throw new Error("pokemonData.json is not a valid JSON array.");
  }

  console.log(
    `[Pokemon Loader] Reading ${pokemonList.length} entries from pokemonData.json`
  );
  let loadedCount = 0;
  for (const pokemon of pokemonList) {
    // Only store the base form (form_id 0) in the map for base name lookup
    if (
      pokemon &&
      typeof pokemon.id === "number" &&
      typeof pokemon.form_id === "number" &&
      pokemon.form_id === 0 &&
      typeof pokemon.mewbot_name === "string"
    ) {
      // Use the ID from the JSON as the key and the name as the value
      pokemonDataMap.set(pokemon.id, pokemon.mewbot_name.toLowerCase());
      loadedCount++;
    } else if (pokemon?.form_id !== 0) {
      // Ignore non-base forms during map creation, they are handled dynamically later
    } else {
      console.warn(
        `[Pokemon Loader] Skipping invalid entry in pokemonData.json:`,
        pokemon
      );
    }
  }
  console.log(
    `[Pokemon Loader] Successfully loaded ${loadedCount} base Pokémon names into map.`
  );

  if (pokemonDataMap.size === 0) {
    console.error(
      "❌ CRITICAL: Pokemon map is empty after loading JSON. Ensure pokemonData.json is valid and contains base forms."
    );
  }
} catch (err) {
  console.error(
    "❌ CRITICAL: Failed to load or parse utils/pokemonData.json:",
    err
  );
  // Bot might still run, but Mewbot helper will likely fail.
}
// -----------------------------

// --- Helper Function to Parse Embed ---
function parseMewbotEmbed(embed) {
  // ... (Keep the same parseMewbotEmbed function as before) ...
  let hint = null;
  let imageUrl = null;

  if (embed?.image?.url) {
    imageUrl = embed.image.url;
  } else {
    return null;
  }

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
    if (pokemonDataMap.size === 0) {
      // console.warn("[Mewbot Helper] Pokemon data map is empty, skipping execution.");
      return; // Don't run if Pokemon data failed to load
    }

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
        return;
      } // Exit if parsing fails
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
        `[Mewbot Helper] No base name found for Pokedex ID: ${parsedId} in pokemonDataMap.`
      );
      return; // Cannot proceed without base name
    }

    const formSuffix = FORM_SUFFIX_MAP[parsedFormId] || "";
    const expectedName = (baseName + formSuffix).toLowerCase();

    // --- Process Hint for Regex Matching ---
    const processedHint = hint.replace(/\s+/g, "");
    const hintLength = processedHint.length;
    if (hintLength === 0 || expectedName.length !== hintLength) {
      return; // Length mismatch
    }

    const hintRegexPattern =
      "^" +
      processedHint
        .split("")
        .map((char) => {
          if (char === "_") return ".";
          return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
      // Cooldown check before sending success message
      const cooldownKey = `${message.channel.id}-${parsedId}-${parsedFormId}`; // Cooldown per channel per specific pokemon spawn
      const now = Date.now();
      if (guessCooldowns.has(cooldownKey)) {
        const expirationTime = guessCooldowns.get(cooldownKey);
        if (now < expirationTime) {
          // console.log(`[Mewbot Helper] Guess for ${expectedName} in ${message.channel.id} is on cooldown.`);
          return; // Don't send if already guessed recently in this channel
        }
      }
      // Set cooldown *after* confirming a match will be sent
      guessCooldowns.set(cooldownKey, now + COOLDOWN_SECONDS * 1000);
      setTimeout(
        () => guessCooldowns.delete(cooldownKey),
        COOLDOWN_SECONDS * 1000
      );

      const suggestionEmbed = new EmbedBuilder()
        .setColor("#77DD77")
        .setTitle("💡 Pokémon Guess!")
        .setDescription(`Hint: \`${hint}\`\nMatch: **${expectedName}**`)
        .setFooter({ text: `Helper by ${client.user.username}` })
        .addFields({
          name: "Parsed Info",
          value: `ID: \`${parsedId}\`, Form: \`${parsedFormId}\``,
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
          } catch {}
        }
      }
    }
    // No 'else' needed - if it's not a match, we just don't send anything.
  },
};
