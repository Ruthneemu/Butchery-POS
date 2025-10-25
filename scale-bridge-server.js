// scale-bridge-server.js
// Install dependencies: npm install ws net
const WebSocket = require('ws');
const net = require('net');

const WS_PORT = 8080; // WebSocket port for browser
const SCALE_IP = '192.168.1.100'; // Replace with your scale's IP
const SCALE_PORT = 8001; // Common port for CSX6, check your manual

// Create WebSocket server
const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`WebSocket server running on port ${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('Browser connected');
    let scaleClient = null;

    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.command === 'connect') {
            // Connect to scale via TCP
            scaleClient = new net.Socket();
            
            scaleClient.connect(SCALE_PORT, SCALE_IP, () => {
                console.log('Connected to scale');
                ws.send(JSON.stringify({ 
                    type: 'connected', 
                    message: 'Scale connected successfully' 
                }));
            });

            // Handle scale data
            scaleClient.on('data', (buffer) => {
                const rawData = buffer.toString('utf8').trim();
                console.log('Scale data:', rawData);
                
                // Parse weight from scale data
                // CSX6 typically sends: "ST,GS,+000.500kg" or similar
                const weight = parseScaleData(rawData);
                
                if (weight !== null) {
                    ws.send(JSON.stringify({ 
                        type: 'weight', 
                        value: weight 
                    }));
                }
            });

            scaleClient.on('error', (err) => {
                console.error('Scale error:', err);
                ws.send(JSON.stringify({ 
                    type: 'error', 
                    message: 'Scale connection error: ' + err.message 
                }));
            });

            scaleClient.on('close', () => {
                console.log('Scale disconnected');
                ws.send(JSON.stringify({ 
                    type: 'disconnected', 
                    message: 'Scale disconnected' 
                }));
            });
        }

        if (data.command === 'disconnect' && scaleClient) {
            scaleClient.destroy();
            scaleClient = null;
        }
    });

    ws.on('close', () => {
        console.log('Browser disconnected');
        if (scaleClient) {
            scaleClient.destroy();
        }
    });
});

// Parse scale data based on CSX6 format
function parseScaleData(data) {
    // Common formats:
    // "ST,GS,+000.500kg" - stable, gross weight
    // "US,GS,+000.500kg" - unstable
    // Adjust regex based on your scale's output format
    
    const patterns = [
        /([+-]?\d+\.?\d*)\s*kg/i,           // "0.500 kg" or "+0.500kg"
        /([+-]?\d+\.?\d*)\s*g/i,            // "500 g" or "500g"
        /GS,([+-]?\d+\.?\d*)/i,             // "ST,GS,+0.500"
        /NT,([+-]?\d+\.?\d*)/i,             // "ST,NT,+0.500" (net weight)
    ];

    for (const pattern of patterns) {
        const match = data.match(pattern);
        if (match) {
            let weight = parseFloat(match[1]);
            
            // Convert grams to kg if needed
            if (data.toLowerCase().includes('g') && 
                !data.toLowerCase().includes('kg')) {
                weight = weight / 1000;
            }
            
            return Math.max(0, weight); // Ensure non-negative
        }
    }
    
    return null;
}

console.log(`
Scale Bridge Server Configuration:
- WebSocket Port: ${WS_PORT}
- Scale IP: ${SCALE_IP}
- Scale Port: ${SCALE_PORT}

Make sure:
1. Your scale is connected to the network
2. The scale IP and port are correct
3. Firewall allows connections to port ${WS_PORT}
`);
