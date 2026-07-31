import type { PropsWithChildren } from 'react'

export function Document({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Tarkman</title>
      </head>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  )
}
