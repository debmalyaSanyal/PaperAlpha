export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 24 }}>
        <h2>Application error: a server-side exception has occurred</h2>
        <p>{error.message}</p>
        {error.digest ? <p>Digest: {error.digest}</p> : null}
      </body>
    </html>
  );
}
