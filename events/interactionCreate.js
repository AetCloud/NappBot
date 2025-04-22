const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  InteractionType,
} = require("discord.js");
const { getVerificationConfig } = require("../utils/database");
const cooldowns = new Map();

const DEFAULT_COOLDOWN = 3;
const DEFER_THRESHOLD = 2000;

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction
          .reply({
            content: "❌ This command is not available",
            ephemeral: true,
          })
          .catch(console.error);
      }

      const cooldownKey = `${interaction.user.id}-${command.data.name}`;
      const cooldownTime = (command.cooldown || DEFAULT_COOLDOWN) * 1000;

      if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey) + cooldownTime;
        if (Date.now() < expirationTime) {
          const timeLeft = ((expirationTime - Date.now()) / 1000).toFixed(1);
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
        let deferred = false;
        const commandDefer =
          command.defer ?? command.data.options?.defer ?? false;
        const commandEphemeral =
          command.ephemeral ?? command.data.options?.ephemeral ?? false;

        let deferTimer = null;
        if (!commandDefer) {
          deferTimer = setTimeout(async () => {
            try {
              if (!interaction.replied && !interaction.deferred) {
                await interaction.deferReply({ ephemeral: commandEphemeral });
                deferred = true;
              }
            } catch (deferError) {
              console.error(
                `Error during auto-deferral for /${interaction.commandName}:`,
                deferError
              );
            }
          }, DEFER_THRESHOLD);
        } else {
          if (commandDefer) {
            await interaction.deferReply({ ephemeral: commandEphemeral });
            deferred = true;
          }
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

        const errorEmbed = new EmbedBuilder()
          .setDescription("❌ An error occurred while processing this command.")
          .setColor("#FF0000");

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
              embeds: [errorEmbed],
              components: [],
            });
          } else {
            await interaction.reply({
              embeds: [errorEmbed],
              ephemeral: true,
            });
          }
        } catch (replyError) {
          console.error(
            `Failed to send error reply for /${interaction.commandName}:`,
            replyError
          );
          if (interaction.deferred) {
            await interaction
              .followUp({ embeds: [errorEmbed], ephemeral: true })
              .catch((followUpError) => {
                console.error(
                  `Failed to follow up error reply for /${interaction.commandName}:`,
                  followUpError
                );
              });
          }
        }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId.startsWith("age_verification_modal_")) {
        await interaction.deferReply({ ephemeral: true });

        const guildId = interaction.guild.id;
        const config = await getVerificationConfig(guildId);

        if (!config) {
          return interaction.editReply({
            content:
              "❌ Age verification is not enabled or configured on this server.",
            ephemeral: true,
          });
        }

        try {
          const socialLink =
            interaction.fields.getTextInputValue("social_link");
          const declaredAge =
            interaction.fields.getTextInputValue("declared_age");
          const dateOfBirth =
            interaction.fields.getTextInputValue("date_of_birth");
          const submitter = interaction.user;

          if (isNaN(parseInt(declaredAge)) || parseInt(declaredAge) < 0) {
            return interaction.editReply({
              content: "❌ Please enter a valid number for age.",
              ephemeral: true,
            });
          }
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
            return interaction.editReply({
              content: "❌ Please enter Date of Birth in YYYY-MM-DD format.",
              ephemeral: true,
            });
          }

          const modChannel = await interaction.guild.channels
            .fetch(config.moderator_channel_id)
            .catch(() => null);
          if (!modChannel || !modChannel.isTextBased()) {
            console.error(
              `Verification Error: Moderator channel ${config.moderator_channel_id} not found or not text-based for guild ${guildId}.`
            );
            return interaction.editReply({
              content:
                "❌ Internal error: Could not find the moderator channel. Please contact server staff.",
              ephemeral: true,
            });
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
            return interaction.editReply({
              content: `❌ Internal error: I cannot send messages to the moderator channel. Please contact server staff.`,
              ephemeral: true,
            });
          }

          const verificationEmbed = new EmbedBuilder()
            .setTitle("📝 Age Verification Request")
            .setColor("Yellow")
            .setAuthor({
              name: submitter.tag,
              iconURL: submitter.displayAvatarURL(),
            })
            .addFields(
              {
                name: "👤 User",
                value: `${submitter} (${submitter.id})`,
                inline: false,
              },
              { name: "🔞 Declared Age", value: declaredAge, inline: true },
              { name: "🎂 Date of Birth", value: dateOfBirth, inline: true },
              {
                name: "🔗 Social Link",
                value: socialLink || "Not Provided",
                inline: false,
              }
            )
            .setTimestamp()
            .setFooter({ text: `User ID: ${submitter.id}` });

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

          await interaction.editReply({
            content:
              "✅ Your verification request has been submitted for review.",
            ephemeral: true,
          });
        } catch (error) {
          console.error(
            "Error processing verification modal submission:",
            error
          );
          try {
            await interaction.editReply({
              content: "❌ An error occurred while submitting your request.",
              ephemeral: true,
            });
          } catch (editError) {
            console.error(
              "Failed to edit modal submission error reply:",
              editError
            );
          }
        }
      }
    } else if (interaction.isButton()) {
      if (
        interaction.customId.startsWith("verify_accept_") ||
        interaction.customId.startsWith("verify_reject_")
      ) {
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

        await interaction.deferUpdate();

        const guildId = interaction.guild.id;
        const parts = interaction.customId.split("_");
        const action = parts[1];
        const targetUserId = parts[2];

        const config = await getVerificationConfig(guildId);
        if (!config) {
          return interaction
            .followUp({
              content:
                "❌ Verification system config not found for this server.",
              ephemeral: true,
            })
            .catch(console.error);
        }

        const targetMember = await interaction.guild.members
          .fetch(targetUserId)
          .catch(() => null);
        if (!targetMember) {
          const userLeftEmbed = EmbedBuilder.from(interaction.message.embeds[0])
            .setColor("Grey")
            .setTitle("⚠️ Verification Action Failed")
            .addFields({
              name: "Status",
              value: `User (ID: ${targetUserId}) not found in the server.`,
            });
          const disabledRowUserLeft = ActionRowBuilder.from(
            interaction.message.components[0]
          );
          disabledRowUserLeft.components.forEach((button) =>
            button.setDisabled(true)
          );
          return interaction
            .editReply({
              embeds: [userLeftEmbed],
              components: [disabledRowUserLeft],
            })
            .catch(console.error);
        }

        const originalEmbed = interaction.message.embeds[0];
        if (!originalEmbed) {
          return interaction
            .followUp({
              content: "❌ Could not find original request message data.",
              ephemeral: true,
            })
            .catch(console.error);
        }

        try {
          const newEmbed = EmbedBuilder.from(originalEmbed);
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
                  value: `Configured role (ID: ${config.verified_role_id}) not found.`,
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
                await targetMember.roles.add(verifiedRole);
                newEmbed
                  .setColor("Green")
                  .setTitle("✅ Age Verification Approved");
                newEmbed.addFields({
                  name: "Moderator Action",
                  value: `Approved by ${interaction.user}`,
                });

                await targetMember
                  .send(
                    `Your age verification on **${interaction.guild.name}** has been approved!`
                  )
                  .catch((dmError) => {
                    console.warn(
                      `Could not DM user ${targetUserId} about verification approval: ${dmError.message}`
                    );
                  });
              }
            }
          } else {
            newEmbed.setColor("Red").setTitle("❌ Age Verification Rejected");
            newEmbed.addFields({
              name: "Moderator Action",
              value: `Rejected by ${interaction.user}`,
            });

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

          const disabledRow = ActionRowBuilder.from(
            interaction.message.components[0]
          );
          disabledRow.components.forEach((button) => button.setDisabled(true));

          await interaction.editReply({
            embeds: [newEmbed],
            components: [disabledRow],
          });
        } catch (error) {
          console.error("Error processing verification button click:", error);
          await interaction
            .followUp({
              content: "❌ An error occurred while processing this action.",
              ephemeral: true,
            })
            .catch(() => {});
        }
      }
    }
  },
};
