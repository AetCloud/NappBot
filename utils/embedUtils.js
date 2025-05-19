const { EmbedBuilder } = require('discord.js');

const DEFAULT_BOT_FOOTER_TEXT = "Powered by Napp";

const COLORS = {
    SUCCESS: '#57F287',
    ERROR: '#ED4245',
    WARNING: '#FEE75C',
    INFO: '#5865F2',
    DEFAULT_BLUE: '#3498DB',
    DEFAULT_GOLD: '#F1C40F'
};

function setDefaultFooter(embed, botUser) {
    if (!embed || typeof embed.setFooter !== 'function') {
        console.error("[EmbedUtils] Invalid embed object passed to setDefaultFooter.");
        return;
    }
    if (!botUser || typeof botUser.displayAvatarURL !== 'function') {
        console.error("[EmbedUtils] Invalid botUser object passed to setDefaultFooter.");
        embed.setFooter({ text: DEFAULT_BOT_FOOTER_TEXT });
        return;
    }
    embed.setFooter({
        text: DEFAULT_BOT_FOOTER_TEXT,
        iconURL: botUser.displayAvatarURL()
    });
}

function setCustomFooter(embed, text, iconURL) {
    if (!embed || typeof embed.setFooter !== 'function') {
        console.error("[EmbedUtils] Invalid embed object passed to setCustomFooter.");
        return;
    }
    if (typeof text !== 'string' || text.trim() === '') {
        console.error("[EmbedUtils] Footer text must be a non-empty string for setCustomFooter.");
        return;
    }
    embed.setFooter({
        text: text,
        iconURL: iconURL
    });
}

function createEmbedWithDefaults(botUser, color = COLORS.DEFAULT_BLUE) {
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTimestamp();
    setDefaultFooter(embed, botUser);
    return embed;
}

function createErrorEmbed(errorMessage, botUser) {
    const embed = new EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription(errorMessage)
        .setColor(COLORS.ERROR)
        .setTimestamp();
    setDefaultFooter(embed, botUser);
    return embed;
}

function createSuccessEmbed(successMessage, botUser) {
    const embed = new EmbedBuilder()
        .setTitle("✅ Success")
        .setDescription(successMessage)
        .setColor(COLORS.SUCCESS)
        .setTimestamp();
    setDefaultFooter(embed, botUser);
    return embed;
}

module.exports = {
    setDefaultFooter,
    setCustomFooter,
    createEmbedWithDefaults,
    createErrorEmbed,
    createSuccessEmbed,
    COLORS,
    DEFAULT_BOT_FOOTER_TEXT
};