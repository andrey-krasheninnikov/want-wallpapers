import { visitorMutation } from './api-client';
import { getRegion } from './privacy';
export async function sendFeedback(input: { topic: string; message: string; email: string }) {
  if (getRegion() !== 'open') throw new Error('Region unavailable');
  const topic = input.topic.trim(), message = input.message.trim(), email = input.email.trim();
  if (!topic || topic.length > 100 || message.length < 5 || message.length > 2000 || email.length > 254) throw new Error('Invalid feedback');
  await visitorMutation('/feedback', 'POST', 'feedback', { topic, message, email });
}
