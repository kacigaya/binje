import { expect, test } from "bun:test";
import { srtToVtt } from "./srt";

test("converts SRT timestamps and line endings to WebVTT", () => {
  expect(srtToVtt("﻿1\r\n00:00:15,020 --> 00:00:16,770\r\n<i>Right now</i>\r\n\r\n2\r\n1:02:03,004 --> 1:02:05,000\r\nNever lose, 12,500 times\r\n"))
    .toBe("WEBVTT\n\n1\n00:00:15.020 --> 00:00:16.770\n<i>Right now</i>\n\n2\n1:02:03.004 --> 1:02:05.000\nNever lose, 12,500 times\n");
});
