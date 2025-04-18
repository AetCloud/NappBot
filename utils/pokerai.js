const { evaluateHand } = require("./pokerUtils");

class PokerAI {
  constructor(name, strategy) {
    this.name = name;
    this.strategy = strategy;
    this.hand = [];
    this.folded = false;
    this.currentBet = 0;
    this.lastAction = null;
  }

  decideAction(currentBet, pot, communityCards, players) {
    if (this.folded) return { action: "fold", amount: 0 };

    const handStrength = this.calculateHandStrength(communityCards);
    const potOdds = this.calculatePotOdds(currentBet, pot);
    const bluffChance = this.shouldBluff(players, pot, handStrength);
    const action = this.makeDecision(
      handStrength,
      potOdds,
      currentBet,
      pot,
      bluffChance,
      players
    );

    this.lastAction = action.action;
    return action;
  }

  calculateHandStrength(communityCards) {
    if (this.hand.length < 2) return 0;
    const fullHand = [...this.hand, ...communityCards];
    const handRank = evaluateHand(fullHand);

    const strengthScale = {
      "High Card": 1,
      "One Pair": 2,
      "Two Pair": 3,
      "Three of a Kind": 4,
      Straight: 5,
      Flush: 6,
      "Full House": 7,
      "Four of a Kind": 8,
      "Straight Flush": 9,
      "Royal Flush": 10,
    };

    return strengthScale[handRank] || 0;
  }

  calculatePotOdds(currentBet, pot) {
    if (currentBet === 0) return 1;
    return pot / (currentBet + pot);
  }

  shouldBluff(players, pot, handStrength) {
    let baseChance =
      {
        TAG: 5,
        LAG: 25,
        TP: 2,
        LP: 1,
        Exploitative: 10,
      }[this.strategy] || 10;

    const passiveOpponents = players.filter(
      (p) => !p.folded && p.lastAction === "check"
    ).length;
    baseChance += passiveOpponents * 5;

    if (pot > 500) baseChance += 10;
    if (handStrength <= 3) baseChance += 10;

    return Math.random() * 100 < baseChance;
  }

  makeDecision(handStrength, potOdds, currentBet, pot, bluffChance, players) {
    if (this.folded) return { action: "fold", amount: 0 };

    let action = "fold";
    let betAmount = 0;
    let maxBet = Math.min(pot * 0.75, 1000);

    switch (this.strategy) {
      case "TAG":
        if (handStrength >= 7) {
          action = "raise";
          betAmount = maxBet;
        } else if (handStrength >= 4) {
          action = "call";
          betAmount = currentBet;
        } else {
          action = "fold";
        }
        break;

      case "LAG":
        if (handStrength >= 6 || bluffChance) {
          action = "raise";
          betAmount = Math.min(pot * 0.5, 600);
        } else {
          action = "call";
          betAmount = currentBet;
        }
        break;

      case "TP":
        if (handStrength >= 7) {
          action = "call";
          betAmount = currentBet;
        } else {
          action = "fold";
        }
        break;

      case "LP":
        if (handStrength >= 4) {
          action = "call";
          betAmount = currentBet;
        } else {
          action = Math.random() > 0.5 ? "call" : "fold";
          betAmount = action === "call" ? currentBet : 0;
        }
        break;

      case "Exploitative":
        const aggressiveOpponents = players.filter(
          (p) => !p.folded && p.lastAction === "raise"
        ).length;
        if (
          handStrength >= 6 ||
          (aggressiveOpponents > 1 && handStrength >= 4)
        ) {
          action = "raise";
          betAmount = maxBet;
        } else if (handStrength >= 3 || potOdds > 0.6) {
          action = "call";
          betAmount = currentBet;
        } else {
          action = bluffChance ? "raise" : "fold";
          betAmount = action === "raise" ? Math.min(pot * 0.4, 400) : 0;
        }
        break;

      default:
        action = "fold";
    }

    return { action, amount: betAmount };
  }
}

module.exports = PokerAI;
