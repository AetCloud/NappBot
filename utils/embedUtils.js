// NappBot/utils/embedUtils.js
const { EmbedBuilder } = require("discord.js");

const DEFAULT_BOT_FOOTER_TEXT = "Powered by Napp";

function setDefaultFooter(embed, botUser) {
  if (!embed || typeof embed.setFooter !== "function") {
    console.error(
      "[EmbedUtils] Invalid embed object passed to setDefaultFooter."
    );
    return;
  }
  if (!botUser || typeof botUser.displayAvatarURL !== "function") {
    console.error(
      "[EmbedUtils] Invalid botUser object passed to setDefaultFooter."
    );
    embed.setFooter({ text: DEFAULT_BOT_FOOTER_TEXT });
    return;
  }
  embed.setFooter({
    text: DEFAULT_BOT_FOOTER_TEXT,
    iconURL: botUser.displayAvatarURL(),
  });
}

function setCustomFooter(embed, text, iconURL) {
  if (!embed || typeof embed.setFooter !== "function") {
    console.error(
      "[EmbedUtils] Invalid embed object passed to setCustomFooter."
    );
    return;
  }
  if (typeof text !== "string" || text.trim() === "") {
    console.error(
      "[EmbedUtils] Footer text must be a non-empty string for setCustomFooter."
    );
    return;
  }
  embed.setFooter({
    text: text,
    iconURL: iconURL,
  });
}

function createEmbedWithDefaults(botUser) {
  const embed = new EmbedBuilder();
  setDefaultFooter(embed, botUser);
  return embed;
}

module.exports = {
  setDefaultFooter,
  setCustomFooter,
  createEmbedWithDefaults,
  DEFAULT_BOT_FOOTER_TEXT,
};
