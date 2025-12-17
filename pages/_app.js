import "../styles.css";
import Link from "next/link";

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      {/* Global Header */}
      <header
        style={{
          background: "#000",
          padding: "14px 20px",
          borderBottom: "2px solid #00f5c4",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center" }}>
            <img
              src="/booster-bowl-logo.png"
              alt="Booster Bowl"
              style={{ height: 52 }}
            />
          </Link>

          <nav style={{ marginLeft: "auto", display: "flex", gap: 18 }}>
            <Link href="/" style={navLink}>Home</Link>
            <Link href="/picks" style={navLink}>Make Picks</Link>
            <Link href="/leaderboard" style={navLink}>Leaderboard</Link>
            <Link href="/about" style={navLink}>About</Link>
          </nav>
        </div>
      </header>

      {/* Page Content */}
      <Component {...pageProps} />
    </>
  );
}

const navLink = {
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 600,
  letterSpacing: "0.5px",
};
