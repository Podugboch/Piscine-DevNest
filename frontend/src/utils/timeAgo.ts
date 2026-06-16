export function timeAgo(dateString: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(dateString).getTime()) / 1000
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;

  const days = Math.floor(seconds / 86400);

  if (days < 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return `${days} days ago`;
}