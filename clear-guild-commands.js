// clear-guild-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');

// --- Configuration ---
const GUILD_ID = '1146990138656825415'; // The specific guild ID you provided
// ---------------------

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;

if (!token) {
    console.error('❌ Missing TOKEN environment variable.');
    process.exit(1);
}
if (!clientId) {
    console.error('❌ Missing CLIENT_ID environment variable.');
    process.exit(1);
}
if (!GUILD_ID) {
    console.error('❌ GUILD_ID is not set in the script.');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`♻️  Attempting to clear commands for GUILD ID: ${GUILD_ID}...`);

        // Send an empty array to the guild-specific command endpoint
        await rest.put(
            Routes.applicationGuildCommands(clientId, GUILD_ID),
            { body: [] },
        );

        console.log(`✅ Successfully cleared commands for GUILD ID: ${GUILD_ID}.`);
        console.log("ℹ️ It might take a few minutes for changes to reflect in Discord.");

    } catch (error) {
        console.error('❌ Failed to clear guild commands:');
        console.error(error);
    }
})();