const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  InteractionType,
  ApplicationCommandType,
} = require("discord.js");
const {
  getVerificationConfig,
  getCommandCategorySettings,
} = require("../utils/database");
const path = require("path");
const cooldowns = new Map();

const DEFAULT_COOLDOWN = 3;

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    const timestamp = new Date().toISOString();
    console.log(
      `[InteractionCreate] ${timestamp} - New Interaction: ID=${
        interaction.id
      }, Type=${interaction.type}, User=${interaction.user.tag}(${
        interaction.user.id
      }), Guild=${interaction.guildId || "DM"}`
    );

    if (interaction.isChatInputCommand()) {
      console.log(
        `[InteractionCreate] Chat Input Command: /${interaction.commandName}`
      );
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(
          `[InteractionCreate] Chat command /${interaction.commandName} not found.`
        );
        if (interaction.replied || interaction.deferred) return;
        return interaction
          .reply({
            content: "❌ This command is not available",
            ephemeral: true,
          })
          .catch((e) =>
            console.error(
              `[InteractionCreate] Failed to reply for missing chat command:`,
              e
            )
          );
      }

      if (interaction.inGuild() && command.filePath) {
        const guildId = interaction.guild.id;
        const category = path
          .dirname(command.filePath)
          .split(path.sep)
          .pop()
          ?.toLowerCase();

        if (category) {
          const settings = await getCommandCategorySettings(guildId, category);

          if (!settings.enabled) {
            console.log(
              `[InteractionCreate] Command /${interaction.commandName} disabled in category '${category}' for guild ${guildId}.`
            );
            if (interaction.replied || interaction.deferred) return;
            return interaction
              .reply({
                content: `❌ Commands in the \`${category}\` category are currently disabled in this server.`,
                ephemeral: true,
              })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to reply for disabled category:`,
                  e
                )
              );
          }

          if (settings.required_role_id) {
            if (!interaction.member || !interaction.member.roles) {
              console.warn(
                `[InteractionCreate] Could not check roles for user ${interaction.user.id} for command ${command.data.name}`
              );
              if (interaction.replied || interaction.deferred) return;
              return interaction
                .reply({
                  content: "❌ Could not verify your roles for this command.",
                  ephemeral: true,
                })
                .catch((e) =>
                  console.error(
                    `[InteractionCreate] Failed to reply for role check failure:`,
                    e
                  )
                );
            }
            if (
              !interaction.member.roles.cache.has(settings.required_role_id)
            ) {
              console.log(
                `[InteractionCreate] User ${interaction.user.id} missing role ${settings.required_role_id} for command /${interaction.commandName} in category '${category}'.`
              );
              if (interaction.replied || interaction.deferred) return;
              return interaction
                .reply({
                  content: `❌ You need the <@&${settings.required_role_id}> role to use commands in the \`${category}\` category in this server.`,
                  ephemeral: true,
                })
                .catch((e) =>
                  console.error(
                    `[InteractionCreate] Failed to reply for missing role:`,
                    e
                  )
                );
            }
          }
        } else {
          console.warn(
            `[InteractionCreate] Could not determine category for command: ${command.data.name} (Path: ${command.filePath})`
          );
        }
      }

      const cooldownKey = `${interaction.user.id}-${command.data.name}`;
      const cooldownTime = (command.cooldown || DEFAULT_COOLDOWN) * 1000;

      if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) {
          const timeLeft = ((expirationTime - Date.now()) / 1000).toFixed(1);
          console.log(
            `[InteractionCreate] Command /${interaction.commandName} on cooldown for user ${interaction.user.id}. ${timeLeft}s left.`
          );
          if (interaction.replied || interaction.deferred) return;
          return interaction
            .reply({
              embeds: [
                new EmbedBuilder()
                  .setDescription(
                    `⏳ Please wait ${timeLeft}s before using this command`
                  )
                  .setColor("#FFA500"),
              ],
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to send cooldown reply:`,
                e
              )
            );
        }
      }

      try {
        console.log(
          `[InteractionCreate] Attempting to execute chat command: /${command.data.name} by ${interaction.user.tag}`
        );
        let deferred = interaction.deferred;
        const commandDefer =
          command.defer ?? command.data?.options?.defer ?? false;
        const commandEphemeral =
          command.ephemeral ?? command.data?.options?.ephemeral ?? false;

        if (commandDefer && !deferred && !interaction.replied) {
          console.log(
            `[InteractionCreate] Chat command /${command.data.name} explicitly requests deferral.`
          );
          await interaction.deferReply({ ephemeral: commandEphemeral });
          deferred = true;
        }

        await command.execute(interaction, client);
        console.log(
          `[InteractionCreate] Chat command /${command.data.name} execution finished for ${interaction.user.tag}.`
        );

        if (!command.noCooldown) {
          cooldowns.set(cooldownKey, Date.now());
        }
      } catch (error) {
        console.error(
          `[InteractionCreate] ERROR executing chat command /${interaction.commandName} for ${interaction.user.tag}:`,
          error.stack
        );
        const errorEmbed = new EmbedBuilder()
          .setDescription("❌ An error occurred while processing this command.")
          .setColor("#FF0000");
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction
              .editReply({ content: "", embeds: [errorEmbed], components: [] })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to editReply with error for /${interaction.commandName}:`,
                  e
                )
              );
          } else {
            await interaction
              .reply({
                embeds: [errorEmbed],
                ephemeral: true,
              })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to reply with error for /${interaction.commandName}:`,
                  e
                )
              );
          }
        } catch (replyError) {
          console.error(
            `[InteractionCreate] CRITICAL: Failed to send any error reply for /${interaction.commandName}:`,
            replyError
          );
        }
      }
    } else if (interaction.isContextMenuCommand()) {
      console.log(
        `[InteractionCreate] Context Menu Command: ${
          interaction.commandName
        } (Type: ${
          interaction.commandType === ApplicationCommandType.Message
            ? "Message"
            : "User"
        }) by ${interaction.user.tag}`
      );
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `[InteractionCreate] Context Menu Command '${interaction.commandName}' not found in client.commands.`
        );
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.reply({
              content: `❌ Context Menu Command '${interaction.commandName}' not found.`,
              ephemeral: true,
            });
          } catch (e) {
            console.error(
              `[InteractionCreate] Failed to reply for missing context menu command:`,
              e
            );
          }
        }
        return;
      }

      const cooldownKey = `${interaction.user.id}-${interaction.commandName}-context`;
      const cooldownTime = (command.cooldown || 5) * 1000;

      if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) {
          const timeLeft = ((expirationTime - Date.now()) / 1000).toFixed(1);
          console.log(
            `[InteractionCreate] Context Menu ${interaction.commandName} on cooldown for user ${interaction.user.id}. ${timeLeft}s left.`
          );
          if (!interaction.replied && !interaction.deferred) {
            try {
              await interaction.reply({
                embeds: [
                  new EmbedBuilder()
                    .setDescription(
                      `⏳ Please wait ${timeLeft}s before using this action again.`
                    )
                    .setColor("#FFA500"),
                ],
                ephemeral: true,
              });
            } catch (e) {
              console.error(
                `[InteractionCreate] Failed to send cooldown reply for context menu:`,
                e
              );
            }
          }
          return;
        }
      }

      try {
        console.log(
          `[InteractionCreate] Executing Context Menu: ${command.data.name} for user ${interaction.user.tag}`
        );
        await command.execute(interaction, client);
        console.log(
          `[InteractionCreate] Context Menu ${command.data.name} execution initiated by ${interaction.user.tag}.`
        );
        if (!command.noCooldown) {
          cooldowns.set(cooldownKey, Date.now());
        }
      } catch (error) {
        console.error(
          `[InteractionCreate] ERROR executing Context Menu ${interaction.commandName} for ${interaction.user.tag}:`,
          error.stack
        );
        if (!interaction.replied && !interaction.deferred) {
          try {
            console.log(
              `[InteractionCreate] Attempting to send fallback error reply for context menu (not replied/deferred).`
            );
            await interaction.reply({
              content: "❌ An error occurred with this context menu action.",
              ephemeral: true,
            });
          } catch (e) {
            console.error(
              `[InteractionCreate] Failed to send fallback error reply for context menu:`,
              e
            );
          }
        } else if (interaction.deferred && !interaction.replied) {
          try {
            console.log(
              `[InteractionCreate] Attempting to editReply fallback error for context menu (deferred but not replied).`
            );
            await interaction.editReply({
              content: "❌ An error occurred with this context menu action.",
              embeds: [],
              components: [],
            });
          } catch (e) {
            console.error(
              `[InteractionCreate] Failed to send fallback error editReply for context menu:`,
              e
            );
          }
        }
      }
    } else if (interaction.isButton()) {
      console.log(
        `[InteractionCreate] Button Interaction: ${interaction.customId}, User: ${interaction.user.tag}`
      );
      if (
        interaction.customId.startsWith("verify_accept_") ||
        interaction.customId.startsWith("verify_reject_")
      ) {
        if (!interaction.inGuild()) {
          console.log(
            `[InteractionCreate] Verification button used outside of guild by ${interaction.user.tag}`
          );
          return;
        }
        if (
          !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)
        ) {
          console.log(
            `[InteractionCreate] User ${interaction.user.tag} lacks ManageRoles for verification button ${interaction.customId}.`
          );
          return interaction
            .reply({
              content:
                "❌ You don't have permission to approve/reject verifications.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to send permission error for verification button:`,
                e
              )
            );
        }

        try {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
            console.log(
              `[InteractionCreate] Deferred update for button ${interaction.customId}.`
            );
          }
        } catch (deferError) {
          console.error(
            `[InteractionCreate] Failed to deferUpdate for button ${interaction.customId}:`,
            deferError
          );
          return;
        }

        const guildId = interaction.guild.id;
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const targetUserId = parts[2];
        console.log(
          `[InteractionCreate] Verification button action: ${action} for user ${targetUserId} by ${interaction.user.tag} in guild ${guildId}.`
        );

        const config = await getVerificationConfig(guildId);
        if (!config || !config.enabled) {
          console.log(
            `[InteractionCreate] Verification system disabled or no config for guild ${guildId} during button press.`
          );
          return interaction
            .followUp({
              content:
                "❌ Verification system seems disabled or config is missing.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to send followUp for disabled verification system:`,
                e
              )
            );
        }

        const targetMember = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => null);
        const originalMessage = interaction.message;

        if (
          !originalMessage ||
          !originalMessage.embeds ||
          originalMessage.embeds.length === 0
        ) {
          console.error(
            `[InteractionCreate] Could not find original verification message data for button ${interaction.customId}.`
          );
          return interaction
            .followUp({
              content:
                "❌ Error: Could not find the original verification message data.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to send followUp for missing original message:`,
                e
              )
            );
        }

        const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
        const updatedComponents = new ActionRowBuilder();
        originalMessage.components[0]?.components.forEach((button) => {
          updatedComponents.addComponents(
            ButtonBuilder.from(button).setDisabled(true)
          );
        });

        if (!targetMember) {
          console.log(
            `[InteractionCreate] Target member ${targetUserId} not found in guild ${guildId} for verification action.`
          );
          originalEmbed
            .setColor("Grey")
            .setTitle("⚠️ Verification Action Cancelled (User Left)")
            .setFields(
              originalEmbed.data.fields.filter((f) => f.name === "👤 User")
            )
            .addFields({
              name: "Status",
              value: `User (ID: ${targetUserId}) no longer in the server.`,
            })
            .setTimestamp(new Date());
          return interaction
            .editReply({
              embeds: [originalEmbed],
              components: [updatedComponents],
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to editReply for user not found:`,
                e
              )
            );
        }

        try {
          const newEmbed = originalEmbed.setTimestamp(new Date());
          if (action === "accept") {
            const verifiedRole = await interaction.guild.roles
              .fetch(config.verified_role_id)
              .catch(() => null);
            if (!verifiedRole) {
              console.error(
                `[InteractionCreate] Verified role ID ${config.verified_role_id} not found in guild ${guildId}.`
              );
              newEmbed
                .setColor("Orange")
                .setTitle("⚠️ Verification Action Failed")
                .addFields({
                  name: "Error",
                  value: `Configured role (ID: ${config.verified_role_id}) not found.`,
                });
            } else {
              const botMember = await interaction.guild.members.fetch(
                client.user.id
              );
              if (verifiedRole.position >= botMember.roles.highest.position) {
                console.error(
                  `[InteractionCreate] Bot role too low to assign verified role ${verifiedRole.name} in guild ${guildId}.`
                );
                newEmbed
                  .setColor("Orange")
                  .setTitle("⚠️ Verification Action Failed")
                  .addFields({
                    name: "Error",
                    value: `Cannot assign role ${verifiedRole}. It's higher than or equal to my highest role.`,
                  });
              } else {
                await targetMember.roles.add(verifiedRole);
                newEmbed
                  .setColor("Green")
                  .setTitle("✅ Age Verification Approved");
                const existingFields = newEmbed.data.fields.filter(
                  (f) => f.name !== "Moderator Action"
                );
                newEmbed.setFields([
                  ...existingFields,
                  {
                    name: "Moderator Action",
                    value: `Approved by ${interaction.user}`,
                  },
                ]);
                console.log(
                  `[InteractionCreate] User ${targetUserId} approved by ${interaction.user.tag} in guild ${guildId}. Role ${verifiedRole.name} assigned.`
                );
                targetMember
                  .send(
                    `Your age verification on **${interaction.guild.name}** has been approved!`
                  )
                  .catch((dmError) =>
                    console.warn(
                      `[InteractionCreate] Could not DM user ${targetUserId} about approval: ${dmError.message}`
                    )
                  );
              }
            }
          } else {
            newEmbed.setColor("Red").setTitle("❌ Age Verification Rejected");
            const existingFields = newEmbed.data.fields.filter(
              (f) => f.name !== "Moderator Action"
            );
            newEmbed.setFields([
              ...existingFields,
              {
                name: "Moderator Action",
                value: `Rejected by ${interaction.user}`,
              },
            ]);
            console.log(
              `[InteractionCreate] User ${targetUserId} rejected by ${interaction.user.tag} in guild ${guildId}.`
            );
            targetMember
              .send(
                `Your age verification on **${interaction.guild.name}** has been rejected.`
              )
              .catch((dmError) =>
                console.warn(
                  `[InteractionCreate] Could not DM user ${targetUserId} about rejection: ${dmError.message}`
                )
              );
          }
          await interaction.editReply({
            embeds: [newEmbed],
            components: [updatedComponents],
          });
        } catch (error) {
          console.error(
            `[InteractionCreate] Error processing verification button ${interaction.customId} for user ${targetUserId}:`,
            error
          );
          await interaction
            .followUp({
              content:
                "❌ An error occurred while processing this verification action.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to send followUp for button processing error:`,
                e
              )
            );
        }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      console.log(
        `[InteractionCreate] Modal Submit: ${interaction.customId}, User: ${interaction.user.tag}`
      );
      if (interaction.customId.startsWith("age_verification_modal_")) {
        if (!interaction.replied && !interaction.deferred) {
          try {
            await interaction.deferReply({ ephemeral: true });
            console.log(
              `[InteractionCreate] Deferred reply for modal ${interaction.customId}.`
            );
          } catch (e) {
            console.error(
              `[InteractionCreate] Failed to defer modal reply ${interaction.customId}:`,
              e
            );
            return;
          }
        }

        const guildId = interaction.guild.id;
        if (!guildId) {
          console.error(
            `[InteractionCreate] Modal ${interaction.customId} submitted outside of a guild.`
          );
          return interaction
            .editReply({
              content: "Modal interactions must be in a server.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to editReply for modal guild error:`,
                e
              )
            );
        }
        const config = await getVerificationConfig(guildId);

        if (!config || !config.enabled) {
          console.log(
            `[InteractionCreate] Verification system disabled or no config for guild ${guildId} for modal ${interaction.customId}.`
          );
          return interaction
            .editReply({
              content:
                "❌ Age verification is not enabled or configured on this server.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to editReply for modal config error:`,
                e
              )
            );
        }

        try {
          const submitter = interaction.user;
          const verificationEmbed = new EmbedBuilder()
            .setTitle("📝 Verification Submission")
            .setColor("Yellow")
            .setAuthor({
              name: submitter.tag,
              iconURL: submitter.displayAvatarURL(),
            })
            .addFields({
              name: "👤 User",
              value: `${submitter} (${submitter.id})`,
              inline: false,
            })
            .setTimestamp()
            .setFooter({ text: `User ID: ${submitter.id}` });

          const questions = [
            config.question1,
            config.question2,
            config.question3,
            config.question4,
          ];
          let answersAdded = 0;
          questions.forEach((questionText, index) => {
            if (questionText) {
              try {
                const answer = interaction.fields.getTextInputValue(
                  `custom_question_${index + 1}`
                );
                verificationEmbed.addFields({
                  name: `Q${index + 1}: ${questionText.substring(0, 250)}`,
                  value: answer.substring(0, 1020) || "`No answer provided`",
                });
                answersAdded++;
              } catch (fieldError) {
                console.warn(
                  `[InteractionCreate] Could not retrieve answer for custom_question_${
                    index + 1
                  } for user ${submitter.id} in modal ${interaction.customId}.`
                );
                verificationEmbed.addFields({
                  name: `Q${index + 1}: ${questionText.substring(0, 250)}`,
                  value: "`Error retrieving answer`",
                });
              }
            }
          });
          if (answersAdded === 0)
            verificationEmbed.addFields({
              name: "Configuration Issue",
              value: "No questions were configured or found in the submission.",
            });

          const modChannel = await interaction.guild.channels
            .fetch(config.moderator_channel_id)
            .catch(() => null);
          if (!modChannel || !modChannel.isTextBased()) {
            console.error(
              `[InteractionCreate] Verification Error: Moderator channel ${config.moderator_channel_id} invalid for guild ${guildId} for modal ${interaction.customId}.`
            );
            return interaction
              .editReply({
                content:
                  "❌ Internal error: Moderator channel configuration is invalid.",
                ephemeral: true,
              })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to editReply for modal mod channel error:`,
                  e
                )
              );
          }

          const botMember = await interaction.guild.members.fetch(
            client.user.id
          );
          const permissions = modChannel.permissionsFor(botMember);
          if (
            !permissions.has(PermissionFlagsBits.SendMessages) ||
            !permissions.has(PermissionFlagsBits.EmbedLinks)
          ) {
            console.error(
              `[InteractionCreate] Verification Error: Missing Send/Embed permissions in ${modChannel.name} (Guild ${guildId}) for modal ${interaction.customId}.`
            );
            return interaction
              .editReply({
                content: `❌ Internal error: Bot lacks permissions in the moderator channel.`,
                ephemeral: true,
              })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to editReply for modal bot permission error:`,
                  e
                )
              );
          }

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`verify_accept_${submitter.id}`)
              .setLabel("Approve")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`verify_reject_${submitter.id}`)
              .setLabel("Reject")
              .setStyle(ButtonStyle.Danger)
          );

          await modChannel.send({
            embeds: [verificationEmbed],
            components: [row],
          });
          console.log(
            `[InteractionCreate] Verification modal ${interaction.customId} submitted by ${submitter.tag} sent to mod channel ${modChannel.name}.`
          );
          await interaction
            .editReply({
              content:
                "✅ Your verification submission has been received for review.",
              ephemeral: true,
            })
            .catch((e) =>
              console.error(
                `[InteractionCreate] Failed to editReply for modal success message:`,
                e
              )
            );
        } catch (error) {
          console.error(
            `[InteractionCreate] Error processing verification modal submission ${interaction.customId}:`,
            error
          );
          if (interaction.replied || interaction.deferred) {
            await interaction
              .editReply({
                content: "❌ An error occurred while submitting your request.",
                ephemeral: true,
              })
              .catch((e) =>
                console.error(
                  `[InteractionCreate] Failed to editReply for modal processing error:`,
                  e
                )
              );
          }
        }
      }
    } else {
      console.log(
        `[InteractionCreate] Received unhandled interaction type: ${interaction.type} for interaction ID ${interaction.id}`
      );
    }
  },
};
