"use client";
import React, { useEffect } from "react";
import { StatsigProvider, useClientAsyncInit } from "@statsig/react-bindings";
import { StatsigAutoCapturePlugin } from "@statsig/web-analytics";
import { StatsigSessionReplayPlugin } from "@statsig/session-replay";
import { applyRemoteConfig } from "@/lib/remoteConfig";

function anonId() {
  try {
    let id = localStorage.getItem("milo.anonId");
    if (!id) {
      id = "anon-" + Math.random().toString(36).slice(2, 12);
      localStorage.setItem("milo.anonId", id);
    }
    return id;
  } catch {
    return "anon";
  }
}

/** Statsig: agent settings as dynamic config + feature gate; events mirror Amplitude. Never blocks rendering. */
export default function MyStatsig({ children }: { children: React.ReactNode }) {
  const key = process.env.NEXT_PUBLIC_STATSIG_CLIENT_KEY || "client-missing";
  const { client, isLoading } = useClientAsyncInit(key, { userID: typeof window === "undefined" ? "ssr" : anonId() }, {
    plugins: [new StatsigAutoCapturePlugin(), new StatsigSessionReplayPlugin()],
  });
  useEffect(() => {
    (globalThis as any).__miloStatsig = client;
    if (!isLoading) applyRemoteConfig(client);
  }, [client, isLoading]);
  return <StatsigProvider client={client}>{children}</StatsigProvider>;
}
