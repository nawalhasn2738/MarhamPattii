'use client';
export default function ErrorPage({ reset }: { reset: () => void }) { return <section className="dashboard"><h1>We couldn’t load this page.</h1><p role="alert">Please try again. If the problem continues, check the application configuration.</p><button className="button" onClick={reset}>Try again</button></section>; }
