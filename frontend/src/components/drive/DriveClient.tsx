"use client";

import dynamic from "next/dynamic";
import type { DriveContent } from "@/drive/types";

// three.js and the game only ever run in the browser.
const DriveGame = dynamic(() => import("./DriveGame"), {
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#0d0f12]" />,
});

export function DriveClient(props: { content: DriveContent; fontFamily: string }) {
  return <DriveGame {...props} />;
}
