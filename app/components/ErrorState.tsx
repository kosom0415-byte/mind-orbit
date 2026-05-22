"use client";

type ErrorStateProps = {
  error: Error;
  reset: () => void;
};

export default function ErrorState({ error, reset }: ErrorStateProps) {
  return (
    <div className="error-state">
      <div className="error-state-icon">⚠️</div>
      <div className="error-state-title">앱 오류가 발생했습니다.</div>
      <div className="error-state-message">{error?.message ?? "알 수 없는 오류가 발생했습니다."}</div>
      <button className="error-state-button" type="button" onClick={reset}>
        다시 시도하기
      </button>
      <p className="error-state-hint">계속 문제가 발생하면 페이지를 새로고침하거나 다시 시도하세요.</p>
    </div>
  );
}
