import { useRouter } from "next/router";
import Link from "next/link";

const BOOSTER_PAYMENTS = {
  jmhs: {
    school: "John Marshall High School",
    name: "Big Blue Boosters",
    paypal: "https://www.paypal.com/donate?hosted_button_id=REPLACE_ME",
    stripe: "https://buy.stripe.com/REPLACE_ME",
    cashapp: "https://cash.app/$REPLACE_ME",
  },
  hsprings: {
    school: "Highland Springs High School",
    name: "Springers Booster Club",
    paypal: "",
    stripe: "",
    cashapp: "",
  },
  varina: {
    school: "Varina High School",
    name: "Blue Devils Boosters",
    paypal: "",
    stripe: "",
    cashapp: "",
  },
};

export default function DonatePage() {
  const router = useRouter();
  const { booster } = router.query;

  if (!booster) return null;

  const data = BOOSTER_PAYMENTS[booster];

  if (!data) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
        <h1>Booster not found</h1>
        <Link className="button" href="/booster">Back</Link>
      </main>
    );
  }

  const options = [
    { label: "Donate with PayPal", url: data.paypal },
    { label: "Donate with Stripe", url: data.stripe },
    { label: "Donate with Cash App", url: data.cashapp },
  ].filter((o) => o.url && o.url.trim().length > 0);

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <section className="card" style={{ marginTop: 24 }}>
        <h1 style={{ marginTop: 0 }}>Donate</h1>
        <p style={{ opacity: 0.9, fontSize: 18 }}>
          Supporting <strong>{data.name}</strong> — {data.school}
        </p>

        {options.length === 0 ? (
          <p style={{ opacity: 0.85 }}>
            This booster hasn’t added donation links yet.
          </p>
        ) : (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {options.map((o) => (
              <a
                key={o.label}
                className="button"
                href={o.url}
                target="_blank"
                rel="noreferrer"
              >
                {o.label}
              </a>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href={`/booster/${booster}`}>
            Back to Booster Page
          </Link>
          <Link className="button" href="/booster">
            Choose Another Booster
          </Link>
        </div>
      </section>
    </main>
  );
              }
