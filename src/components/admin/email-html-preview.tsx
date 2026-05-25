"use client";

interface Props {
  html: string;
}

export function EmailHtmlPreview({ html }: Props) {
  // Extraer solo el contenido del <body> para inyectarlo en la página
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const bodyContent = bodyMatch ? bodyMatch[1] : html;

  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif", background: "#f0efee", padding: "0" }}
      dangerouslySetInnerHTML={{ __html: bodyContent }}
    />
  );
}
