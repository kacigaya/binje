import { Globe } from "lucide-react";

export default function AudioLanguageIcon({ language }: { language?: string }) {
  const code = language?.trim().toLowerCase();
  if (code !== "en" && code !== "fr" && code !== "ja" && code !== "ko") {
    return <Globe aria-hidden="true" data-audio-flag="unknown" className="size-4 shrink-0" />;
  }

  /* eslint-disable shadcn/no-raw-colors -- National flag colors stay fixed across themes. */
  return (
    <svg
      aria-hidden="true"
      data-audio-flag={code}
      viewBox={code === "en" ? "0 0 60 30" : "0 0 60 40"}
      className="h-3.5 w-5 shrink-0 overflow-hidden"
    >
      {code === "en" && (
        <>
          <path fill="#012169" d="M0 0h60v30H0z" />
          <path stroke="#fff" strokeWidth="6" d="m0 0 60 30m0-30L0 30" />
          <path fill="#c8102e" d="m0 0 30 15h-6L0 3zm60 0L30 15V12L54 0zM0 30l30-15v3L6 30zm60 0L30 15h6l24 12z" />
          <path stroke="#fff" strokeWidth="10" d="M30 0v30M0 15h60" />
          <path stroke="#c8102e" strokeWidth="6" d="M30 0v30M0 15h60" />
        </>
      )}
      {code === "fr" && (
        <>
          <path fill="#002654" d="M0 0h20v40H0z" />
          <path fill="#fff" d="M20 0h20v40H20z" />
          <path fill="#ed2939" d="M40 0h20v40H40z" />
        </>
      )}
      {code === "ja" && (
        <>
          <path fill="#fff" d="M0 0h60v40H0z" />
          <circle fill="#bc002d" cx="30" cy="20" r="12" />
        </>
      )}
      {code === "ko" && (
        <>
          <path fill="#fff" d="M0 0h60v40H0z" />
          <g transform="rotate(33.69 30 20)">
            <circle fill="#cd2e3a" cx="30" cy="20" r="10" />
            <path fill="#0047a0" d="M20 20a10 10 0 0 0 20 0 5 5 0 0 0-10 0 5 5 0 0 1-10 0" />
          </g>
          <g fill="none" stroke="#000" strokeWidth="1.5">
            <path transform="rotate(-56.31 12 9)" d="M7 6h10M7 9h10M7 12h10" />
            <path transform="rotate(56.31 48 9)" d="M43 6h4m2 0h4M43 9h10M43 12h4m2 0h4" />
            <path transform="rotate(56.31 12 31)" d="M7 28h10M7 31h4m2 0h4M7 34h10" />
            <path transform="rotate(-56.31 48 31)" d="M43 28h4m2 0h4M43 31h4m2 0h4M43 34h4m2 0h4" />
          </g>
        </>
      )}
    </svg>
  );
  /* eslint-enable shadcn/no-raw-colors */
}
