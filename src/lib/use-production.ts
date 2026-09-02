"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProductionData } from "@/lib/production";

// Data layer for /production. One fetch loads the whole document (it's small:
// a few weeks of whiteboard entries and some lists), every write posts an
// action and swaps in the document the server hands back.
//
// The head brewer's password is kept in localStorage so building the schedule
// from a phone doesn't mean retyping it on every visit; "Sign out" clears it.

const PASSWORD_KEY = "production-password";
const ENDPOINT = "/api/production";

export type ActionResult = { ok: true } | { ok: false; error: string };

function readStoredPassword(): string {
  try {
    return window.localStorage.getItem(PASSWORD_KEY) || "";
  } catch {
    return "";
  }
}

export function useProduction() {
  const [data, setData] = useState<ProductionData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [password, setPassword] = useState("");
  const [canEdit, setCanEdit] = useState(false);

  const load = useCallback(async (pw: string): Promise<boolean> => {
    try {
      const res = await fetch(ENDPOINT, {
        cache: "no-store",
        headers: pw ? { "x-admin-password": pw } : {},
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error || "load failed");
      setData(json.data);
      setCanEdit(Boolean(json.canEdit));
      setLoadError("");
      return Boolean(json.canEdit);
    } catch (err) {
      console.error("Failed to load production data:", err);
      setLoadError("Couldn't load the schedule — check the wifi and refresh.");
      return false;
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const pw = readStoredPassword();
    setPassword(pw);
    load(pw);
  }, [load]);

  const login = useCallback(
    async (pw: string): Promise<boolean> => {
      const ok = await load(pw);
      if (ok) {
        setPassword(pw);
        try {
          window.localStorage.setItem(PASSWORD_KEY, pw);
        } catch {
          // Private mode etc. — editing still works for this visit.
        }
      }
      return ok;
    },
    [load]
  );

  const logout = useCallback(() => {
    setPassword("");
    setCanEdit(false);
    try {
      window.localStorage.removeItem(PASSWORD_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Writes go out one at a time so two quick check-offs can't collide (the
  // server retries under contention, but a queue keeps the UI honest). While
  // several are queued we skip applying intermediate responses so an earlier
  // response can't briefly undo a later optimistic change; the last one wins.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const inFlight = useRef(0);

  const act = useCallback(
    async (
      payload: Record<string, unknown>,
      optimistic?: (current: ProductionData) => ProductionData
    ): Promise<ActionResult> => {
      if (optimistic) setData((cur) => (cur ? optimistic(cur) : cur));
      inFlight.current += 1;
      const run = async (): Promise<ActionResult> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        let result: ProductionData | null = null;
        let error = "";
        try {
          const controller = new AbortController();
          timer = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(password ? { "x-admin-password": password } : {}),
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok || !json.data) {
            error = json.error || (res.status === 401 ? "Not signed in" : "Couldn't save");
          } else {
            result = json.data as ProductionData;
          }
        } catch (err) {
          error = err instanceof Error && err.name === "AbortError" ? "Timed out" : "Couldn't save";
        } finally {
          if (timer) clearTimeout(timer);
          inFlight.current -= 1;
        }
        if (error || !result) {
          // Whatever we guessed optimistically is now suspect: reload the
          // truth rather than trying to unpick one change from the middle.
          if (inFlight.current === 0) await load(password);
          return { ok: false, error: error || "Couldn't save" };
        }
        if (inFlight.current === 0) setData(result);
        return { ok: true };
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => {});
      return next;
    },
    [password, load]
  );

  return { data, loaded, loadError, canEdit, login, logout, act, refresh: () => load(password) };
}
