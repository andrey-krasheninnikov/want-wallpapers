export const ratingValues = ['cringe', 'minus', 'plus', 'imba'] as const;
export type Rating = typeof ratingValues[number];
export const ratingEmoji = { cringe: '👎', minus: '👍', plus: '💖', imba: '🚀' } satisfies Record<Rating, string>;
