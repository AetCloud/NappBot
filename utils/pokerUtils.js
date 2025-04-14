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
  // Ensure hand is an array and contains valid card objects before mapping
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
    return "Invalid Hand"; // Return a distinct error string
  }

  const formattedHand = hand.map(
    (card) => `<span class="math-inline">\{card\.value\}</span>{card.suit}`
  ); // Use template literal correctly

  try {
    const evaluation = handEvaluator.evalHand(formattedHand);
    // Check if evaluation result is valid
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
    // Use the numeric handType index to get the string name
    return HAND_RANKINGS[evaluation.handType];
  } catch (error) {
    console.error("Exception during hand evaluation:", error);
    return "Evaluation Exception";
  }
}

function determineWinner(players, communityCards) {
  let bestHandRankIndex = -1; // Use index for comparison
  let winner = null;
  const evaluatedHands = [];
  let winners = []; // To handle ties

  for (const player of players) {
    // Ensure player and hand are valid
    if (
      player &&
      !player.folded &&
      Array.isArray(player.hand) &&
      player.hand.length > 0
    ) {
      const fullHand = [...player.hand, ...communityCards];
      const handRankName = evaluateHand(fullHand); // Get the string name
      const currentHandRankIndex = HAND_RANKINGS.indexOf(handRankName);

      evaluatedHands.push({
        player: player.name,
        hand: fullHand
          .map((c) => `<span class="math-inline">\{c\.value\}</span>{c.suit}`)
          .join(" "),
        ranking: handRankName,
        rankIndex: currentHandRankIndex, // Store index for comparison
      });

      if (currentHandRankIndex > bestHandRankIndex) {
        bestHandRankIndex = currentHandRankIndex;
        winners = [player]; // New best hand found
      } else if (currentHandRankIndex === bestHandRankIndex) {
        // TODO: Implement tie-breaking logic based on kickers/high cards if needed
        // For now, we just add to potential winners (results in a split pot if no tie-breaker)
        winners.push(player);
      }
    }
  }

  // If multiple winners, need to decide how to handle pot split or tie-breakers
  // For simplicity here, just returning the first winner found in case of a tie
  winner = winners.length > 0 ? winners[0] : null;
  const bestHandName =
    bestHandRankIndex >= 0
      ? HAND_RANKINGS[bestHandRankIndex]
      : "No valid hands";

  // Return structure might need adjustment based on how ties are handled
  return { winner, bestHandName, evaluatedHands, winners };
}

function getHandStrengthTip(handType) {
  const tips = {
    "High Card": "Consider folding if the bet is high.",
    "One Pair": "A decent hand, but be cautious of higher pairs.",
    "Two Pair": "A strong hand, consider raising.",
    "Three of a Kind": "A very strong hand, you should raise.",
    Straight: "A powerful hand, definitely raise.",
    Flush: "A very powerful hand, raise confidently.",
    "Full House": "An extremely strong hand, raise aggressively.",
    "Four of a Kind": "Almost unbeatable, raise as much as possible.",
    "Straight Flush": "An incredibly rare hand, raise all-in.",
    "Royal Flush": "The best possible hand, go all-in.",
    // Add entries for error states if needed
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
}; // Export rankings if needed elsewhere
