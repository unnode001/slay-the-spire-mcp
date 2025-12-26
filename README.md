# Slay the Spire MCP Server

An MCP server that interfaces with Slay the Spire via **CommunicationMod**.

## Architecture
-   **MCP Server**: Runs on port `19988` (WebSocket) and exposes MCP Resources/Tools.
-   **Relay Script**: `relay/relay.js` is launched by the game. It bridges `stdin/stdout` to the WebSocket.

## Setup
1.  Install **CommunicationMod** from Steam Workshop.
2.  Configure `com.github.forgottenarbiter.communicationmod.config.properties`:
    ```properties
    command=node "absolute/path/to/slay-the-spire-mcp/relay/relay.js"
    ```
3.  `npm install`
4.  `npm run build`
5.  Add this MCP server to your client configuration:
    ```json
    {
      "mcpServers": {
        "slay-the-spire": {
          "command": "node",
          "args": ["absolute/path/to/slay-the-spire-mcp/build/index.js"]
        }
      }
    }
    ```

## Features
-   **Resources**: `sts://game_state`, `sts://available_commands`
-   **Tools**: `play_card`, `end_turn`, `choose`, `send_command`
