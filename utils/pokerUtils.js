const handEvaluator = require("poker-hand-evaluator");

const HAND_RANKINGS = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
  "Royal Flush",
];

function evaluateHand(hand) {
  if (
    !Array.isArray(hand) ||
    hand.some(
      (card) =>
        !card ||
        typeof card.value === "undefined" ||
        typeof card.suit === "undefined"
    )
  ) {
    console.error("Invalid hand format passed to evaluateHand:", hand);
    return "Invalid Hand";
  }

  const formattedHand = hand.map(
    (card) => `<span class="math-inline">\{card\.value\}</span>{card.suit}`
  );

  try {
    const evaluation = handEvaluator.evalHand(formattedHand);
    if (
      !evaluation ||
      typeof evaluation.handType === "undefined" ||
      !HAND_RANKINGS[evaluation.handType]
    ) {
      console.error(
        "Error or invalid result from handEvaluator.evalHand:",
        evaluation
      );
      return "Evaluation Error";
    }
    return HAND_RANKINGS[evaluation.handType];
  } catch (error) {
    console.error("Exception during hand evaluation:", error);
    return "Evaluation Exception";
  }
}

function determineWinner(players, communityCards) {
  let bestHandRankIndex = -1;
  let winner = null;
  const evaluatedHands = [];
  let winners = [];

  for (const player of players) {
    if (
      player &&
      !player.folded &&
      Array.isArray(player.hand) &&
      player.hand.length > 0
    ) {
      const fullHand = [...player.hand, ...communityCards];
      const handRankName = evaluateHand(fullHand);
      const currentHandRankIndex = HAND_RANKINGS.indexOf(handRankName);

      evaluatedHands.push({
        player: player.name,
        hand: fullHand
          .map((c) => `<span class="math-inline">\{c\.value\}</span>{c.suit}`)
          .join(" "),
        ranking: handRankName,
        rankIndex: currentHandRankIndex,
      });

      if (currentHandRankIndex > bestHandRankIndex) {
        bestHandRankIndex = currentHandRankIndex;
        winners = [player];
      } else if (currentHandRankIndex === bestHandRankIndex) {
        winners.push(player);
      }
    }
  }

  winner = winners.length > 0 ? winners[0] : null;
  const bestHandName =
    bestHandRankIndex >= 0
      ? HAND_RANKINGS[bestHandRankIndex]
      : "No valid hands";

  return { winner, bestHandName, evaluatedHands, winners };
}

function getHandStrengthTip(handType) {
  const tips = {
    "High Card": "Consider folding if the bet is high.",
    "One Pair": "A decent hand, but be cautious of higher pairs.",
    "Two Pair": "A strong hand, consider raising.",
    "Three of a Kind": "A very strong hand, you should raise.",
    "Straight": "A powerful hand, definitely raise.",
    "Flush": "A very powerful hand, raise confidently.",
    "Full House": "An extremely strong hand, raise aggressively.",
    "Four of a Kind": "Almost unbeatable, raise as much as possible.",
    "Straight Flush": "An incredibly rare hand, raise all-in.",
    "Royal Flush": "The best possible hand, go all-in.",
    "Invalid Hand": "Could not evaluate hand due to invalid input.",
    "Evaluation Error": "An issue occurred during hand evaluation.",
    "Evaluation Exception": "An exception occurred during hand evaluation.",
  };
  return tips[handType] || "Play cautiously.";
}

module.exports = {
  evaluateHand,
  determineWinner,
  getHandStrengthTip,
  HAND_RANKINGS,
};
