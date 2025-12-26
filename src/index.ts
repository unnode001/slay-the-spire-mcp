#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebSocketServer, WebSocket } from "ws";

// --- Game State & WebSocket Logic ---

let latestGameState: any = null;
let gameSocket: WebSocket | null = null;

const wss = new WebSocketServer({ port: 19988 });

wss.on("connection", (ws) => {
  console.error("Game Relay connected via WebSocket");
  gameSocket = ws;

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data && data.available_commands) {
        latestGameState = data;
        // console.error("Updated game state"); // Verbose logging
      }
    } catch (e) {
      console.error("Failed to parse game message:", e);
    }
  });

  ws.on("close", () => {
    console.error("Game Relay disconnected");
    gameSocket = null;
  });
});

function sendGameCommand(command: string): Promise<boolean> {
  if (!gameSocket || gameSocket.readyState !== WebSocket.OPEN) {
    throw new Error("Game not connected. Please ensure Slay the Spire and the Relay script are running.");
  }
  return new Promise((resolve, reject) => {
    gameSocket!.send(command, (err) => {
      if (err) reject(err);
      else resolve(true);
    });
  });
}

// --- MCP Server Setup ---

const server = new Server(
  {
    name: "slay-the-spire-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// --- Resources ---

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: "sts://game_state",
        mimeType: "application/json",
        name: "Current Game State",
        description: "The requested JSON representation of the current Slay the Spire game state."
      },
      {
        uri: "sts://available_commands",
        mimeType: "application/json",
        name: "Available Commands",
        description: "List of commands currently available to be executed."
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (uri === "sts://game_state") {
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify(latestGameState, null, 2) || "{}"
      }]
    };
  }

  if (uri === "sts://available_commands") {
    return {
      contents: [{
        uri: uri,
        mimeType: "application/json",
        text: JSON.stringify(latestGameState?.available_commands || [], null, 2)
      }]
    };
  }

  throw new Error(`Resource ${uri} not found`);
});

// --- Tools ---

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "send_command",
        description: "Send a raw command to Slay the Spire (e.g., 'play 1 0', 'end', 'potion 0 1'). Use this for full control if helper tools don't cover a case.",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The raw command string."
            }
          },
          required: ["command"]
        }
      },
      {
        name: "play_card",
        description: "Play a card from your hand. Index 1-based usually, check game state.",
        inputSchema: {
          type: "object",
          properties: {
            card_index: {
              type: "integer",
              description: "Index of the card in hand (1-based)."
            },
            target_index: {
              type: "integer",
              description: "Index of the target monster (0-based) if applicable."
            }
          },
          required: ["card_index"]
        }
      },
      {
        name: "end_turn",
        description: "End the current turn.",
        inputSchema: {
          type: "object",
          properties: {},
        }
      },
      {
        name: "choose",
        description: "Make a choice in an event or screen (e.g. choose a card reward, shop item).",
        inputSchema: {
          type: "object",
          properties: {
            choice_index: {
              type: "integer",
              description: "The index of the choice to make."
            }
          },
          required: ["choice_index"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "send_command": {
        const cmd = String(args?.command);
        if (!cmd) throw new Error("Command is required");
        await sendGameCommand(cmd);
        return { content: [{ type: "text", text: `Sent command: ${cmd}` }] };
      }

      case "play_card": {
        const cardIdx = args?.card_index;
        const targetIdx = args?.target_index;
        if (cardIdx === undefined) throw new Error("card_index is required");

        let cmd = `play ${cardIdx}`;
        if (targetIdx !== undefined) {
          cmd += ` ${targetIdx}`;
        }

        await sendGameCommand(cmd);
        return { content: [{ type: "text", text: `Played card: ${cmd}` }] };
      }

      case "end_turn": {
        await sendGameCommand("end");
        return { content: [{ type: "text", text: "Ended turn" }] };
      }

      case "choose": {
        const choiceIdx = args?.choice_index;
        if (choiceIdx === undefined) throw new Error("choice_index is required");
        const cmd = `choose ${choiceIdx}`;
        await sendGameCommand(cmd);
        return { content: [{ type: "text", text: `Made choice: ${cmd}` }] };
      }

      default:
        throw new Error("Unknown tool");
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }]
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Slay the Spire MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
