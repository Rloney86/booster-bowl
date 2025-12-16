import "../styles.css";
import Link from "next/link";

export default function App({ Component, pageProps }) {
  return (
    <>
      <nav
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "16px 24px 0",
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        <Link href="/" style={{ fontWeight: 700 }}>
          Booster Bowl
        </Link>
        <Link href="/about">About</Link>
      </nav>

      <Component {...pageProps} />
    </>
  );
}
