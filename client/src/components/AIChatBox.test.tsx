import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
import { describe, expect, it } from "vitest";
import { AIChatBox } from "./AIChatBox";

describe("AIChatBox", () => {
  it("renderiza uma bolha privada para mensagem de voz sem expor conteúdo reconhecido", () => {
    const transcription = "Conteúdo reconhecido que não pode aparecer no histórico.";
    const markup = renderToStaticMarkup(
      <AIChatBox
        messages={[
          { role: "user", messageType: "voice", content: "Mensagem de voz enviada." },
          { role: "assistant", content: "Posso ajudar com os dados autorizados da sua igreja." },
        ]}
        onSendMessage={() => undefined}
      />,
    );

    expect(markup).toContain("Mensagem de voz");
    expect(markup).toContain("Conteúdo processado de forma privada");
    expect(markup).toContain("Posso ajudar com os dados autorizados da sua igreja.");
    expect(markup).not.toContain(transcription);
  });
});
