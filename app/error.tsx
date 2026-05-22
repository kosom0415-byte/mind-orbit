"use client";

import ErrorState from "./components/ErrorState";

type ErrorProps = {
  error: Error;
  reset: () => void;
};

export default function GlobalError({ error, reset }: ErrorProps) {
  return <ErrorState error={error} reset={reset} />;
}
