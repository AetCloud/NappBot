const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getUserPreference } = require("../../utils/database");
const {
  setCustomFooter,
  DEFAULT_BOT_FOOTER_TEXT,
} = require("../../utils/embedUtils");

const images = {
  female: {
    behind: [
      "https://static1.e621.net/data/e1/a1/e1a1be581602c5171be271c9a970c78d.gif",
      "https://static1.e621.net/data/1f/e1/1fe11f06141f5bcdc002a90ff4c3d80f.gif",
      "https://static1.e621.net/data/d7/b4/d7b42c559f7505d66bc69c4714a354e5.gif",
      "https://static1.e621.net/data/ba/05/ba0553f7459b3a4023860047ca8b24c2.gif",
      "https://static1.e621.net/data/ba/05/ba0553f7459b3a4023860047ca8b24c2.gif",
      "https://static1.e621.net/data/f6/41/f6411b4e47be198de2b07c0ab517b4f7.gif",
      "https://static1.e621.net/data/a4/6a/a46a2b7c85a626e801cb3ea1caac3a75.gif",
      "https://static1.e621.net/data/e0/21/e021e41d356a69925cee2405a794c296.gif",
    ],
    front: [
      "https://static1.e621.net/data/c5/30/c5305191eb41530fd8d3527a969527b3.gif",
      "https://static1.e621.net/data/2f/26/2f26fa4a23068a99e9ec9c2d1ed9a8e0.gif",
      "https://static1.e621.net/data/61/48/61482f946c4558d0f019772834164377.gif",
      "https://static1.e621.net/data/f7/b9/f7b9f8a757b40d88c18bdc0c3fc4af6f.gif",
      "https://static1.e621.net/data/2c/30/2c304532a4678c0310ae249b8dffa919.gif",
      "https://static1.e621.net/data/0a/bd/0abd48dda3e8a492b5c8418cd4c036cf.gif",
      "https://static1.e621.net/data/9b/c8/9bc80f868254e23f56acdfc9422d0f68.gif",
      "https://static1.e621.net/data/f5/58/f558f5e8928b5b0745a168145bbadef5.gif",
      "https://static1.e621.net/data/bf/f7/bff7f1f5f9cc8fdfef851c7297e317ff.gif",
      "https://static1.e621.net/data/b4/3e/b43e0cce74d6762ed2cb7509c4a0e43c.gif",
      "https://static1.e621.net/data/87/0d/870d9bb6129cd09e09671b0072a4b16e.gif",
      "https://static1.e621.net/data/70/c9/70c971f2014ebd9c55a63b85fa6ab689.gif",
      "https://static1.e621.net/data/5e/ea/5eeabd6bb56a6374ca8f237e76b1b319.png",
    ],
  },
  male: {
    behind: [
      "https://static1.e621.net/data/8d/6c/8d6c97b9b1f6ad1ce11a33e95aa3320f.gif",
      "https://static1.e621.net/data/27/15/27159b7051e706017e50520e5d8259be.gif",
      "https://static1.e621.net/data/58/2c/582c18a2337dc10f400d2f1806648e03.gif",
      "https://static1.e621.net/data/79/b7/79b7491d38ccc9b549d61a7484bb3229.gif",
      "https://static1.e621.net/data/6c/e8/6ce819f62b6d7d115c3b881129198eeb.gif",
      "https://static1.e621.net/data/d4/01/d401d2fa019876715db77f7606cdaeac.gif",
      "https://static1.e621.net/data/f4/92/f4929ae1d9100e7bcaa55d653fc1fbae.gif",
      "https://static1.e621.net/data/82/87/8287c98315dbfe1d497bd5b598e2bfc8.gif",
      "https://static1.e621.net/data/71/9f/719fb226f899f9dfe18fcb46d86f5c46.gif",
      "https://static1.e621.net/data/1f/75/1f755c945e0f6eafedd12209859f4c89.gif",
      "https://static1.e621.net/data/84/d3/84d364f4a107716b73ea95f0156c5860.gif",
      "https://static1.e621.net/data/23/1e/231e564fd4dcb183490b9e804b8f5353.gif",
      "https://static1.e621.net/data/f3/44/f3442925f778399b1fb1b3d3141ef2cd.gif",
      "https://static1.e621.net/data/66/13/6613282438444bf6ad871fe880e17da5.gif",
      "https://static1.e621.net/data/a2/95/a295fc91f6b9f366f803b2b37f82538d.gif",
      "https://static1.e621.net/data/c1/f2/c1f2056014f7330b6641c77d79645380.gif",
      "https://static1.e621.net/data/5d/99/5d99fb3ae454864b932bdee9f68bb75a.gif",
      "https://static1.e621.net/data/03/3a/033a1899a93547b88e97ed4465f13251.gif",
      "https://static1.e621.net/data/92/0e/920e3c8d0127829ea23ea0368d4033a1.png",
      "https://static1.e621.net/data/8f/e9/8fe9c133e3451ffa7934101f1d4d83b6.gif",
      "https://static1.e621.net/data/d0/e1/d0e1af0aef3471a8dbc7ad1dcf69739e.gif",
      "https://static1.e621.net/data/43/0c/430ce4951c7ef7612bfb1cd8b411d561.gif",
    ],
    front: [
      "https://static1.e621.net/data/00/ee/00eee273dc572ab71b23aa78dbbf5663.gif",
      "https://static1.e621.net/data/cb/a7/cba75d5c73b30b25a05aa48e0d883786.gif",
      "https://static1.e621.net/data/78/e8/78e888f5ab8155658d09b9d9818897f9.gif",
      "https://static1.e621.net/data/1b/91/1b9107b9d991e97b18a54e7acc34a770.gif",
      "https://static1.e621.net/data/69/08/690804c63fff076a218060a6ea586f76.gif",
      "https://static1.e621.net/data/03/62/03628379efa53089ffb58c45050be32c.gif",
      "https://static1.e621.net/data/89/c0/89c06489dfdb2b1442e0c780d1c701fe.gif",
      "https://static1.e621.net/data/56/b7/56b7dfc17a9346a47582398e01771d53.gif",
      "https://static1.e621.net/data/e2/0d/e20d2e81c752c2e5d8f0895d644099d1.gif",
      "https://static1.e621.net/data/3f/81/3f81f9d3594690a4334f0635f214b758.gif",
      "https://static1.e621.net/data/03/6d/036d19c76726620f74e7e12ab1dc8bb5.gif",
    ],
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fuck")
    .setDescription("🔥 Give someone some love~")
    .setNSFW(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user you want to interact with")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("pose")
        .setDescription("Choose a position (behind/front)")
        .setRequired(false)
        .addChoices(
          { name: "Behind", value: "behind" },
          { name: "Front", value: "front" }
        )
    ),

  async execute(interaction) {
    let embed = null;
    let image = null;

    try {
      console.log("⚡ Command execution started...");

      const sender = interaction.user;
      const recipient = interaction.options.getUser("user");

      if (!recipient) {
        console.log("❌ No recipient provided.");
        return interaction.reply({
          content: "❌ You must mention someone!",
          ephemeral: true,
        });
      }

      if (recipient.id === sender.id) {
        console.log("❌ User tried to target themselves.");
        return interaction.reply({
          content: "❌ You can't do this to yourself...",
          ephemeral: true,
        });
      }

      console.log("⌛ Deferring reply...");
      await interaction.deferReply();

      const trimmedRecipientId = recipient.id.trim();
      const stringRecipientId = String(trimmedRecipientId);
      let type = await getUserPreference(stringRecipientId);

      if (type === null || type === "random") {
        console.log("No explicit preference found, choosing randomly.");
        const validTypes = ["male", "female"];
        type = validTypes[Math.floor(Math.random() * validTypes.length)];
      } else {
        console.log(`Explicit preference found: ${type}`);
      }

      if (type !== "female") {
        const senderPreference = await getUserPreference(sender.id.trim());
        if (senderPreference === "female") {
          type = "female";
        }
      }

      let pose = interaction.options.getString("pose");
      const poseOptions = ["behind", "front"];
      if (!pose || !poseOptions.includes(pose)) {
        pose = poseOptions[Math.floor(Math.random() * poseOptions.length)];
      }

      console.log(`🔀 Selected Type: ${type}, Pose: ${pose}`);

      if (
        !images[type] ||
        !images[type][pose] ||
        images[type][pose].length === 0
      ) {
        console.error(`❌ No images found for: ${type}, ${pose}`);
        return interaction.editReply({
          content: "❌ Something went wrong while choosing the image!",
        });
      }

      const randomIndex = Math.floor(Math.random() * images[type][pose].length);
      image = images[type][pose][randomIndex];

      const descriptions = [
        `${sender} is having a steamy session with ${recipient}! 🔥`,
        `${recipient} and ${sender} are enjoying some quality time together. 😏`,
        `Things are getting intense between ${sender} and ${recipient}! 💋`,
        `${sender} and ${recipient} are lost in passion! 💕`,
      ];
      const randomDescription =
        descriptions[Math.floor(Math.random() * descriptions.length)];

      console.log(`📷 Selected Image Index: ${randomIndex}`);

      embed = new EmbedBuilder()
        .setTitle("🔥 Steamy Interaction!")
        .setDescription(randomDescription)
        .setImage(image)
        .setColor("#FF007F")
        .setTimestamp();

      const footerText = `Requested by ${sender.tag} | ${DEFAULT_BOT_FOOTER_TEXT}`;
      setCustomFooter(
        embed,
        footerText,
        interaction.client.user.displayAvatarURL()
      );

      console.log("✅ Sending embed response...");
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("❌ Error executing command:", error);

      try {
        const content =
          "❌ Something went wrong while processing your request.";

        if (interaction.deferred || interaction.replied) {
          if (embed) {
            await interaction.editReply({
              content,
              embeds: [],
              components: [],
            });
          } else {
            await interaction.editReply({
              content,
              embeds: [],
              components: [],
            });
          }
        } else {
          await interaction.reply({ content, ephemeral: true });
        }
      } catch (nestedError) {
        console.error("⚠️ Error sending/editing error reply:", nestedError);
      }
    }
  },
  modulePath: __filename,
};
