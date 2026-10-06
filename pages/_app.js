import "../styles.css";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const PLAYER_KEY = "bb_player_profile";
const RESUME_SUBMISSION_KEY = "bb_resume_submission";
const ADMIN_EMAIL = "mr.rayloney@gmail.com";

export default function MyApp({ Component, pageProps }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const [authStep, setAuthStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
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
        try {
          if (sessionStorage.getItem(RESUME_SUBMISSION_KEY) === "1") setAccountOpen(false);
        } catch {}
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function openLogin() {
      setAccountOpen(true);
      setMessage("");
    }
    window.addEventListener("booster-bowl-open-login", openLogin);
    return () => window.removeEventListener("booster-bowl-open-login", openLogin);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function saveProfile() {
    const profile = { playerName: playerName.trim(), email: (user?.email || email).trim() };
    try { localStorage.setItem(PLAYER_KEY, JSON.stringify(profile)); } catch {}
    window.dispatchEvent(new CustomEvent("booster-bowl-profile-updated", { detail: profile }));
  }

  async function sendSignInLink() {
    if (cooldown > 0) {
      setMessage(`Please wait ${cooldown} seconds before requesting another sign-in email.`);
      return;
    }
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
      const rateLimited = error.code === "over_email_send_rate_limit" || /rate limit/i.test(error.message || "");
      if (rateLimited) {
        setCooldown(60);
        setMessage("Too many sign-in emails were requested. Use the newest email already sent, or wait about an hour and try again.");
      } else {
        setMessage("Could not send the verification code: " + error.message);
      }
      return;
    }
    setCooldown(60);
    setAuthStep("otp-sent");
    setMessage("Enter the six-digit code from the newest Booster Bowl email.");
  }

  async function verifyCode() {
    const token = otp.trim();
    if (!/^\d{6}$/.test(token)) {
      setMessage("Enter the six-digit verification code from your email.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: "email",
    });
    setBusy(false);
    if (error) {
      setMessage("That code could not be verified: " + error.message);
      return;
    }
    setOtp("");
    setAuthStep("signed-in");
    setMessage("You’re signed in.");
  }

  function changeEmail() {
    if (busy) return;
    setOtp("");
    setAuthStep("email");
    setMessage("Update your email, then request a new verification code.");
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
          background: "rgba(5, 5, 8, .88)",
          padding: "14px 20px",
          borderBottom: "1px solid rgba(0, 240, 255, .6)",
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
                border: user ? "2px solid #39ff14" : "1px solid rgba(0, 240, 255, .5)",
                background: user ? "rgba(57, 255, 20, .16)" : "rgba(16, 20, 34, .9)",
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
                    background: "rgba(0, 0, 0, 0.72)",
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
                  color: "#f5fbff",
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
                    <button className="button" onClick={sendSignInLink} disabled={busy || cooldown > 0}>
                      {busy ? "Sending..." : cooldown > 0 ? `Try Again in ${cooldown}s` : "Email Me a Sign-In Code"}
                    </button>
                  ) : null}

                  {!user && authStep === "otp-sent" ? (
                    <>
                      <input
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        value={otp}
                        onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="6-digit verification code"
                        aria-label="Verification code"
                      />
                      <button className="button" onClick={verifyCode} disabled={busy || otp.length !== 6}>
                        {busy ? "Verifying..." : "Verify Code"}
                      </button>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button className="button" onClick={sendSignInLink} disabled={busy || cooldown > 0}>
                          {busy ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
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
                      {user.email?.toLowerCase() === ADMIN_EMAIL ? <Link href="/admin" className="button secondary" onClick={() => setAccountOpen(false)}>Score Admin</Link> : null}
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
            <Link href="/leaderboard" style={navLink}>Leaderboard</Link>\n            <Link href="/community" style={navLink}>Community</Link>
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
