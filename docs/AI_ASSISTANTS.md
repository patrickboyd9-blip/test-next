# Connect an assistant to Modern Mail

Claude, ChatGPT, and Cursor can prepare a mailer for you. They cannot approve it, print it, or charge you. You still do that in Modern Mail, after you see the proof and the full price.

The full price covers printing, postage, and the list. It is never postage by itself.

## Before you connect

1. Sign in to Modern Mail with your email and password, or with Google.
2. Open **Settings → API & AI assistants**: `/app/settings/api`
3. Set a spending cap. A new account starts at **$500**. An assistant cannot raise it. A charge over the cap is refused.
4. Click **Create token**. Copy the token immediately. It is shown once. You can revoke it on the same page.

The server address is the website you already use, with `/api/mcp` on the end. On the current site that is:

`https://test-next-modern-mail2.vercel.app/api/mcp`

## Claude Desktop

1. Open Claude Desktop.
2. Go to **Settings → Connectors** (or **Developer → Edit Config** if you use a config file).
3. Add a custom connector and paste the server address above.
4. When Claude asks you to sign in, use the same Modern Mail account. If it asks for a token instead, paste the token from Settings.
5. If you edit the config file by hand, use:

```json
{
  "mcpServers": {
    "modern-mail": {
      "url": "https://test-next-modern-mail2.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_TOKEN` with the token you copied. Do not share that file.

## ChatGPT

1. Open ChatGPT settings and find the place to add an app or a custom connector (Developer mode, if you are asked).
2. Paste the server address.
3. When ChatGPT asks you to sign in, use your Modern Mail email and password, or Google.
4. If it asks for an API key or token, paste the token from Settings.

## Cursor

1. Open Cursor **Settings → MCP**.
2. Add a server, or create `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "modern-mail": {
      "url": "https://test-next-modern-mail2.vercel.app/api/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

3. Replace `YOUR_TOKEN`. Reload MCP servers.

## What the assistant can do

- Create a mailer from a short brief. You must give a campaign name and a size: **5x8** or **6x9**.
- Upload your own front and back (PDF, PNG, or JPG), or pick a Mailer Gallery template. Gallery mailers are 5×8.
- Upload a CSV list, or choose a list you already saved. Use columns named first, last, street, city, state, and zip.
- Show the proof and the full price.
- Duplicate a mailer.
- Check status, QR scans, tracking calls, and responses. If a number has not been recorded, it stays blank.

## What you still do

Open the mailer in Modern Mail and approve the proof and the full price. Nothing prints and nothing is charged until you do that. Payment uses the card form Modern Mail already shows you.

To disconnect an assistant, open `/app/settings/api` and click **Revoke** on its token.
