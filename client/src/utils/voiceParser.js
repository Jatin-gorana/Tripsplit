/**
 * Voice input parser for parsing Speech-to-Text transcript into expense fields.
 * Handles English and Hindi keywords/numbers.
 */

// Mapping of number words to values
const NUMBER_WORDS = {
  // English
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'fifty': 50, 'hundred': 100, 'thousand': 1000,
  // Hindi
  'ek': 1, 'do': 2, 'teen': 3, 'char': 4, 'paanch': 5,
  'che': 6, 'saat': 7, 'aath': 8, 'nau': 9, 'das': 10,
  'pachaas': 50, 'sau': 100, 'hazar': 1000, 'hazaar': 1000,
  'lakh': 100000
};

const CATEGORY_KEYWORDS = {
  Food: ['dinner', 'lunch', 'breakfast', 'food', 'khana', 'khana', 'coffee', 'tea', 'chai', 'snack', 'snacks', 'biryani', 'drinks', 'bar', 'restaurant', 'cafe'],
  Travel: ['cab', 'taxi', 'uber', 'ola', 'flight', 'train', 'bus', 'petrol', 'fuel', 'auto', 'toll', 'fare', 'rental', 'scooter', 'bike', 'drive'],
  Stay: ['hotel', 'resort', 'room', 'airbnb', 'villa', 'stay', 'lodge', 'booking'],
  Activities: ['ticket', 'tickets', 'movie', 'sports', 'entry', 'safari', 'diving', 'boating', 'show', 'event', 'scuba', 'park', 'pass'],
  Shopping: ['shopping', 'clothes', 'souvenir', 'bought', 'khareeda', 'mall', 'gift', 'gifts', 'market']
};

export function parseVoiceTranscript(transcript, members = [], currentMemberId = null) {
  const text = transcript.toLowerCase();

  let amount = null;
  let category = 'Other';
  let paidByMemberId = currentMemberId;
  let description = transcript;

  // 1. Extract Amount
  // Search for explicit digits first (e.g. 1200 or 1,200 or 50.50)
  const digitMatch = text.match(/\b\d+(?:[\.,]\d+)?\b/);
  if (digitMatch) {
    amount = parseFloat(digitMatch[0].replace(',', ''));
  } else {
    // Search for number words
    const words = text.split(/\s+/);
    let tempAmount = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (NUMBER_WORDS[w]) {
        if (w === 'hundred' || w === 'sau') {
          tempAmount = (tempAmount || 1) * 100;
        } else if (w === 'thousand' || w === 'hazar' || w === 'hazaar') {
          tempAmount = (tempAmount || 1) * 1000;
        } else {
          tempAmount += NUMBER_WORDS[w];
        }
      }
    }
    if (tempAmount > 0) {
      amount = tempAmount;
    }
  }

  // 2. Match Member Names
  for (const m of members) {
    const nameLower = m.name.toLowerCase();
    if (text.includes(nameLower)) {
      paidByMemberId = m.id;
      break;
    }
  }

  // 3. Infer Category
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      category = cat;
      break;
    }
  }

  // Clean description if possible
  if (transcript.length > 50) {
    description = transcript.slice(0, 50) + '...';
  }

  return {
    amountRupees: amount ? String(amount) : '',
    category,
    paidByMemberId: paidByMemberId || (members[0] ? members[0].id : ''),
    description: description || 'Voice Expense'
  };
}
