const WebSocket = require('ws');
const readline = require('readline');

// Configuration
const MCP_SERVER_URL = 'ws://localhost:19988';

// Connect to MCP Server
const ws = new WebSocket(MCP_SERVER_URL);

ws.on('open', function open() {
    // Signal to the game that we are ready
    // CommunicationMod expects "ready" on stdout to start sending state
    console.log('ready');
});

ws.on('message', function message(data) {
    // Received command from MCP Server
    // Forward to Slay the Spire via STDOUT
    console.log(data.toString());
});

ws.on('error', function error(err) {
    // Log errors to stderr so they don't confuse the game
    // console.error('Relay WebSocket Error:', err);
});

ws.on('close', function close() {
    // console.error('Relay WebSocket Disconnected');
    process.exit(0);
});

// Read Game State from STDIN
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

rl.on('line', (line) => {
    if (line && ws.readyState === WebSocket.OPEN) {
        ws.send(line);
    }
});
