import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>b!nje</title>
        <meta
          name="description"
          content="Discover and stream trending movies and TV shows. VO/VF audio, continue watching, watchlist, English and French."
        />
        <meta name="theme-color" content="#050506" />
        <link rel="icon" href="/favicon.ico" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: [
              "html{height:100%;background:#050506}",
              "body{position:fixed;inset:0;width:100%;height:100%;overflow:hidden;background:#050506}",
              "#root{width:100%;height:100%}",
              "@supports(height:100dvh){body{height:100dvh}#root{height:100dvh}}",
            ].join(""),
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
