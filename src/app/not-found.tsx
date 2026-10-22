import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>A little off track.</h1>
      <p>That page isn’t part of your plan.</p>
      <Link href="/dashboard" className="button button-primary">
        Back to your dashboard
      </Link>
    </div>
  );
}
