export const ratingValues = ['cringe', 'minus', 'plus', 'imba'] as const;
export type Rating = typeof ratingValues[number];
