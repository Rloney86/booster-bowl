import "../styles.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const PLAYER_KEY = "bb_player_profile";

export default function MyApp({ Component, pageProps }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [authStep, setAuthStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || "{}");
      setPlayerName(saved.playerName || "");
      setEmail(saved.email || "");
    } catch {}
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user);
        setEmail(data.user.email || "");
        setAuthStep("signed-in");
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        setEmail(session.user.email || "");
        setAuthStep("signed-in");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  function saveProfile() {
    const profile = { playerName: playerName.trim(), email: (user?.email || email).trim() };
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify(profile)); } catch {}
    window.dispatchEvent(new CustomEvent("booster-bowl-profile-updated", { detail: profile }));
  }

  async function sendSignInLink() {
    if (!playerName.trim() || !email.trim()) {
      setMessage("Enter your name and email first.");
      return;
    }
    setBusy(true);
    setMessage("");
    saveProfile();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/picks`,
      },
    });
    setBusy(false);
    if (error) {
      setMessage("Could not send the sign-in link: " + error.message);
      return;
    }
    setAuthStep("link-sent");
    setMessage("Open the newest Booster Bowl email and tap Sign in.");
  }

  function changeEmail() {
    if (busy) return;
    setAuthStep("email");
    setMessage("Update your email, then request a new sign-in link.");
  }

  function updateName() {
    if (!playerName.trim()) {
      setMessage("Enter your name first.");
      return;
    }
    saveProfile();
    setMessage("Name saved.");
  }

  async function signOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) {
      setMessage("Could not sign out: " + error.message);
      return;
    }
    setUser(null);
    setAuthStep("email");
    setMessage("Signed out.");
  }

  return (
    <>
      <header
        style={{
          background: "#000",
          padding: "14px 20px",
          borderBottom: "2px solid #00f5c4",
          position: "relative",
          zIndex: 50,
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

          <div style={{ marginLeft: "auto", position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              aria-label={user ? "Open account menu" : "Open player login"}
              title={user ? `Signed in as ${user.email}` : "Player login"}
              onClick={() => { setAccountOpen((open) => !open); setMessage(""); }}
              style={{
                minWidth: 82,
                height: 42,
                padding: "0 12px",
                borderRadius: 999,
                border: user ? "2px solid #00f5c4" : "1px solid #607080",
                background: user ? "#10382f" : "#17202a",
                color: "#fff",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              {user ? "✅ Account" : "👤 Login"}
            </button>

            {accountOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close login window"
                  onClick={() => setAccountOpen(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    border: 0,
                    background: "rgba(0, 0, 0, 0.55)",
                    zIndex: 99,
                  }}
                />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={user ? "Player account" : "Player login"}
                className="card"
                style={{
                  position: "fixed",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "min(380px, calc(100vw - 32px))",
                  maxHeight: "calc(100vh - 32px)",
                  overflowY: "auto",
                  color: "#0b1220",
                  zIndex: 100,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", marginBottom: 10 }}>
                  {user ? "✅ PLAYER ACCOUNT" : "🔐 PLAYER LOGIN"}
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  <input
                    value={playerName}
                    onChange={(event) => setPlayerName(event.target.value)}
                    placeholder="Your name"
                  />
                  {!user ? (
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email address"
                      disabled={authStep !== "email"}
                    />
                  ) : (
                    <div style={{ fontWeight: 700, overflowWrap: "anywhere" }}>{user.email}</div>
                  )}

                  {!user && authStep === "email" ? (
                    <button className="button" onClick={sendSignInLink} disabled={busy}>
                      {busy ? "Sending..." : "Email Me a Sign-In Link"}
                    </button>
                  ) : null}

                  {!user && authStep === "link-sent" ? (
                    <>
                      <div style={{ padding: 10, border: "1px solid #dbe3ef", borderRadius: 12 }}>
                        Check your email and tap <b>Sign in</b>.
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="button" onClick={sendSignInLink} disabled={busy}>
                          {busy ? "Sending..." : "Resend Link"}
                        </button>
                        <button className="button secondary" onClick={changeEmail} disabled={busy}>
                          Change Email
                        </button>
                      </div>
                    </>
                  ) : null}

                  {user ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="button" onClick={updateName} disabled={busy}>Save Name</button>
                      <Link href="/my-picks" className="button secondary" onClick={() => setAccountOpen(false)}>My Picks</Link>
                      <button className="button secondary" onClick={signOut} disabled={busy}>
                        {busy ? "Signing out..." : "Sign Out"}
                      </button>
                    </div>
                  ) : null}

                  {message ? <div style={{ padding: 10, border: "1px solid #dbe3ef", borderRadius: 12 }}>{message}</div> : null}
                </div>
              </div>
              </>
            ) : null}
          </div>

          <nav style={{ display: "flex", gap: 18, flex: "1 1 auto", minWidth: 0, overflowX: "auto", whiteSpace: "nowrap", paddingBottom: 2 }}>
            <Link href="/" style={navLink}>Home</Link>
            <Link href="/picks" style={navLink}>Make Picks</Link>
            <Link href="/leaderboard" style={navLink}>Leaderboard</Link>
            <Link href="/about" style={navLink}>About</Link>
          </nav>
        </div>
      </header>

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
