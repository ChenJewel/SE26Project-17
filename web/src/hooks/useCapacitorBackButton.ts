import { useEffect, useRef } from "react";
import type { PluginListenerHandle } from "@capacitor/core";

type BackButtonHandler = () => boolean;

type HandlerEntry = {
  id: symbol;
  handler: BackButtonHandler;
};

const handlers: HandlerEntry[] = [];
let listenerReady = false;
let listenerHandle: PluginListenerHandle | null = null;

async function ensureNativeBackButtonListener() {
  if (listenerReady) return;
  listenerReady = true;

  try {
    const [{ App }, { Capacitor }] = await Promise.all([
      import("@capacitor/app"),
      import("@capacitor/core"),
    ]);

    if (!Capacitor.isNativePlatform()) return;

    listenerHandle = await App.addListener("backButton", async ({ canGoBack }) => {
      for (let index = handlers.length - 1; index >= 0; index -= 1) {
        if (handlers[index]?.handler()) return;
      }

      if (canGoBack && window.history.length > 1) {
        window.history.back();
        return;
      }

      await App.exitApp();
    });
  } catch (error) {
    console.warn("Capacitor back button listener is unavailable.", error);
  }
}

export function useCapacitorBackButton(handler: BackButtonHandler, enabled = true) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;

    const entry: HandlerEntry = {
      id: Symbol("capacitor-back-button-handler"),
      handler: () => handlerRef.current(),
    };

    handlers.push(entry);
    void ensureNativeBackButtonListener();

    return () => {
      const index = handlers.findIndex((item) => item.id === entry.id);
      if (index >= 0) handlers.splice(index, 1);
    };
  }, [enabled]);
}

export async function removeCapacitorBackButtonListenerForTests() {
  await listenerHandle?.remove();
  listenerHandle = null;
  listenerReady = false;
  handlers.splice(0, handlers.length);
}
