import { describe, expect, it, vi } from "vitest";
import { invalidateActiveConversationMessages } from "./conversationCache";

describe("cache de conversa", () => {
  it("invalida somente a conversa ativa", () => {
    const invalidate = vi.fn();
    invalidateActiveConversationMessages(42, invalidate);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ conversationId: 42 });
  });

  it("não invalida cache quando ainda não existe conversa ativa", () => {
    const invalidate = vi.fn();
    invalidateActiveConversationMessages(undefined, invalidate);
    expect(invalidate).not.toHaveBeenCalled();
  });
});
