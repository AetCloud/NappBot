const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require("discord.js");
const {
  setVerificationConfig, getVerificationConfig, disableVerification,
  setMewbotWatchConfig, setMewbotOutputChannel, getMewbotConfig, disableMewbotHelper,
  setWalltakerSettings,
  setCommandCategorySettings, getCommandCategorySettings, getAllCommandCategorySettings,
} = require("../../utils/database");
const path = require('path');
const { setDefaultFooter, setCustomFooter, DEFAULT_BOT_FOOTER_TEXT } = require("../../utils/embedUtils");

function getCommandCategories(client) {
  const categories = new Set();
  if (client && client.commands && client.commands instanceof Map) {
    client.commands.forEach(cmd => {
      if (cmd.filePath) {
        const category = path.dirname(cmd.filePath).split(path.sep).pop();
        if (category && category !== 'commands') {
          categories.add(category.toLowerCase());
        }
      }
    });
  }

  const nonNsfwCats = ['fun', 'games', 'general', 'utility'];
  const nsfwCats = ['nsfw'];

  const allCatsSet = new Set(categories);
  if (allCatsSet.size === 0) {
    console.warn("getCommandCategories: Could not find categories dynamically, using hardcoded defaults.");
    nonNsfwCats.forEach(cat => allCatsSet.add(cat));
    nsfwCats.forEach(cat => allCatsSet.add(cat));
  }

  const allCats = Array.from(allCatsSet);

  return {
    all: allCats.map(cat => ({ name: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat })).slice(0, 25),
    nonNsfw: allCats.filter(cat => nonNsfwCats.includes(cat)).map(cat => ({ name: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat })),
    nsfw: allCats.filter(cat => nsfwCats.includes(cat)).map(cat => ({ name: cat.charAt(0).toUpperCase() + cat.slice(1), value: cat }))
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serversettings")
    .setDescription("⚙️ Manage server-specific settings for NappBot features.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false)

    .addSubcommandGroup(group => group
      .setName('verification')
      .setDescription('Manage the Age Verification system.')
      .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('Set up verification channel, role, and custom questions.')
        .addChannelOption(opt => opt.setName('moderator_channel').setDescription('Channel for verification requests.').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName('verified_role').setDescription('Role to assign upon approval.').setRequired(true))
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable/disable the system (default: true)').setRequired(false))
        .addStringOption(opt => opt.setName('question_1').setDescription('Custom question #1 (leave blank to disable).').setRequired(false).setMaxLength(200))
        .addStringOption(opt => opt.setName('question_2').setDescription('Custom question #2 (leave blank to disable).').setRequired(false).setMaxLength(200))
        .addStringOption(opt => opt.setName('question_3').setDescription('Custom question #3 (leave blank to disable).').setRequired(false).setMaxLength(200))
        .addStringOption(opt => opt.setName('question_4').setDescription('Custom question #4 (leave blank to disable).').setRequired(false).setMaxLength(200))
      )
      .addSubcommand(sub => sub
        .setName('disable')
        .setDescription('Disable the verification system.')
      )
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('View the current verification settings.')
      )
    )

    .addSubcommandGroup(group => group
      .setName('mewbot')
      .setDescription('Manage the Mewbot Helper feature.')
      .addSubcommand(sub => sub
        .setName('setup')
        .setDescription("🔧 Set up or update Mewbot helper channels and mode.")
        .addStringOption(option =>
          option.setName('watch_mode')
            .setDescription('Where to look for Mewbot messages.')
            .setRequired(true)
            .addChoices(
              { name: 'Specific Channel', value: 'specific' },
              { name: 'All Channels', value: 'all' }
            ))
        .addChannelOption(option =>
          option.setName('watch_channel')
            .setDescription("The specific channel to watch (if watch_mode is 'specific').")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addChannelOption(option =>
          option.setName('output_channel')
            .setDescription("Where to send the guess messages (optional, defaults to Mewbot's channel).")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
      )
      .addSubcommand(sub => sub
        .setName('disable')
        .setDescription('❌ Disable the Mewbot helper feature for this server.')
      )
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('⚙️ View the current Mewbot helper settings.')
      )
    )

    .addSubcommandGroup(group => group
      .setName('walltaker')
      .setDescription('Manage the Walltaker auto-posting feature.')
      .addSubcommand(sub => sub
        .setName('setup')
        .setDescription('📌 Set the Walltaker feed ID and channel for auto-posting.')
        .addStringOption(option => option.setName('feed_id').setDescription('The Walltaker Feed ID (e.g., joi.how/links/YOUR_ID).').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('Select the text channel to post images in.').addChannelTypes(ChannelType.GuildText).setRequired(true))
      )
    )

    .addSubcommandGroup(group => group
      .setName('commands')
      .setDescription('Control command category access and view settings.')
      .addSubcommand(sub => sub
        .setName('toggle')
        .setDescription('Enable or disable a command category for this server.')
        .addStringOption(opt => opt.setName('category').setDescription('The command category to toggle.').setRequired(true).setAutocomplete(true))
        .addBooleanOption(opt => opt.setName('enabled').setDescription('Set to true to enable, false to disable.').setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('set_role')
        .setDescription('Set or remove a required role for a command category.')
        .addStringOption(opt => opt.setName('category').setDescription('The command category to modify.').setRequired(true).setAutocomplete(true))
        .addRoleOption(opt => opt.setName('role').setDescription('The role required (leave blank to remove requirement).').setRequired(false))
      )
      .addSubcommand(sub => sub
        .setName('view')
        .setDescription('View all configured server settings (Paginated).')
      )
    ),

  async autocomplete(interaction, client) {
    const focusedOption = interaction.options.getFocused(true);
    let choices = [];

    if (focusedOption.name === 'category') {
      const currentClient = client || interaction.client;
      const categoriesInfo = getCommandCategories(currentClient);
      choices = categoriesInfo.all;
    }

    const filtered = choices.filter(choice =>
      choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase()) ||
      choice.value.toLowerCase().startsWith(focusedOption.value.toLowerCase())
    ).slice(0, 25);

    try {
      await interaction.respond(filtered);
    } catch (error) {
      if (error.code !== 10062) {
        console.error("Autocomplete error:", error);
      }
    }
  },

  async execute(interaction, client) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const guild = interaction.guild;
    const clientUser = interaction.client.user;

    try {
      if (group === 'verification' && subcommand === 'view') {
        const config = await getVerificationConfig(guildId);
        const embed = new EmbedBuilder().setTitle('⚙️ Verification Settings').setColor(config?.enabled ? 'Green' : 'Red');
        if (config) {
          const modChannel = config.moderator_channel_id ? await guild.channels.fetch(config.moderator_channel_id).catch(() => null) : null;
          const verRole = config.verified_role_id ? await guild.roles.fetch(config.verified_role_id).catch(() => null) : null;
          embed.setDescription(`Verification system is **${config.enabled ? 'enabled' : 'disabled'}**.`)
            .addFields(
              { name: 'Moderator Channel', value: modChannel ? `${modChannel}` : '`Not Set/Deleted`', inline: true },
              { name: 'Verified Role', value: verRole ? `${verRole}` : '`Not Set/Deleted`', inline: true }
            );
          embed.addFields({ name: '\u200B', value: '**Custom Questions**' });
          const questions = [config.question1, config.question2, config.question3, config.question4];
          let qAdded = 0;
          questions.forEach((q, i) => {
            if (q) {
              embed.addFields({ name: `Question ${i + 1}`, value: q.slice(0, 1000), inline: false });
              qAdded++;
            }
          });
          if (qAdded === 0) embed.addFields({ name: 'Questions Status', value: 'No custom questions configured.' });

        } else {
          embed.setDescription('Verification system is **not configured** for this server.');
        }
        setDefaultFooter(embed, clientUser);
        return interaction.editReply({ embeds: [embed] });

      } else if (group === 'mewbot' && subcommand === 'view') {
        const config = await getMewbotConfig(guildId);
        const embed = new EmbedBuilder().setTitle('⚙️ Mewbot Helper Settings').setColor(config?.enabled ? '#57F287' : '#ED4245');
        if (!config || !config.enabled) {
          embed.setDescription("ℹ️ Mewbot helper is currently **disabled** or not configured.");
        } else {
          embed.setDescription("ℹ️ Mewbot helper is currently **enabled**.");
          let watchChannelName = "`Error`";
          if (config.watch_mode === 'specific' && config.watch_channel_id) {
            const channel = await guild.channels.fetch(config.watch_channel_id).catch(() => null);
            watchChannelName = channel ? `${channel}` : "`Invalid/Deleted`";
          } else if (config.watch_mode === 'all') {
            watchChannelName = "`All Accessible Channels`";
          } else {
            watchChannelName = "`Not Properly Set`";
          }

          let outputChannelName = "`Same as Mewbot's`";
          if (config.output_channel_id) {
            const channel = await guild.channels.fetch(config.output_channel_id).catch(() => null);
            outputChannelName = channel ? `${channel}` : "`Invalid/Deleted`";
          }
          embed.addFields(
            { name: 'Mewbot User ID', value: `\`${config.mewbot_user_id || 'Not Set'}\``, inline: true },
            { name: 'Watch Mode', value: `\`${config.watch_mode}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: 'Watch Channel', value: watchChannelName, inline: false },
            { name: 'Output Channel', value: outputChannelName, inline: false }
          );
        }
        setDefaultFooter(embed, clientUser);
        return interaction.editReply({ embeds: [embed] });
      }

      else if (group === 'verification') {
        if (subcommand === 'setup') {
          const modChannel = interaction.options.getChannel("moderator_channel");
          const verifiedRole = interaction.options.getRole("verified_role");
          const enabled = interaction.options.getBoolean('enabled') ?? true;
          const q1 = interaction.options.getString('question_1');
          const q2 = interaction.options.getString('question_2');
          const q3 = interaction.options.getString('question_3');
          const q4 = interaction.options.getString('question_4');

          const botMember = await guild.members.fetch(client.user.id);
          const permissions = modChannel.permissionsFor(botMember);
          if (!permissions.has(PermissionFlagsBits.SendMessages) || !permissions.has(PermissionFlagsBits.EmbedLinks)) {
            return interaction.editReply({ content: `❌ I need 'Send Messages' and 'Embed Links' permissions in ${modChannel}.` });
          }
          if (verifiedRole.position >= botMember.roles.highest.position) {
            return interaction.editReply({ content: `❌ The role ${verifiedRole} is higher than or equal to my highest role.` });
          }

          const success = await setVerificationConfig(guildId, modChannel.id, verifiedRole.id, enabled, q1, q2, q3, q4);
          let replyMessage = success ? `✅ Verification system ${enabled ? 'enabled' : 'disabled'} and configured!` : '❌ Failed to save config.';
          if (success) {
            replyMessage += `\n**Mod Channel:** ${modChannel}\n**Role:** ${verifiedRole}`;
            const questions = [q1, q2, q3, q4];
            questions.forEach((q, i) => {
              if (q) replyMessage += `\n**Q${i + 1}:** ${q.slice(0, 100)}${q.length > 100 ? '...' : ''}`;
            });
            if (!q1 && !q2 && !q3 && !q4) replyMessage += "\n*(No custom questions set)*";
          }
          await interaction.editReply(replyMessage);
          return;
        } else if (subcommand === 'disable') {
          const success = await disableVerification(guildId);
          await interaction.editReply(success ? '✅ Verification system disabled.' : '❌ Failed to disable system (maybe already disabled?).');
          return;
        }
      } else if (group === 'mewbot') {
        if (subcommand === 'setup') {
          const watchMode = interaction.options.getString("watch_mode");
          const watchChannel = interaction.options.getChannel("watch_channel");
          const outputChannel = interaction.options.getChannel("output_channel");
          const mewbotUserId = "519850436899897346";

          if (watchMode === 'specific' && !watchChannel) return interaction.editReply("❌ Must select 'watch_channel' for 'specific' mode.");

          const watchSuccess = await setMewbotWatchConfig(guildId, watchMode, watchChannel?.id, mewbotUserId);
          const outputSuccess = await setMewbotOutputChannel(guildId, outputChannel?.id);

          await interaction.editReply(watchSuccess && outputSuccess ? `✅ Mewbot helper configured!` : '❌ Failed to save Mewbot settings.');
          return;
        } else if (subcommand === 'disable') {
          const success = await disableMewbotHelper(guildId);
          await interaction.editReply(success ? "✅ Mewbot helper disabled." : "❌ Failed to disable Mewbot helper (maybe already disabled?).");
          return;
        }
      } else if (group === 'walltaker') {
        if (subcommand === 'setup') {
          const feedId = interaction.options.getString("feed_id");
          const channel = interaction.options.getChannel("channel");
          const success = await setWalltakerSettings(guildId, feedId, channel.id);
          await interaction.editReply(success ? `✅ Walltaker settings updated! Feed ID: \`${feedId}\`, Channel: ${channel}` : '❌ Failed to save Walltaker settings.');
          return;
        }
      } else if (group === 'commands' && (subcommand === 'toggle' || subcommand === 'set_role')) {
        const category = interaction.options.getString('category')?.toLowerCase();
        const validCategoriesInfo = getCommandCategories(client);
        if (!category || !validCategoriesInfo.all.some(c => c.value === category)) {
          return interaction.editReply(`❌ Invalid category specified. Use autocomplete or check available categories.`);
        }

        if (subcommand === 'toggle') {
          const enabled = interaction.options.getBoolean('enabled');
          const currentSettings = await getCommandCategorySettings(guildId, category);
          const success = await setCommandCategorySettings(guildId, category, enabled, currentSettings.required_role_id);
          await interaction.editReply(success ? `✅ Command category \`${category}\` has been **${enabled ? 'enabled' : 'disabled'}**.` : '❌ Failed to update setting.');
          return;
        } else if (subcommand === 'set_role') {
          const role = interaction.options.getRole('role');
          if (role) {
            const botMember = await guild.members.fetch(client.user.id);
            if (role.position >= botMember.roles.highest.position) {
              return interaction.editReply({ content: `❌ I cannot manage the role ${role} as it's higher than or equal to my highest role.` });
            }
          }
          const currentSettings = await getCommandCategorySettings(guildId, category);
          const success = await setCommandCategorySettings(guildId, category, currentSettings.enabled, role?.id);
          await interaction.editReply(success ? `✅ Role requirement for category \`${category}\` set to ${role ? role : '`None`'}.` : '❌ Failed to update setting.');
          return;
        }
      }

      else if (group === 'commands' && subcommand === 'view') {
        const verificationConfig = await getVerificationConfig(guildId);
        const mewbotConfig = await getMewbotConfig(guildId);
        const allCommandSettings = await getAllCommandCategorySettings(guildId);
        const categoriesInfo = getCommandCategories(client);

        let currentPage = 'non_nsfw';

        const generateNonNsfwEmbed = async () => {
          const embed = new EmbedBuilder()
            .setTitle('⚙️ Server Settings (Page 1/2: General & Utility)')
            .setColor('Blue')
            .setDescription('Settings for non-NSFW features and command categories.')
            .setTimestamp();

          let verDesc = '`Not Configured`';
          if (verificationConfig) {
            const modCh = verificationConfig.moderator_channel_id ? await guild.channels.fetch(verificationConfig.moderator_channel_id).catch(() => null) : null;
            const verRole = verificationConfig.verified_role_id ? await guild.roles.fetch(verificationConfig.verified_role_id).catch(() => null) : null;
            verDesc = `**${verificationConfig.enabled ? '✅ Enabled' : '❌ Disabled'}** (${modCh || '`Invalid Ch.`'} -> ${verRole || '`Invalid Role`'})`;
          }
          embed.addFields({ name: '🛡️ Age Verification', value: verDesc, inline: false });

          let mewbotDesc = mewbotConfig ? `**${mewbotConfig.enabled ? '✅ Enabled' : '❌ Disabled'}** (Mode: ${mewbotConfig.watch_mode || 'N/A'})` : '`Not Configured`';
          embed.addFields({ name: '🤖 Mewbot Helper', value: mewbotDesc, inline: false });


          embed.addFields({ name: '\u200B', value: '**Command Category Controls (Non-NSFW)**' });
          if (categoriesInfo.nonNsfw.length > 0) {
            const fields = await Promise.all(categoriesInfo.nonNsfw.map(async catInfo => {
              const setting = allCommandSettings[catInfo.value] || { enabled: true, required_role_id: null };
              const status = setting.enabled ? '✅ Enabled' : '❌ Disabled';
              let roleReq = '';
              if (setting.required_role_id) {
                const role = await guild.roles.fetch(setting.required_role_id).catch(() => null);
                roleReq = role ? ` | Role: ${role}` : ' | Role: `Invalid`';
              }
              return { name: `🔧 ${catInfo.name}`, value: `${status}${roleReq}`, inline: true };
            }));
            for (let i = 0; i < fields.length; i += 3) {
              embed.addFields(fields.slice(i, i + 3));
              if (i + 3 < fields.length) {
              }
            }

          } else {
            embed.addFields({ name: 'Status', value: 'No non-NSFW command categories found.' });
          }
          setDefaultFooter(embed, clientUser);
          return embed;
        };

        const generateNsfwEmbed = async () => {
          const embed = new EmbedBuilder()
            .setTitle('⚙️ Server Settings (Page 2/2: NSFW)')
            .setColor('Red')
            .setDescription('Settings specifically for NSFW command categories.')
            .setTimestamp();

          embed.addFields({ name: '\u200B', value: '**Command Category Controls (NSFW)**' });
          if (categoriesInfo.nsfw.length > 0) {
            const fields = await Promise.all(categoriesInfo.nsfw.map(async catInfo => {
              const setting = allCommandSettings[catInfo.value] || { enabled: true, required_role_id: null };
              const status = setting.enabled ? '✅ Enabled' : '❌ Disabled';
              let roleReq = '';
              if (setting.required_role_id) {
                const role = await guild.roles.fetch(setting.required_role_id).catch(() => null);
                roleReq = role ? ` | Role: ${role}` : ' | Role: `Invalid`';
              }
              return { name: `🔞 ${catInfo.name}`, value: `${status}${roleReq}`, inline: true };
            }));
            for (let i = 0; i < fields.length; i += 3) {
              embed.addFields(fields.slice(i, i + 3));
            }
          } else {
            embed.addFields({ name: 'Status', value: 'No NSFW command categories found.' });
          }
          setDefaultFooter(embed, clientUser);
          return embed;
        };

        const generateButtons = (activePage) => {
          return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('settings_page_non_nsfw')
              .setLabel('View General/Utility')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(activePage === 'non_nsfw'),
            new ButtonBuilder()
              .setCustomId('settings_page_nsfw')
              .setLabel('View NSFW')
              .setStyle(ButtonStyle.Danger)
              .setDisabled(activePage === 'nsfw')
          );
        };

        const initialEmbed = await generateNonNsfwEmbed();
        const initialButtons = generateButtons('non_nsfw');
        const message = await interaction.editReply({ embeds: [initialEmbed], components: [initialButtons] });

        const collector = message.createMessageComponentCollector({
          componentType: ComponentType.Button,
          filter: (i) => i.user.id === interaction.user.id,
          idle: 120000
        });

        collector.on('collect', async i => {
          try {
            if (!i.isButton() || !i.isRepliable()) return;
            await i.deferUpdate();

            let embedToEdit;
            if (i.customId === 'settings_page_non_nsfw') {
              currentPage = 'non_nsfw';
              embedToEdit = await generateNonNsfwEmbed();
            } else if (i.customId === 'settings_page_nsfw') {
              currentPage = 'nsfw';
              embedToEdit = await generateNsfwEmbed();
            } else {
              return;
            }

            await interaction.editReply({ embeds: [embedToEdit], components: [generateButtons(currentPage)] });

          } catch (error) {
            console.error("Error updating settings view:", error);
          }
        });

        collector.on('end', async (collected, reason) => {
          try {
            const finalEmbed = (currentPage === 'non_nsfw') ? await generateNonNsfwEmbed() : await generateNsfwEmbed();
            const footerText = `Settings view timed out. Last view: ${currentPage.replace('_', ' ')} | ${DEFAULT_BOT_FOOTER_TEXT}`;
            setCustomFooter(finalEmbed, footerText, clientUser.displayAvatarURL());
            await interaction.editReply({ embeds: [finalEmbed], components: [] });
          } catch (error) {
            if (error.code !== 10008 && error.code !== 10062) {
              console.error("Error removing buttons from timed out settings view:", error);
            }
          }
        });

        return;
      }

      await interaction.editReply({ content: "Invalid subcommand specified.", ephemeral: true });


    } catch (error) {
      console.error(`Unhandled Error executing /serversettings (Group: ${group}, Sub: ${subcommand}):`, error);
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.editReply({ content: "❌ An unexpected error occurred while running this settings command.", embeds: [], components: [] }).catch(console.error);
        }
      } catch (e) {
        console.error("Failed to send final error reply for /serversettings:", e);
      }
    }
  },
  modulePath: __filename,
};