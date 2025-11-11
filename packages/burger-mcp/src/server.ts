// SSI (Single Step Instrumentation) automatically injects dd-trace
// No need to import dd-tracer.js - Kubernetes admission controller handles it
// The tracer is preloaded via NODE_OPTIONS by the Datadog Cluster Agent

import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import express, { Request, Response } from 'express';
import { burgerApiUrl } from './config.js';
import { getMcpServer } from './mcp.js';
import { logger } from './logger.js';

const app = express();
app.use(express.json());

app.get('/', (_request: Request, response: Response) => {
  response.send({ status: 'up', message: `Burger MCP server running (Using burger API URL: ${burgerApiUrl})` });
});

// Store transports by session ID
const transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

// ----------------------------------------------------------------------------
// New streamable HTTP transport
// ----------------------------------------------------------------------------

// Handle all MCP Streamable HTTP requests (GET, POST, DELETE) on a single endpoint
app.all('/mcp', async (request: Request, response: Response) => {
  logger.info({ method: request.method }, 'Received request to /mcp');

  try {
    // Check for existing session ID
    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Check if the transport is of the correct type
      const existingTransport = transports[sessionId];
      if (existingTransport instanceof StreamableHTTPServerTransport) {
        // Reuse existing transport
        transport = existingTransport;
      } else {
        // Transport exists but is not a StreamableHTTPServerTransport (could be SSEServerTransport)
        response.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32_000,
            message: 'Bad Request: Session exists but uses a different transport protocol',
          },
          id: null,
        });
        return;
      }
    } else if (!sessionId && request.method === 'POST' && isInitializeRequest(request.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized(sessionId) {
          // Store the transport by session ID when session is initialized
          logger.info({ sessionId }, 'StreamableHTTP session initialized');
          transports[sessionId] = transport;
        },
      });

      // Set up onclose handler to clean up transport when closed
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          logger.info({ sessionId: sid }, 'Transport closed, removing from transports map');
          delete transports[sid];
        }
      };

      // Connect the transport to the MCP server
      const server = getMcpServer();
      await server.connect(transport);
    } else {
      // Handle GET requests for SSE streaming
      if (request.method === 'GET') {
        // Per MCP spec: return 405 to indicate server does not offer SSE stream at this endpoint
        // Streamable HTTP uses POST for both sending and receiving, not GET+SSE
        response.status(405).json({
          jsonrpc: '2.0',
          error: {
            code: -32_000,
            message: 'Method Not Allowed: This server uses Streamable HTTP (POST only), not SSE (GET)',
          },
          id: null,
        });
        return;
      }

      // Invalid request - no session ID or not initialization request
      response.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32_000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with the transport
    await transport.handleRequest(request, response, request.body);
  } catch (error) {
    logger.error({ err: error }, 'Error handling MCP request');
    if (!response.headersSent) {
      response.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32_603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// ----------------------------------------------------------------------------
// Deprecated SSE transport
// ----------------------------------------------------------------------------

app.get('/sse', async (request: Request, response: Response) => {
  logger.info('Received GET request to /sse (deprecated SSE transport)');
  const transport = new SSEServerTransport('/messages', response);
  transports[transport.sessionId] = transport;
  response.on('close', () => {
    delete transports[transport.sessionId];
  });
  const server = getMcpServer();
  await server.connect(transport);
});

app.post('/messages', async (request: Request, response: Response) => {
  const sessionId = request.query.sessionId as string;
  let transport: SSEServerTransport;
  const existingTransport = transports[sessionId];
  if (existingTransport instanceof SSEServerTransport) {
    // Reuse existing transport
    transport = existingTransport;
  } else {
    // Transport exists but is not a SSEServerTransport (could be StreamableHTTPServerTransport)
    response.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32_000,
        message: 'Bad Request: Session exists but uses a different transport protocol',
      },
      id: null,
    });
    return;
  }

  if (transport) {
    await transport.handlePostMessage(request, response, request.body);
  } else {
    response.status(400).send('No transport found for sessionId');
  }
});

// Start the server
const PORT = process.env.FUNCTIONS_CUSTOMHANDLER_PORT || process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info({ port: PORT, burgerApiUrl }, 'Burger MCP server listening');
});

// Handle server shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server');

  // Close all active transports to properly clean up resources
  for (const sessionId in transports) {
    if (Object.hasOwn(transports, sessionId)) {
      try {
        logger.info({ sessionId }, 'Closing transport for session');
        // eslint-disable-next-line no-await-in-loop
        await transports[sessionId].close();
        delete transports[sessionId];
      } catch (error) {
        logger.error({ err: error, sessionId }, 'Error closing transport for session');
      }
    }
  }

  logger.info('Server shutdown complete');
  process.exit(0);
});
