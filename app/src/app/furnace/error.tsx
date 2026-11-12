"use client";

/** Shown when a Furnace Analysis page cannot load its data: a failed query is an error, not "no data". */
export default function FurnaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="fa-app">
      <main className="fa-main">
        <div className="fa-card fa-empty" role="alert">
          <b>This page could not be loaded</b>
          <p style={{ margin: "0 0 16px" }}>The data could not be read just now. Try again; if it keeps happening, tell the administrator{error.digest ? ` (reference ${error.digest})` : ""}.</p>
          <button type="button" className="fa-btn primary" onClick={reset}>Try again</button>
        </div>
      </main>
    </div>
  );
}
