import Link from 'next/link'

export default function Home(){
  return (
    <div className="card">
      <h1>🏈 Booster Bowl</h1>
      <p>A free-to-play pick’em experience that raises funds for high school booster clubs and gives fans <b>bragging rights</b>.</p>
      <p><Link className="button" href="/about">Learn More</Link></p>
    </div>
  )
}
