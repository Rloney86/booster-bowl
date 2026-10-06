import { useState } from "react";

const POSTS = [
  { id: 1, initials: "JF", name: "Jordan Fields", handle: "@jfields", time: "4m", content: "Locked in my weekly Booster Bowl picks. That featured matchup is going to be electric.", likes: 28, replies: 6, reposts: 4 },
  { id: 2, initials: "MT", name: "Maya Thompson", handle: "@mayat", time: "18m", content: "Our booster club just reached another fundraising milestone. Community support really matters.", likes: 54, replies: 12, reposts: 9 },
  { id: 3, initials: "DC", name: "Darius Cole", handle: "@dc11", time: "31m", content: "Friday night lights, rivalry energy, and a packed stadium. This is what high school football is about.", likes: 81, replies: 17, reposts: 15 },
];

export default function CommunityFeed() {
  const [engagement, setEngagement] = useState({});

  function toggle(postId, action) {
    const key = `${postId}-${action}`;
    setEngagement((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <section className="community-feed">
      <header className="community-header">
        <div>
          <span className="community-eyebrow">COMMUNITY SIGNAL</span>
          <h1>Booster Lounge</h1>
          <p>Fans, families, players, and booster clubs—all in one electric community feed.</p>
        </div>
        <span className="community-live">● LIVE FEED</span>
      </header>

      <div className="community-grid">
        {POSTS.map((post) => (
          <article className="community-post" key={post.id}>
            <header className="community-profile">
              <div className="community-avatar" aria-hidden="true">{post.initials}</div>
              <div>
                <h2>{post.name}</h2>
                <span>{post.handle} · {post.time}</span>
              </div>
            </header>
            <p className="community-content">{post.content}</p>
            <footer className="community-actions">
              <EngagementButton icon="♥" count={post.likes} active={engagement[`${post.id}-like`]} onClick={() => toggle(post.id, "like")} label="Like" />
              <EngagementButton icon="↩" count={post.replies} active={engagement[`${post.id}-reply`]} onClick={() => toggle(post.id, "reply")} label="Reply" />
              <EngagementButton icon="⟳" count={post.reposts} active={engagement[`${post.id}-repost`]} onClick={() => toggle(post.id, "repost")} label="Repost" />
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

function EngagementButton({ icon, count, active, onClick, label }) {
  return (
    <button type="button" className={`community-action ${active ? "is-active" : ""}`} onClick={onClick} aria-pressed={active} aria-label={label}>
      <span aria-hidden="true">{icon}</span><span>{active ? count + 1 : count}</span>
    </button>
  );
}
