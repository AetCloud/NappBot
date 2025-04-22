const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  InteractionType,
} = require("discord.js");
const {
  getVerificationConfig,
  getCommandCategorySettings,
} = require("../utils/database");
const path = require("path");
const cooldowns = new Map();

const DEFAULT_COOLDOWN = 3;
const DEFER_THRESHOLD = 2000;

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        if (interaction.replied || interaction.deferred) return;
        return interaction
          .reply({
            content: "❌ This command is not available",
            ephemeral: true,
          })
          .catch(console.error);
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
            if (interaction.replied || interaction.deferred) return;
            return interaction
              .reply({
                content: `❌ Commands in the \`${category}\` category are currently disabled in this server.`,
                ephemeral: true,
              })
              .catch(console.error);
          }

          if (settings.required_role_id) {
            if (!interaction.member || !interaction.member.roles) {
              console.warn(
                `Could not check roles for user ${interaction.user.id} for command ${command.data.name}`
              );
              if (interaction.replied || interaction.deferred) return;
              return interaction
                .reply({
                  content: "❌ Could not verify your roles for this command.",
                  ephemeral: true,
                })
                .catch(console.error);
            }
            if (
              !interaction.member.roles.cache.has(settings.required_role_id)
            ) {
              if (interaction.replied || interaction.deferred) return;
              return interaction
                .reply({
                  content: `❌ You need the <@&${settings.required_role_id}> role to use commands in the \`${category}\` category in this server.`,
                  ephemeral: true,
                })
                .catch(console.error);
            }
          }
        } else {
          console.warn(
            `Could not determine category for command: ${command.data.name} (Path: ${command.filePath})`
          );
        }
      }

      const cooldownKey = `${interaction.user.id}-${command.data.name}`;
      const cooldownTime = (command.cooldown || DEFAULT_COOLDOWN) * 1000;

      if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) {
          const timeLeft = ((expirationTime - Date.now()) / 1000).toFixed(1);
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
            .catch(console.error);
        }
      }

      try {
        let deferred = interaction.deferred;
        const commandDefer =
          command.defer ?? command.data.options?.defer ?? false;
        const commandEphemeral =
          command.ephemeral ?? command.data.options?.ephemeral ?? false;

        let deferTimer = null;
        if (!commandDefer && !deferred && !interaction.replied) {
          deferTimer = setTimeout(async () => {
            try {
              if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: commandEphemeral });
                deferred = true;
              }
            } catch (deferError) {
              if (deferError.code !== 10062) {
                console.error(
                  `Error during auto-deferral timer for /${interaction.commandName}:`,
                  deferError
                );
              }
            }
          }, DEFER_THRESHOLD);
        } else if (commandDefer && !deferred && !interaction.replied) {
          await interaction.deferReply({ ephemeral: commandEphemeral });
          deferred = true;
        }

        await command.execute(interaction, client);

        if (deferTimer) {
          clearTimeout(deferTimer);
        }

        cooldowns.set(cooldownKey, Date.now());
      } catch (error) {
        console.error(
          `Command Error: /${interaction.commandName}`,
          error.stack
        );

        if (deferTimer) {
          clearTimeout(deferTimer);
        }

        const errorEmbed = new EmbedBuilder()
          .setDescription("❌ An error occurred while processing this command.")
          .setColor("#FF0000");

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction
              .editReply({ content: "", embeds: [errorEmbed], components: [] })
              .catch(console.error);
          } else {
            await interaction
              .reply({
                embeds: [errorEmbed],
                ephemeral: true,
              })
              .catch(console.error);
          }
        } catch (replyError) {
          console.error(
            `Failed to send error reply for /${interaction.commandName}:`,
            replyError
          );
        }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith("age_verification_modal_")) {
        if (!interaction.isRepliable()) return;
        await interaction.deferReply({ ephemeral: true }).catch((err) => {
          console.error("Error deferring modal reply:", err);
          return;
        });

        const guildId = interaction.guild.id;
        if (!guildId) {
          return interaction
            .editReply({
              content: "Modal interactions must be in a server.",
              ephemeral: true,
            })
            .catch(console.error);
        }
        const config = await getVerificationConfig(guildId);

        if (!config || !config.enabled) {
          return interaction
            .editReply({
              content:
                "❌ Age verification is not enabled or configured on this server.",
              ephemeral: true,
            })
            .catch(console.error);
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
                  `Could not retrieve answer for custom_question_${
                    index + 1
                  } for user ${submitter.id}`
                );
                verificationEmbed.addFields({
                  name: `Q${index + 1}: ${questionText.substring(0, 250)}`,
                  value: "`Error retrieving answer`",
                });
              }
            }
          });

          if (answersAdded === 0) {
            verificationEmbed.addFields({
              name: "Configuration Issue",
              value: "No questions were configured or found in the submission.",
            });
          }

          const modChannel = await interaction.guild.channels
            .fetch(config.moderator_channel_id)
            .catch(() => null);
          if (!modChannel || !modChannel.isTextBased()) {
            console.error(
              `Verification Error: Moderator channel ${config.moderator_channel_id} invalid for guild ${guildId}.`
            );
            return interaction
              .editReply({
                content:
                  "❌ Internal error: Moderator channel configuration is invalid.",
                ephemeral: true,
              })
              .catch(console.error);
          }

          const botMember = await interaction.guild.members.fetch(
            interaction.client.user.id
          );
          const permissions = modChannel.permissionsFor(botMember);
          if (
            !permissions.has(PermissionFlagsBits.SendMessages) ||
            !permissions.has(PermissionFlagsBits.EmbedLinks)
          ) {
            console.error(
              `Verification Error: Missing Send/Embed permissions in ${modChannel.name} (Guild ${guildId}).`
            );
            return interaction
              .editReply({
                content: `❌ Internal error: Bot lacks permissions in the moderator channel.`,
                ephemeral: true,
              })
              .catch(console.error);
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

          await interaction
            .editReply({
              content:
                "✅ Your verification submission has been received for review.",
              ephemeral: true,
            })
            .catch(console.error);
        } catch (error) {
          console.error(
            "Error processing verification modal submission:",
            error
          );
          try {
            if (interaction.replied || interaction.deferred) {
              await interaction
                .editReply({
                  content:
                    "❌ An error occurred while submitting your request.",
                  ephemeral: true,
                })
                .catch(console.error);
            }
          } catch (editError) {}
        }
      }
    } else if (interaction.isButton()) {
      if (
        interaction.customId.startsWith("verify_accept_") ||
        interaction.customId.startsWith("verify_reject_")
      ) {
        if (!interaction.inGuild()) return;

        if (
          !interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles)
        ) {
          return interaction
            .reply({
              content:
                "❌ You don't have permission to approve/reject verifications.",
              ephemeral: true,
            })
            .catch(console.error);
        }

        if (!interaction.isRepliable()) return;
        await interaction.deferUpdate().catch((err) => {
          console.error("Error deferring button update:", err);
          return;
        });

        const guildId = interaction.guild.id;
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const targetUserId = parts[2];

        const config = await getVerificationConfig(guildId);
        if (!config || !config.enabled) {
          return interaction
            .followUp({
              content:
                "❌ Verification system seems disabled or config is missing.",
              ephemeral: true,
            })
            .catch(console.error);
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
          return interaction
            .followUp({
              content:
                "❌ Error: Could not find the original verification message data.",
              ephemeral: true,
            })
            .catch(console.error);
        }

        const originalEmbed = EmbedBuilder.from(originalMessage.embeds[0]);
        const originalComponents = originalMessage.components[0]
          ? ActionRowBuilder.from(originalMessage.components[0])
          : new ActionRowBuilder();

        originalComponents.components.forEach((button) =>
          button.setDisabled(true)
        );

        if (!targetMember) {
          originalEmbed
            .setColor("Grey")
            .setTitle("⚠️ Verification Action Cancelled")
            .setFields(
              originalEmbed.data.fields.filter((f) => f.name === "👤 User")
            )
            .addFields({
              name: "Status",
              value: `User (ID: ${targetUserId}) not found in the server.`,
            })
            .setTimestamp(new Date());
          return interaction
            .editReply({
              embeds: [originalEmbed],
              components: [originalComponents],
            })
            .catch(console.error);
        }

        try {
          const newEmbed = originalEmbed;
          newEmbed.setTimestamp(new Date());

          if (action === "accept") {
            const verifiedRole = await interaction.guild.roles
              .fetch(config.verified_role_id)
              .catch(() => null);
            if (!verifiedRole) {
              newEmbed
                .setColor("Orange")
                .setTitle("⚠️ Verification Action Failed")
                .addFields({
                  name: "Error",
                  value: `Configured role (ID: ${config.verified_role_id}) not found or deleted.`,
                });
            } else {
              const botMember = await interaction.guild.members.fetch(
                interaction.client.user.id
              );
              if (verifiedRole.position >= botMember.roles.highest.position) {
                newEmbed
                  .setColor("Orange")
                  .setTitle("⚠️ Verification Action Failed")
                  .addFields({
                    name: "Error",
                    value: `Cannot assign role ${verifiedRole}. It's higher than or equal to my highest role.`,
                  });
              } else {
                try {
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

                  await targetMember
                    .send(
                      `Your age verification on **${interaction.guild.name}** has been approved!`
                    )
                    .catch((dmError) => {
                      console.warn(
                        `Could not DM user ${targetUserId} about verification approval: ${dmError.message}`
                      );
                    });
                } catch (roleError) {
                  console.error(
                    `Failed to assign role ${verifiedRole.id} to user ${targetUserId}:`,
                    roleError
                  );
                  newEmbed
                    .setColor("Orange")
                    .setTitle("⚠️ Verification Action Failed")
                    .addFields({
                      name: "Error",
                      value: `Failed to assign role. Check my permissions and role hierarchy.`,
                    });
                }
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

            await targetMember
              .send(
                `Your age verification on **${interaction.guild.name}** has been rejected.`
              )
              .catch((dmError) => {
                console.warn(
                  `Could not DM user ${targetUserId} about verification rejection: ${dmError.message}`
                );
              });
          }

          await interaction.editReply({
            embeds: [newEmbed],
            components: [originalComponents],
          });
        } catch (error) {
          console.error("Error processing verification button click:", error);
          await interaction
            .followUp({
              content:
                "❌ An error occurred while processing this verification action.",
              ephemeral: true,
            })
            .catch(() => {});
        }
      }
    }
  },
};
