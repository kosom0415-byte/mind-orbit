type EmptyStateProps = {
  title?: string;
  description?: string;
};

export default function EmptyState({
  title = "생각을 입력하면 공간이 열립니다.",
  description = "새 생각을 추가하면 마음의 지도가 채워집니다.",
}: EmptyStateProps) {
  return (
    <div className="empty-state pointer-events-none">
      <div className="empty-state-icon">🪐</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-description">{description}</div>
    </div>
  );
}
