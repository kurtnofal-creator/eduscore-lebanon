'use client'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html>
      <body>
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h1>Server Error</h1>
          <p><strong>Message:</strong> {error.message}</p>
          <p><strong>Digest:</strong> {error.digest}</p>
          <pre style={{ background: '#f4f4f4', padding: 16, overflow: 'auto' }}>
            {error.stack}
          </pre>
        </div>
      </body>
    </html>
  )
}
