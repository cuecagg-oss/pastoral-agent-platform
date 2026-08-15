export type ConversationMessagesInvalidator = (input: { conversationId: number }) => unknown;

export function invalidateActiveConversationMessages(
  conversationId: number | undefined,
  invalidate: ConversationMessagesInvalidator,
) {
  if (conversationId) void invalidate({ conversationId });
}
